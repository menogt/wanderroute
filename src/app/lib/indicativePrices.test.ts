import assert from "node:assert/strict";
import { test } from "node:test";
import { compareBudget } from "./costLedger.ts";
import { admissionPrice, foodDayPrice, legCost, localTransportCost, roomNightPrice } from "./indicativePrices.ts";
import { planRouteConcepts } from "./planningV2.ts";
import { generatePlanningV2Itinerary } from "./planningV2Itinerary.ts";
import { routeDayCities } from "./planningV2Scheduling.ts";
import type { CandidatePlace, TripBriefV1 } from "./planningTypes";
import type { TransportLeg } from "./transportTypes";
import type { MatrixLocation, RoadLeg, TravelMatrix } from "./travelTimeMatrix";

const trip: TripBriefV1 = { schemaVersion: 1, durationDays: 10, travellerCount: 2, travelMonth: 12,
  budget: { amount: 2000, currency: "USD" }, interests: ["culture", "wildlife"], requestedCities: ["Sigiriya", "Kandy"],
  comfortTier: "comfort", transportPreference: "PRIVATE_DRIVER" };
const places: CandidatePlace[] = [
  { databaseId: "rock", name: "Sigiriya Rock Fortress", city: "Sigiriya", category: "attraction" },
  { databaseId: "tooth", name: "Temple of the Sacred Tooth Relic", city: "Kandy", category: "temple" },
  { databaseId: "lake", name: "Kandy Lake", city: "Kandy", category: "attraction" },
];
function matrix(locations: MatrixLocation[]): TravelMatrix {
  const legs: RoadLeg[][] = locations.map(from => locations.map(to => ({ fromId: from.id, toId: to.id, status: "ROUTED",
    source: "OSRM_TABLE", durationMinutes: from.id === to.id ? 0 : 150, distanceKm: from.id === to.id ? 0 : 90 })));
  return { locations, legs, source: "OSRM_TABLE", generatedAt: "2026-11-21T00:00:00Z" };
}
const leg = (fromId: string, toId: string, mode: TransportLeg["mode"]): TransportLeg =>
  ({ id: `${fromId}>${toId}`, fromId, toId, mode, status: "UNKNOWN", durationEvidence: "UNKNOWN", distanceEvidence: "UNKNOWN" });
const bounds = (price: ReturnType<typeof roomNightPrice>) => {
  assert.equal(price.kind, "RANGE");
  return price.kind === "RANGE" ? [price.minimum, price.maximum] : [];
};

test("room and meal estimates follow comfort tier and season, and widen when either is unknown", () => {
  assert.deepEqual(bounds(roomNightPrice("comfort", 12)), [36, 104]);
  assert.deepEqual(bounds(roomNightPrice("comfort", 6)), [30, 80]);
  assert.deepEqual(bounds(roomNightPrice(undefined, undefined)), [10, 104]);
  assert.deepEqual(bounds(foodDayPrice("luxury")), [50, 100]);
  const price = roomNightPrice("budget", 1);
  assert.ok(price.kind === "RANGE" && price.provenance.status === "ESTIMATED" && /^https:\/\//.test(price.provenance.source ?? ""));
});

test("tickets match known sights, public beaches are free, and unknown sights stay a bounded range", () => {
  assert.deepEqual(bounds(admissionPrice({ name: "Sigiriya Rock Fortress", category: "attraction" }, "")), [35, 35]);
  assert.deepEqual(bounds(admissionPrice({ name: "Mirissa Beach", category: "beach" }, "")), [0, 0]);
  const unknown = bounds(admissionPrice(undefined, "Some viewpoint"));
  assert.equal(unknown[0], 0);
  assert.ok(unknown[1] > 0 && unknown[1] < 15);
});

test("transfers are priced by the chosen mode, and an unchosen mode spans bus fares to a car", () => {
  const train = legCost(leg("Colombo", "Kandy", "TRAIN"), trip)!;
  assert.equal(train.chargingBasis, "PER_PERSON");
  assert.equal(train.quantity, 2);
  const car = legCost(leg("Kandy", "Ella", "PRIVATE_DRIVER"), trip)!;
  assert.deepEqual(bounds(car.unitPrice), [53.57, 77.38]);
  const airport = legCost(leg("CMB_AIRPORT", "Negombo", "UNASSIGNED"), trip, { airport: true })!;
  assert.equal(bounds(airport.unitPrice)[0], 11.25);
  const open = legCost(leg("Kandy", "Ella", "UNASSIGNED"), trip)!;
  const [low, high] = bounds(open.unitPrice);
  assert.ok(low < 5 && high === 77.38);
  assert.equal(legCost(leg("Kandy", "Ella", "SELF_DRIVE"), trip), undefined);
});

test("a kept driver is paid for the non-transfer days; otherwise local trips are tuk-tuk days", () => {
  const driver = localTransportCost(trip, 3);
  assert.equal(driver.quantity, 7);
  const tuktuk = localTransportCost({ ...trip, transportPreference: "PUBLIC_TRANSPORT" }, 3);
  assert.equal(tuktuk.quantity, 10);
});

test("a 10-day December plan for two is fully estimated and gets a budget verdict", async () => {
  const result = await planRouteConcepts(trip, { getMatrix: async locations => matrix(locations), now: () => "2026-11-21T00:00:00Z" });
  const concept = result.concepts[0];
  const detail = await generatePlanningV2Itinerary(result, concept.routeConcept.id, { getPlaces: async () => places,
    getAiPlan: async () => ({ schemaVersion: 2, routeConceptId: concept.routeConcept.id,
      days: routeDayCities(concept.candidate, trip.durationDays).map((city, index) => ({ day: index + 1,
        placeIds: index === 1 ? places.filter(place => place.city === city).slice(0, 1).map(place => place.databaseId!) : [] })) }) });
  const summary = detail.ledger.summary;
  assert.equal(summary.unknownCostCount, 0);
  assert.ok(summary.trip.maximum! > summary.trip.minimum);
  // Nine nights of a comfort double in December and two people's meals at least.
  assert.ok(summary.trip.minimum >= 9 * 36 + 2 * 10 * 10);
  const fit = compareBudget(detail.ledger, trip.budget);
  assert.ok(["LIKELY_WITHIN_BUDGET", "BUDGET_RISK", "OVER_BUDGET"].includes(fit.status));
  assert.ok(detail.ledger.sourceLines.every(line => line.unitPrice.kind !== "RANGE" || line.unitPrice.provenance.source));
});

test("a budget in LKR is converted at the dated reference rate", async () => {
  const lkr = { ...trip, budget: { amount: 700_000, currency: "LKR" as const } };
  const result = await planRouteConcepts(lkr, { getMatrix: async locations => matrix(locations), now: () => "2026-11-21T00:00:00Z" });
  const detail = await generatePlanningV2Itinerary(result, result.concepts[0].routeConcept.id, { getPlaces: async () => places,
    getAiPlan: async () => { throw new Error("offline"); } });
  assert.equal(detail.ledger.summary.unknownCostCount, 0);
  assert.ok(detail.ledger.summary.trip.minimum > 100_000);
});
