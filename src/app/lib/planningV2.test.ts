import assert from "node:assert/strict";
import { test } from "node:test";
import type { TripBriefV1 } from "./planningTypes";
import { planRouteConcepts, PlanningBriefError, type PlanningV2Services } from "./planningV2.ts";
import { CMB_AIRPORT } from "./planningV2Locations.ts";
import { planningV2Enabled } from "./planningV2Feature.ts";
import { returnToPlanningConcepts, selectPlanningConcept, selectedPlanningConcept,
  showPlanningConcepts } from "./planningV2Session.ts";
import type { MatrixLocation, RoadLeg, TravelMatrix } from "./travelTimeMatrix.ts";

const base: TripBriefV1 = {
  schemaVersion: 1, durationDays: 7, travellerCount: 2,
  budget: { amount: 2000, currency: "USD" }, interests: ["culture"],
  requestedCities: ["Kandy", "Ella", "Galle"], travelMonth: 2,
  transportPreference: "PRIVATE_DRIVER",
};

function matrix(locations: MatrixLocation[], overrides: Record<string, number | null> = {},
  failure?: TravelMatrix["failure"]): TravelMatrix {
  const legs: RoadLeg[][] = locations.map(from => locations.map(to => {
    const key = `${from.id}>${to.id}`;
    const duration = from.id === to.id ? 0 : overrides[key] === undefined ? 90 : overrides[key];
    if (!from.coordinates || !to.coordinates) return { fromId: from.id, toId: to.id, status: "MISSING_COORDINATES" };
    if (duration === null) return { fromId: from.id, toId: to.id, status: "UNROUTABLE", source: "OSRM_TABLE" };
    return { fromId: from.id, toId: to.id, status: "ROUTED", source: "OSRM_TABLE",
      durationMinutes: duration, distanceKm: duration };
  }));
  return { locations, legs, source: failure ? "UNAVAILABLE" : "OSRM_TABLE",
    generatedAt: "2026-10-13T00:00:00Z", ...(failure ? { failure } : {}) };
}
const services = (overrides: Record<string, number | null> = {}): PlanningV2Services => ({
  getMatrix: async locations => matrix(locations, overrides),
  now: () => "2026-10-13T00:00:00Z",
});

test("valid versioned brief produces three distinct ranked concepts", async () => {
  const result = await planRouteConcepts({ ...base, requestedCities: ["Ella", "Kandy", "Galle"] }, services());
  assert.equal(result.concepts.length, 3);
  assert.equal(new Set(result.concepts.map(item => item.routeConcept.id)).size, 3);
  assert.ok(result.concepts.every(item => item.routeConcept.schemaVersion === 1 && item.candidate.routingBasis === "ROAD_DRIVING"));
  assert.ok(result.concepts.every(item => item.routeConcept.stops.reduce((sum, stop) => sum + stop.nights, 0) === 6));
});

test("short single-base trip produces fewer concepts and keeps a requested place", async () => {
  const result = await planRouteConcepts({ ...base, durationDays: 2, requestedCities: ["Kandy"] }, services());
  assert.equal(result.concepts.length, 1);
  assert.equal(result.concepts[0].routeConcept.stops[0].destinationName, "Kandy");
});

test("excluded requested destinations have explicit reasons", async () => {
  const result = await planRouteConcepts({ ...base, durationDays: 2 }, services());
  assert.ok(result.concepts.some(item => item.issues.some(issue => issue.code === "REQUESTED_CITY_OMITTED")));
  assert.ok(result.concepts.some(item => item.routeConcept.tradeoffs.some(text => text.includes("requested destination"))));
});

test("seasonal cautions and strong monsoon conflicts remain visible", async () => {
  const result = await planRouteConcepts({ ...base, requestedCities: ["Mirissa"], travelMonth: 7 }, services());
  assert.ok(result.concepts[0].issues.some(issue => issue.code === "SEASON_AVOID"));
  assert.equal(result.concepts[0].routeConcept.seasonalAssessment?.status, "UNSUITABLE");
});

test("private-driver road time is an estimate and only those legs enter displayed driving totals", async () => {
  const result = await planRouteConcepts({ ...base, requestedCities: ["Kandy", "Ella"] },
    services({ "Kandy>Ella": 135, "Ella>Kandy": 150 }));
  const direct = result.concepts.find(item => item.candidate.destinations.map(stop => stop.name).join(">") === "Kandy>Ella")!;
  assert.equal(direct.knownDrivingMinutes, 135);
  assert.equal(direct.longestKnownDrivingLegMinutes, 135);
  assert.equal(direct.transport.legs[0].durationEvidence, "ESTIMATED");
  assert.equal(direct.transport.legs[0].routingSource, "OSRM_TABLE");
});

test("public transport never requests or inherits a car journey time", async () => {
  let requests = 0;
  const result = await planRouteConcepts({ ...base, transportPreference: "PUBLIC_TRANSPORT" }, {
    getMatrix: async locations => { requests += 1; return matrix(locations); },
    now: () => "2026-10-13T00:00:00Z",
  });
  assert.equal(requests, 0);
  assert.equal(result.matrix.source, "UNAVAILABLE");
  assert.ok(result.concepts.every(item => item.knownDrivingMinutes === undefined &&
    item.transport.legs.every(leg => leg.durationMinutes === undefined)));
  assert.ok(result.concepts.every(item => item.readiness === "NEEDS_CONFIRMATION"));
});

test("mixed mode keeps known private-driver legs and unknown bus legs separate", async () => {
  const result = await planRouteConcepts({ ...base, transportPreference: "MIXED" }, {
    ...services(), assignments: { "Kandy>Ella": "PRIVATE_DRIVER", "Ella>Galle": "BUS" },
  });
  const matching = result.concepts.find(item => item.transport.legs.map(leg => leg.mode).join(",") === "PRIVATE_DRIVER,BUS")!;
  assert.ok(matching);
  assert.equal(matching.transport.legs[0].durationMinutes, 90);
  assert.equal(matching.transport.legs[1].durationMinutes, undefined);
  assert.equal(matching.knownDrivingMinutes, 90);
  assert.equal(matching.readiness, "NEEDS_CONFIRMATION");
});

test("public transport does not inherit car-only rejection or car-score priority", async () => {
  const result = await planRouteConcepts({ ...base, requestedCities: ["Kandy", "Ella"],
    transportPreference: "PUBLIC_TRANSPORT" }, services({ "Kandy>Ella": 500 }));
  assert.ok(result.concepts.some(item => item.candidate.destinations.length === 2));
  assert.ok(result.concepts.every(item => !item.issues.some(issue => issue.code === "EXCESSIVE_DRIVING")));
});

test("routing timeout is uncertainty, not evidence of an impossible route", async () => {
  const result = await planRouteConcepts(base, { getMatrix: async locations => matrix(locations, {}, "TIMEOUT") });
  assert.equal(result.matrix.failure, "TIMEOUT");
  assert.ok(result.issues.some(issue => issue.code === "ROUTING_TIMEOUT"));
  assert.ok(result.concepts.some(item => item.readiness === "NEEDS_CONFIRMATION"));
});

test("unknown prices remain unpriced and do not become a zero-budget promise", async () => {
  const result = await planRouteConcepts(base, services());
  const first = result.concepts[0];
  assert.ok(first.ledger.summary.unknownCostCount >= 3);
  assert.equal(first.ledger.summary.wholeTripTotal, undefined);
  assert.equal(first.routeConcept.estimatedBudgetRange, undefined);
});

test("late CMB arrival uses a distinct airport endpoint and reduces usable first-day time", async () => {
  const brief: TripBriefV1 = { ...base, durationDays: 3, requestedCities: ["Kandy"],
    arrival: { location: CMB_AIRPORT.name, dateTime: "2026-07-01T20:30" } };
  const result = await planRouteConcepts(brief, services({ "CMB_AIRPORT>Kandy": 45 }));
  assert.equal(result.brief.arrival?.location, "CMB_AIRPORT");
  assert.ok(result.matrix.locations.some(location => location.id === "CMB_AIRPORT" &&
    location.coordinates?.latitude !== result.matrix.locations.find(item => item.id === "Negombo")?.coordinates?.latitude));
  assert.equal(result.concepts[0].candidate.firstDayUsableMinutes, 0);
});

test("early airport departure can reject a distant final stop", async () => {
  const brief: TripBriefV1 = { ...base, requestedCities: ["Ella"],
    departure: { location: "CMB", dateTime: "2026-10-13T09:00" } };
  const result = await planRouteConcepts(brief, services({ "Ella>CMB_AIRPORT": 330 }));
  assert.equal(result.concepts.length, 0);
  assert.ok(result.rejected.some(item => item.issues.some(issue => issue.code === "DEPARTURE_CONFLICT")));
  assert.ok(result.issues.some(issue => issue.code === "NO_FEASIBLE_CONCEPTS"));
});

test("selection preserves the brief and stable concept identity; invalid routes cannot be selected", async () => {
  const result = await planRouteConcepts(base, services());
  const comparing = showPlanningConcepts(result);
  const chosen = selectPlanningConcept(comparing, result.concepts[1].routeConcept.id);
  assert.equal(chosen.view, "selected");
  assert.equal(chosen.brief, result.brief);
  assert.equal(selectedPlanningConcept(chosen)?.routeConcept.id, result.concepts[1].routeConcept.id);
  assert.equal(returnToPlanningConcepts(chosen).view, "compare");
  assert.equal(selectPlanningConcept(comparing, result.rejected[0]?.routeConcept.id ?? "missing"), comparing);
  assert.equal("itinerary" in chosen, false);
  assert.equal("quoteRequest" in chosen, false);
});

test("invalid brief fails before network access", async () => {
  let requests = 0;
  await assert.rejects(planRouteConcepts({ ...base, durationDays: 0, interests: [] }, {
    getMatrix: async locations => { requests += 1; return matrix(locations); },
  }), PlanningBriefError);
  assert.equal(requests, 0);
});

test("network failure produces a recoverable unknown routing result", async () => {
  const result = await planRouteConcepts(base, { getMatrix: async () => { throw new Error("offline"); } });
  assert.equal(result.matrix.failure, "NETWORK_ERROR");
  assert.ok(result.issues.some(issue => issue.code === "ROUTING_UNAVAILABLE"));
  assert.ok(result.concepts.length > 0);
});

test("feature flag stays off by default and only exact opt-in exposes the V2 entry", () => {
  assert.equal(planningV2Enabled(undefined), false);
  assert.equal(planningV2Enabled("false"), false);
  assert.equal(planningV2Enabled("TRUE"), false);
  assert.equal(planningV2Enabled("true"), true);
});
