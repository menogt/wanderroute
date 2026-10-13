import assert from "node:assert/strict";
import { test } from "node:test";
import type { TripInputs } from "../components/rl/types";
import type { TripBriefV1 } from "./planningTypes";
import type { CandidateRoute } from "./routeTypes";
import { tripInputsToBrief } from "./tripBrief.ts";
import { buildTransportPlan, transportCapability, transportLegFromRoad, transportLegId } from "./transportPlanning.ts";
import { calculateCostLedger, compareBudget, type CostLineInput } from "./costLedger.ts";
import type { TravelMatrix } from "./travelTimeMatrix.ts";

const inputs: TripInputs = { budget: 300, currency: "USD", days: 3, people: 1,
  cities: ["Kandy", "Ella"], interests: ["hiking"], travelStyle: "budget" };
const brief: TripBriefV1 = { ...tripInputsToBrief(inputs), transportPreference: "PRIVATE_DRIVER" };
const road = { fromId: "Kandy", toId: "Ella", status: "ROUTED" as const,
  source: "OSRM_TABLE" as const, durationMinutes: 180, distanceKm: 130 };
const route: CandidateRoute = {
  id: "route-1", routingBasis: "ROAD_DRIVING",
  destinations: [{ id: "Kandy", name: "Kandy", requested: true }, { id: "Ella", name: "Ella", requested: true }],
  nights: [1, 1], legs: [road], reasons: [], feasibility: "FEASIBLE",
  score: { rankValue: 0, rankable: true,
    components: { requestedCoverage: 0, driving: 0, preferredDriving: 0, longestLeg: 0,
      season: 0, backtracking: 0, switching: 0, uncertainty: 0 } },
};
const matrix: TravelMatrix = { locations: route.destinations, legs: [
  [{ fromId: "Kandy", toId: "Kandy", status: "ROUTED", durationMinutes: 0, distanceKm: 0 }, road],
  [{ fromId: "Ella", toId: "Kandy", status: "ROUTED", source: "OSRM_TABLE", durationMinutes: 180, distanceKm: 130 },
    { fromId: "Ella", toId: "Ella", status: "ROUTED", durationMinutes: 0, distanceKm: 0 }],
], source: "OSRM_TABLE", generatedAt: "2026-10-13T00:00:00Z" };

const exact = (amount: number, status: "KNOWN" | "ESTIMATED" | "VERIFIED" = "KNOWN") => ({
  kind: "EXACT" as const,
  evidence: status === "VERIFIED" ? { amount, currency: "USD" as const, status, source: "provider", checkedAt: "2026-10-13" } :
    { amount, currency: "USD" as const, status, source: "fixture" },
});
const line = (id: string, quantity: number, amount: number, category: CostLineInput["category"] = "FOOD",
  chargingBasis: CostLineInput["chargingBasis"] = "PER_PERSON"): CostLineInput =>
  ({ id, quantity, category, chargingBasis, description: id, unitPrice: exact(amount) });

test("current TripInputs do not invent transport preference", () => {
  const converted = tripInputsToBrief(inputs);
  assert.equal("transportPreference" in converted, false);
  assert.equal(converted.travellerCount, 1);
  assert.equal(converted.comfortTier, "budget");
});

test("private-driver road leg carries only estimated OSRM driving evidence", () => {
  const leg = transportLegFromRoad(road, "PRIVATE_DRIVER", "Kandy", "Ella");
  assert.equal(leg.id, "Kandy>Ella");
  assert.equal(leg.durationMinutes, 180);
  assert.equal(leg.distanceKm, 130);
  assert.equal(leg.durationEvidence, "ESTIMATED");
  assert.equal(leg.routingSource, "OSRM_TABLE");
  assert.equal(transportCapability("PRIVATE_DRIVER").fareAvailable, false);
  assert.equal(buildTransportPlan(route, brief, matrix).readiness.status, "SUPPORTED");
});

test("public transport and train legs never inherit OSRM car time or distance", () => {
  const train = transportLegFromRoad(road, "TRAIN", "Kandy", "Ella");
  assert.equal(train.durationMinutes, undefined);
  assert.equal(train.distanceKm, undefined);
  assert.equal(train.status, "UNKNOWN");
  const plan = buildTransportPlan(route, { ...brief, transportPreference: "PUBLIC_TRANSPORT" }, matrix,
    { [transportLegId("Kandy", "Ella")]: "TRAIN" });
  assert.equal(plan.legs[0].mode, "TRAIN");
  assert.equal(plan.legs[0].durationMinutes, undefined);
  assert.equal(plan.readiness.status, "UNSUPPORTED_WITH_CURRENT_DATA");
  assert.equal(transportCapability("BUS").scheduledTimeAvailable, false);
});

test("mixed transport retains per-leg modes and unknown segments", () => {
  const secondRoad = { ...road, fromId: "Ella", toId: "Galle" };
  const mixedRoute = { ...route, destinations: [...route.destinations, { id: "Galle", name: "Galle", requested: false }],
    nights: [1, 1, 1], legs: [road, secondRoad] };
  const plan = buildTransportPlan(mixedRoute, { ...brief, transportPreference: "MIXED" }, matrix,
    { "Kandy>Ella": "PRIVATE_DRIVER", "Ella>Galle": "BUS" });
  assert.deepEqual(plan.legs.map(leg => leg.mode), ["PRIVATE_DRIVER", "BUS"]);
  assert.equal(plan.legs[0].durationMinutes, 180);
  assert.equal(plan.legs[1].durationMinutes, undefined);
  assert.equal(plan.readiness.status, "PARTIALLY_SUPPORTED");
});

test("tuk-tuk has a road reference distance but no car-time claim", () => {
  const leg = transportLegFromRoad(road, "TUK_TUK_SELF_DRIVE", "Kandy", "Ella");
  assert.equal(leg.roadReferenceDistanceKm, 130);
  assert.equal(leg.durationMinutes, undefined);
  assert.equal(leg.distanceKm, undefined);
  assert.equal(transportCapability("TUK_TUK_SELF_DRIVE").timingSupport, "UNKNOWN");
});

test("recommend and absent preference do not default to private driver", () => {
  const recommended = buildTransportPlan(route, { ...brief, transportPreference: "RECOMMEND" }, matrix);
  const missing = buildTransportPlan(route, { ...brief, transportPreference: undefined }, matrix);
  assert.equal(recommended.legs[0].mode, "UNASSIGNED");
  assert.equal(missing.legs[0].mode, "UNASSIGNED");
  assert.equal(recommended.legs[0].durationMinutes, undefined);
});

test("per-person, per-group, per-room-night, and per-vehicle-day amounts use one calculation", () => {
  const lines: CostLineInput[] = [
    line("people", 2, 10),
    line("group", 1, 50, "ACTIVITIES", "PER_GROUP"),
    { ...line("rooms", 2, 30, "ACCOMMODATION", "PER_ROOM"), periodCount: 3, periodUnit: "NIGHT" },
    { ...line("vehicle", 1, 100, "TRANSPORT", "PER_VEHICLE"), periodCount: 4, periodUnit: "DAY" },
  ];
  const ledger = calculateCostLedger(lines, "USD", 2);
  assert.deepEqual(ledger.lines.map(value => value.total?.exact), [20, 50, 180, 400]);
  assert.equal(ledger.summary.wholeTripTotal, 650);
  assert.equal(ledger.summary.perPersonTotal, 325);
  assert.equal(ledger.summary.byCategory.ACCOMMODATION.exact, 180);
  assert.equal(ledger.summary.byCategory.TRANSPORT.exact, 400);
  assert.equal(Object.values(ledger.summary.byCategory).reduce((sum, value) => sum + value.exact!, 0), 650);
});

test("day totals and provenance subtotals reconcile to the whole trip", () => {
  const lines: CostLineInput[] = [
    { ...line("a", 1, 10), day: 1 },
    { ...line("b", 1, 20), day: 2, unitPrice: exact(20, "VERIFIED") },
    { ...line("c", 1, 30), day: 2, unitPrice: exact(30, "ESTIMATED") },
  ];
  const ledger = calculateCostLedger(lines, "USD", 1);
  assert.equal(ledger.summary.byDay[1].exact, 10);
  assert.equal(ledger.summary.byDay[2].exact, 50);
  assert.equal(ledger.summary.byProvenance.KNOWN.exact, 10);
  assert.equal(ledger.summary.byProvenance.VERIFIED.exact, 20);
  assert.equal(ledger.summary.byProvenance.ESTIMATED.exact, 30);
  assert.equal(ledger.summary.trip.exact, 60);
});

test("currency conversion stores rate and source without fetching exchange data", () => {
  const euro: CostLineInput = { ...line("hotel", 1, 1), unitPrice: { kind: "EXACT",
    evidence: { amount: 100, currency: "EUR", status: "KNOWN", source: "hotel" } } };
  const ledger = calculateCostLedger([euro], "USD", 1,
    [{ from: "EUR", to: "USD", rate: 1.2, source: "fixture-rate", checkedAt: "2026-10-13" }]);
  assert.equal(ledger.lines[0].sourceTotal?.exact, 100);
  assert.equal(ledger.lines[0].total?.exact, 120);
  assert.equal(ledger.lines[0].conversion?.source, "fixture-rate");
  assert.equal(ledger.lines[0].conversion?.checkedAt, "2026-10-13");
});

test("unknown price and missing FX do not become zero totals", () => {
  const unknown: CostLineInput = { ...line("driver", 1, 0, "TRANSPORT", "PER_VEHICLE"),
    unitPrice: { kind: "UNKNOWN", reason: "awaiting quote" } };
  const euro: CostLineInput = { ...line("hotel", 1, 1), unitPrice: { kind: "EXACT",
    evidence: { amount: 100, currency: "EUR", status: "KNOWN" } } };
  const ledger = calculateCostLedger([unknown, euro], "USD", 1);
  assert.equal(ledger.summary.unknownCostCount, 2);
  assert.equal(ledger.summary.wholeTripTotal, undefined);
  assert.equal(ledger.summary.maximumEstimatedTripRange, undefined);
  assert.equal(ledger.lines[0].total, undefined);
  assert.ok(ledger.issues.some(issue => issue.code === "MISSING_CONVERSION_RATE"));
});

test("estimated ranges preserve bounds and expected value without exactness", () => {
  const range: CostLineInput = { ...line("hotel", 2, 1, "ACCOMMODATION", "PER_ROOM"),
    unitPrice: { kind: "RANGE", minimum: 25, maximum: 35, expected: 30,
      currency: "USD", provenance: { status: "ESTIMATED", source: "fixture" } } };
  const ledger = calculateCostLedger([range], "USD", 2);
  assert.deepEqual(ledger.lines[0].total, { currency: "USD", minimum: 50, maximum: 70, expected: 60 });
  assert.equal(ledger.summary.trip.exact, undefined);
  assert.equal(ledger.summary.minimumKnownTripEstimate, 50);
  assert.equal(ledger.summary.maximumEstimatedTripRange, 70);
});

test("verified exact prices need source and timestamp even from untyped JSON", () => {
  const forged = { ...line("forged", 1, 30), unitPrice: { kind: "EXACT",
    evidence: { amount: 30, currency: "USD", status: "VERIFIED" } } } as CostLineInput;
  const ledger = calculateCostLedger([forged], "USD", 1);
  assert.ok(ledger.issues.some(issue => issue.code === "VERIFICATION_PROVENANCE_MISSING"));
  assert.equal(ledger.summary.trip.exact, undefined);
});

test("negative, reversed, or duplicate cost lines are rejected", () => {
  const negative = line("same", 1, -5);
  const reversed: CostLineInput = { ...line("same", 1, 1), unitPrice: { kind: "RANGE",
    minimum: 20, maximum: 10, currency: "USD", provenance: { status: "ESTIMATED" } } };
  const ledger = calculateCostLedger([negative, reversed], "USD", 1);
  assert.ok(ledger.issues.some(issue => issue.code === "NEGATIVE_PRICE"));
  assert.ok(ledger.issues.some(issue => issue.code === "INVALID_RANGE"));
  assert.ok(ledger.issues.some(issue => issue.code === "DUPLICATE_LINE_ID"));
  assert.equal(ledger.summary.trip.exact, undefined);
});

test("budget states distinguish exact, ranged, excessive and unknown costs", () => {
  const within = calculateCostLedger([line("x", 1, 40)], "USD", 1);
  const rangeLine: CostLineInput = { ...line("r", 1, 1), unitPrice: { kind: "RANGE",
    minimum: 40, maximum: 60, currency: "USD", provenance: { status: "ESTIMATED" } } };
  const range = calculateCostLedger([rangeLine], "USD", 1);
  const unknown = calculateCostLedger([{ ...line("u", 1, 1), unitPrice: { kind: "UNKNOWN" } }], "USD", 1);
  assert.equal(compareBudget(within, { amount: 50, currency: "USD" }).status, "WITHIN_BUDGET");
  assert.equal(compareBudget(range, { amount: 70, currency: "USD" }).status, "LIKELY_WITHIN_BUDGET");
  assert.equal(compareBudget(range, { amount: 50, currency: "USD" }).status, "BUDGET_RISK");
  assert.equal(compareBudget(range, { amount: 30, currency: "USD" }).status, "OVER_BUDGET");
  assert.equal(compareBudget(unknown, { amount: 50, currency: "USD" }).status, "UNKNOWN");
});

test("solo low-budget public-transit intent remains independent of private-driver business model", () => {
  const solo: TripBriefV1 = { ...tripInputsToBrief(inputs), budget: { amount: 120, currency: "USD" },
    pace: "SLOW_TRAVEL", transportPreference: "PUBLIC_TRANSPORT" };
  const plan = buildTransportPlan(route, solo, matrix, { "Kandy>Ella": "BUS" });
  assert.equal(solo.travellerCount, 1);
  assert.equal(solo.comfortTier, "budget");
  assert.equal(plan.legs[0].mode, "BUS");
  assert.equal(plan.legs[0].durationMinutes, undefined);
});
