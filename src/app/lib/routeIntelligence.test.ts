import assert from "node:assert/strict";
import { test } from "node:test";
import type { TripBriefV1 } from "./planningTypes";
import { buildCandidateDestinations, generateRouteCandidates, knownPlanningDestinations } from "./routeCandidates.ts";
import {
  arrivalDayUsableMinutes, arrivalTransferBudgetMinutes, assessRouteConstraints,
  departureDayUsableMinutes, departureTransferBudgetMinutes, drivingLimits, maximumPlanningBases,
} from "./routeConstraints.ts";
import { assessPlanningSeason, planningSeasonMonth } from "./routeSeason.ts";
import { matrixLeg, type MatrixLocation, type RoadLeg, type RoadLegStatus, type TravelMatrix } from "./travelTimeMatrix.ts";

const known = knownPlanningDestinations();
const cmb: MatrixLocation = { id: "CMB", name: "CMB", coordinates: { latitude: 7.2, longitude: 79.9 } };
const base: TripBriefV1 = {
  schemaVersion: 1, durationDays: 7, travellerCount: 2,
  budget: { amount: 2000, currency: "USD" }, interests: ["culture"],
  requestedCities: [], comfortTier: "comfort", travelMonth: 2, pace: "BALANCED",
};

/** Synthetic OSRM-shaped fixture; these values never enter production code. */
function fixtureMatrix(
  names: string[], minutes: Record<string, number | null> = {},
  statuses: Record<string, RoadLegStatus> = {}
): TravelMatrix {
  const locations = names.map(name => known.find(item => item.name === name) ??
    (name === "CMB" ? cmb : { id: name, name }));
  const legs: RoadLeg[][] = locations.map(from => locations.map(to => {
    const key = `${from.id}>${to.id}`;
    const status = statuses[key] ?? (!from.coordinates || !to.coordinates ? "MISSING_COORDINATES" :
      minutes[key] === null ? "UNROUTABLE" : "ROUTED");
    const duration = from.id === to.id ? 0 : minutes[key] ?? 60;
    return { fromId: from.id, toId: to.id, status,
      ...(status === "ROUTED" || status === "PARTIAL" ? { durationMinutes: duration, distanceKm: duration } : {}),
      ...(status === "ROUTED" || status === "PARTIAL" ? { source: "OSRM_TABLE" as const } : {}),
    };
  }));
  return { locations, legs, source: "OSRM_TABLE", generatedAt: "2026-10-09T00:00:00Z" };
}

function routes(brief: TripBriefV1, matrix: TravelMatrix) {
  return generateRouteCandidates(brief, buildCandidateDestinations(brief, matrix.locations), matrix);
}
function codes(reasons: { code: string }[]) { return reasons.map(reason => reason.code); }
function order(route: { destinations: { name: string }[] }) { return route.destinations.map(destination => destination.name).join(">"); }

test("2-day late CMB arrival has no sightseeing first day and one night", () => {
  const brief = { ...base, durationDays: 2, requestedCities: ["Negombo"],
    arrival: { location: "CMB", dateTime: "2026-07-01T20:30:00+05:30" } };
  const result = routes(brief, fixtureMatrix(["CMB", "Negombo"], { "CMB>Negombo": 30 }));
  assert.equal(result[0].firstDayUsableMinutes, 0);
  assert.deepEqual(result[0].nights, [1]);
  assert.equal(result[0].feasibility, "FEASIBLE");
  assert.equal(arrivalTransferBudgetMinutes(brief), 120);
});

test("7-day balanced auto route uses current city seed and allocates six nights", () => {
  const destinations = buildCandidateDestinations(base);
  const result = routes(base, fixtureMatrix(destinations.map(destination => destination.name)));
  assert.ok(result.length > 1);
  assert.equal(result[0].nights.reduce((sum, value) => sum + value, 0), 6);
  assert.equal(result[0].feasibility, "FEASIBLE");
});

test("10-day relaxed route limits base switching and preserves nine nights", () => {
  const brief = { ...base, durationDays: 10, pace: "RELAXED" as const };
  const names = buildCandidateDestinations(brief).map(destination => destination.name);
  const result = routes(brief, fixtureMatrix(names));
  assert.ok(result[0].destinations.length <= 4);
  assert.equal(result[0].nights.reduce((sum, value) => sum + value, 0), 9);
  assert.ok(result.some(route => codes(route.reasons).includes("INSUFFICIENT_DAYS")));
});

test("14-day packed route remains bounded and allocates thirteen nights", () => {
  const brief = { ...base, durationDays: 14, pace: "PACKED" as const };
  const names = buildCandidateDestinations(brief).map(destination => destination.name);
  const result = routes(brief, fixtureMatrix(names));
  assert.ok(result.length > 0);
  assert.ok(result[0].destinations.length <= 8);
  assert.equal(result[0].nights.reduce((sum, value) => sum + value, 0), 13);
});

test("explicit heavy backtracking order is retained but penalized", () => {
  const brief = { ...base, requestedCities: ["Galle", "Kandy", "Mirissa"] };
  const result = routes(brief, fixtureMatrix(brief.requestedCities));
  const requested = result.find(route => order(route) === "Galle>Kandy>Mirissa")!;
  assert.ok(requested);
  assert.ok(codes(requested.reasons).includes("BACKTRACKING"));
  assert.ok(result.some(route => route.score.components.backtracking === 0));
});

test("explicit cities that cannot fit are named in reduced and rejected routes", () => {
  const brief = { ...base, durationDays: 2, requestedCities: ["Kandy", "Ella", "Galle"] };
  const result = routes(brief, fixtureMatrix(brief.requestedCities));
  assert.ok(result.some(route => codes(route.reasons).includes("REQUESTED_CITY_OMITTED")));
  assert.ok(result.some(route => route.feasibility === "REJECTED" && codes(route.reasons).includes("INSUFFICIENT_DAYS")));
  const named = new Set(result.flatMap(route => route.reasons.flatMap(reason => reason.destinations ?? [])));
  assert.ok([...brief.requestedCities].some(city => named.has(city)));
});

test("Mirissa in July is penalized, not hard-rejected by weather alone", () => {
  assert.equal(assessPlanningSeason("Mirissa", 7).status, "AVOID");
  const brief = { ...base, travelMonth: 7, requestedCities: ["Mirissa"] };
  const result = routes(brief, fixtureMatrix(["Mirissa"]));
  assert.equal(result[0].feasibility, "FEASIBLE");
  assert.ok(codes(result[0].reasons).includes("SEASON_AVOID"));
});

test("east coast is suitable in southwest-monsoon months", () => {
  assert.equal(assessPlanningSeason("Arugam Bay", 7).status, "SUITABLE");
  assert.equal(assessPlanningSeason("Trincomalee", 7).status, "SUITABLE");
});

test("east coast receives northeast-monsoon avoidance in January", () => {
  const assessment = assessPlanningSeason("Trincomalee", 1);
  assert.equal(assessment.status, "AVOID");
  assert.match(assessment.rule!, /north-east monsoon/);
});

test("unknown city or month stays unknown", () => {
  assert.equal(assessPlanningSeason("Atlantis", 7).status, "UNKNOWN");
  assert.equal(assessPlanningSeason("Mirissa").status, "UNKNOWN");
});

test("same-month dates supply season month, while cross-month dates stay unknown", () => {
  assert.equal(planningSeasonMonth({ ...base, travelMonth: undefined,
    travelDates: { start: "2026-07-03", end: "2026-07-10" } }), 7);
  assert.equal(planningSeasonMonth({ ...base, travelMonth: undefined,
    travelDates: { start: "2026-07-30", end: "2026-08-04" } }), undefined);
  assert.equal(planningSeasonMonth({ ...base, travelMonth: undefined,
    travelDates: { start: "2026-07-03" } }), undefined);
});

test("late arrival and early departure windows use conservative ends", () => {
  const brief = { ...base,
    arrival: { window: { earliest: "18:00", latest: "20:30" } },
    departure: { window: { earliest: "09:00", latest: "12:00" } },
  };
  assert.equal(arrivalDayUsableMinutes(brief), 0);
  assert.equal(departureDayUsableMinutes(brief), 0);
  assert.equal(departureTransferBudgetMinutes(brief), 120);
  assert.ok(maximumPlanningBases(brief) < maximumPlanningBases(base));
});

test("a trip with neither an arrival nor departure sightseeing day is rejected", () => {
  const brief = { ...base, durationDays: 2, requestedCities: ["Negombo"],
    arrival: { dateTime: "20:30" }, departure: { dateTime: "09:00" } };
  const result = routes(brief, fixtureMatrix(["Negombo"]));
  assert.equal(result[0].feasibility, "REJECTED");
  assert.ok(codes(result[0].reasons).includes("INSUFFICIENT_DAYS"));
});

test("early CMB departure rejects a distant final night", () => {
  const brief = { ...base, requestedCities: ["Ella"],
    departure: { location: "CMB", dateTime: "2026-10-09T09:00:00+05:30" } };
  const result = routes(brief, fixtureMatrix(["Ella", "CMB"], { "Ella>CMB": 330 }));
  assert.equal(result[0].feasibility, "REJECTED");
  assert.ok(codes(result[0].reasons).includes("DEPARTURE_CONFLICT"));
});

test("arrival transfer rejects a distant first night after late arrival", () => {
  const brief = { ...base, requestedCities: ["Kandy"],
    arrival: { location: "CMB", dateTime: "2026-10-09T20:30:00+05:30" } };
  const result = routes(brief, fixtureMatrix(["CMB", "Kandy"], { "CMB>Kandy": 180 }));
  assert.ok(codes(result[0].reasons).includes("ARRIVAL_CONFLICT"));
});

test("preferred drive limit penalizes while hard limit rejects", () => {
  const brief = { ...base, requestedCities: ["Kandy", "Ella"] };
  const destinations = buildCandidateDestinations(brief);
  const preferredMatrix = fixtureMatrix(brief.requestedCities, { "Kandy>Ella": 210 });
  const preferred = assessRouteConstraints(brief, destinations, [matrixLeg(preferredMatrix, "Kandy", "Ella")!], preferredMatrix);
  assert.ok(codes(preferred).includes("PREFERRED_DRIVING_EXCEEDED"));
  assert.equal(preferred.some(reason => reason.severity === "REJECTION"), false);
  const hardMatrix = fixtureMatrix(brief.requestedCities, { "Kandy>Ella": 400 });
  const hard = assessRouteConstraints(brief, destinations, [matrixLeg(hardMatrix, "Kandy", "Ella")!], hardMatrix);
  assert.ok(codes(hard).includes("EXCESSIVE_DRIVING"));
  assert.equal(hard.find(reason => reason.code === "EXCESSIVE_DRIVING")?.severity, "REJECTION");
});

test("traveller drive preference changes limits but comfort tier does not", () => {
  const budget = drivingLimits({ ...base, comfortTier: "budget" });
  const luxury = drivingLimits({ ...base, comfortTier: "luxury" });
  assert.deepEqual(budget, luxury);
  assert.equal(drivingLimits({ ...base, maxPreferredDailyDrivingMinutes: 100 }).preferredMinutes, 100);
  assert.ok(drivingLimits({ ...base, pace: "PACKED" }).hardMinutes > drivingLimits({ ...base, pace: "SLOW_TRAVEL" }).hardMinutes);
});

test("unroutable leg rejects; unavailable routing remains uncertainty", () => {
  const brief = { ...base, requestedCities: ["Kandy", "Ella"] };
  const unroutable = routes(brief, fixtureMatrix(brief.requestedCities, { "Kandy>Ella": null, "Ella>Kandy": null }));
  assert.equal(unroutable[0].feasibility, "REJECTED");
  assert.ok(codes(unroutable[0].reasons).includes("UNROUTABLE"));
  const unavailable = routes(brief, fixtureMatrix(brief.requestedCities, {}, {
    "Kandy>Ella": "UNAVAILABLE", "Ella>Kandy": "UNAVAILABLE",
  }));
  assert.equal(unavailable[0].feasibility, "UNCERTAIN");
  assert.ok(codes(unavailable[0].reasons).includes("ROUTING_UNKNOWN"));
});

test("requested destination without coordinates stays present and uncertain", () => {
  const brief = { ...base, requestedCities: ["Kandy", "Atlantis"] };
  const destinations = buildCandidateDestinations(brief);
  assert.ok(destinations.some(destination => destination.name === "Atlantis" && !destination.coordinates));
  const result = routes(brief, fixtureMatrix(["Kandy", "Atlantis"]));
  assert.ok(result.some(route => route.destinations.some(destination => destination.name === "Atlantis")));
  assert.ok(result.some(route => codes(route.reasons).includes("REQUESTED_CITY_UNAVAILABLE")));
});

test("slow travel favors fewer bases while packed can keep more", () => {
  const names = ["Negombo", "Sigiriya", "Kandy", "Ella", "Galle"];
  const matrix = fixtureMatrix(names);
  const slow = routes({ ...base, pace: "SLOW_TRAVEL", requestedCities: names }, matrix);
  const packed = routes({ ...base, pace: "PACKED", requestedCities: names }, matrix);
  assert.ok(slow[0].destinations.length <= 3);
  assert.equal(packed[0].destinations.length, 5);
  assert.ok(slow[0].score.components.switching < 0);
});

test("canonical order remains a valid heuristic input", () => {
  const brief = { ...base, requestedCities: ["Galle", "Sigiriya", "Kandy"] };
  const result = routes(brief, fixtureMatrix(brief.requestedCities));
  assert.ok(result.some(route => order(route) === "Sigiriya>Kandy>Galle" && route.feasibility === "FEASIBLE"));
});

test("backtracking decreases the inspectable score", () => {
  const brief = { ...base, requestedCities: ["Galle", "Kandy", "Mirissa"] };
  const result = routes(brief, fixtureMatrix(brief.requestedCities));
  const backtrack = result.find(route => order(route) === "Galle>Kandy>Mirissa")!;
  const monotonic = result.find(route => order(route) === "Kandy>Mirissa>Galle")!;
  assert.ok(backtrack.score.components.backtracking < monotonic.score.components.backtracking);
  assert.ok(backtrack.score.rankValue < monotonic.score.rankValue);
});

test("unknown arrival time and endpoint are reported without invented flight times", () => {
  const brief = { ...base, requestedCities: ["Negombo"], arrival: { location: "CMB" } };
  const result = routes(brief, fixtureMatrix(["Negombo", "CMB"]));
  assert.ok(codes(result[0].reasons).includes("ARRIVAL_TIME_UNKNOWN"));
  assert.equal(result[0].firstDayUsableMinutes, undefined);
  const missingEndpoint = routes({ ...brief, arrival: { location: "Unknown Airport", dateTime: "20:30" } }, fixtureMatrix(["Negombo"]));
  assert.ok(codes(missingEndpoint[0].reasons).includes("ENDPOINT_UNKNOWN"));
});

test("hard-rejected routes never rank beside feasible candidates", () => {
  const brief = { ...base, requestedCities: ["Kandy", "Ella"] };
  const result = routes(brief, fixtureMatrix(brief.requestedCities, { "Kandy>Ella": 400, "Ella>Kandy": 60 }));
  assert.equal(result[0].feasibility, "FEASIBLE");
  assert.equal(result[0].score.rankable, true);
  assert.ok(result.some(route => route.feasibility === "REJECTED" && !route.score.rankable));
});

test("the pure generator never invokes global fetch", () => {
  const previous = globalThis.fetch;
  globalThis.fetch = (() => { throw new Error("live API call"); }) as typeof fetch;
  try {
    const brief = { ...base, requestedCities: ["Kandy"] };
    assert.ok(routes(brief, fixtureMatrix(["Kandy"])).length > 0);
  } finally {
    globalThis.fetch = previous;
  }
});
