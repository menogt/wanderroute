import assert from "node:assert/strict";
import { test } from "node:test";
import { planRouteConcepts } from "./planningV2.ts";
import { generatePlanningV2Itinerary } from "./planningV2Itinerary.ts";
import { planningPresentation } from "./planningPresentation.ts";
import { planningQuoteId, planningQuoteTrip, suggestedVehicle } from "./planningQuote.ts";
import { submitQuoteRequestWithDependencies } from "./quoteRequests.ts";
import type { CandidatePlace, TripBriefV1 } from "./planningTypes";
import type { MatrixLocation, RoadLeg, TravelMatrix } from "./travelTimeMatrix";

const brief: TripBriefV1 = { schemaVersion: 1, durationDays: 5, travellerCount: 2, interests: ["culture"],
  budget: { amount: 2000, currency: "USD" }, requestedCities: ["Kandy"], comfortTier: "comfort", travelMonth: 12,
  arrival: { location: "CMB", dateTime: "2026-12-10T10:00" }, departure: { location: "CMB", dateTime: "2026-12-14T18:00" } };
const places: CandidatePlace[] = [{ databaseId: "tooth", name: "Temple of the Sacred Tooth Relic", city: "Kandy", category: "temple" }];
function matrix(locations: MatrixLocation[]): TravelMatrix {
  const legs: RoadLeg[][] = locations.map(from => locations.map(to => ({ fromId: from.id, toId: to.id, status: "ROUTED",
    source: "OSRM_TABLE", durationMinutes: from.id === to.id ? 0 : 120, distanceKm: from.id === to.id ? 0 : 80 })));
  return { locations, legs, source: "OSRM_TABLE", generatedAt: "2026-11-21T00:00:00Z" };
}

async function plan() {
  const result = await planRouteConcepts(brief, { getMatrix: async locations => matrix(locations), now: () => "2026-11-21T00:00:00Z" });
  const concept = result.concepts[0];
  const detail = await generatePlanningV2Itinerary(result, concept.routeConcept.id, { getPlaces: async () => places,
    getAiPlan: async () => { throw new Error("offline"); } });
  return planningPresentation(detail, brief, concept);
}

test("vehicle suggestion follows the estimate's car and van split", () => {
  assert.equal(suggestedVehicle(2), "CAR");
  assert.equal(suggestedVehicle(5), "VAN");
  assert.equal(suggestedVehicle(9), "NOT_SURE");
});

test("a driver quote carries the exact route, flights, transfers and the estimate range", async () => {
  const presentation = await plan();
  const trip = planningQuoteTrip(presentation, brief, { service: "WHOLE_TRIP", vehicle: "CAR" });
  assert.equal(trip.id, planningQuoteId(presentation));
  assert.match(trip.id, /^planning-v2:[0-9A-F]{8}$/);
  assert.deepEqual(trip.cities, presentation.route.map(stop => stop.name));
  const snapshot = trip.snapshot as any;
  assert.equal(snapshot.kind, "planning-v2");
  assert.deepEqual(snapshot.request, { service: "WHOLE_TRIP", vehicle: "CAR" });
  assert.equal(snapshot.arrival.dateTime, "2026-12-10T10:00");
  assert.equal(snapshot.stops.reduce((sum: number, stop: { nights: number }) => sum + stop.nights, 0), 4);
  assert.ok(snapshot.transfers.length >= 2);
  assert.ok(snapshot.estimate.max > snapshot.estimate.min && snapshot.estimate.min > 0);
  assert.equal(trip.estimatedTotal, Math.round((snapshot.estimate.min + snapshot.estimate.max) / 2));
  assert.equal(trip.travelStyle, "comfort");
});

test("the stored row keeps the main-planner snapshot and the traveller's details", async () => {
  const trip = planningQuoteTrip(await plan(), brief, { service: "AIRPORT_TRANSFERS", vehicle: "CAR" });
  let stored: any;
  const result = await submitQuoteRequestWithDependencies({ fullName: " Test ", email: "T@Example.test", travellers: 2 },
    trip, "ec976a74-c47b-45a0-948c-b86b38677b13", { insert: async row => { stored = row; return { error: null }; },
      notify: async () => true, backup: () => true, deviceId: () => "device-1" });
  assert.equal(result.status, "RECEIVED");
  assert.equal(stored.trip_id, trip.id);
  assert.equal(stored.full_name, "Test");
  assert.equal(stored.email, "t@example.test");
  assert.equal(stored.itinerary_json.kind, "planning-v2");
  assert.equal(stored.itinerary_json.request.service, "AIRPORT_TRANSFERS");
  assert.equal(stored.total_days, 5);
});
