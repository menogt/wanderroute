import assert from "node:assert/strict";
import { test } from "node:test";
import type { CandidatePlace, PlanningItineraryV2, TripBriefV1 } from "./planningTypes";
import type { CandidateRoute } from "./routeTypes";
import type { TravelMatrix } from "./travelTimeMatrix";
import { buildTransportPlan } from "./transportPlanning.ts";
import { calculateCostLedger, type CostLineInput } from "./costLedger.ts";
import { validatePlanningItinerary, type ValidationInput } from "./itineraryValidation.ts";

const brief: TripBriefV1 = {
  schemaVersion: 1, durationDays: 3, travellerCount: 1,
  budget: { amount: 500, currency: "USD" }, interests: [],
  requestedCities: ["Kandy", "Ella"], comfortTier: "budget",
  travelMonth: 2, transportPreference: "PRIVATE_DRIVER",
};
const road = { fromId: "Kandy", toId: "Ella", status: "ROUTED" as const,
  source: "OSRM_TABLE" as const, durationMinutes: 120, distanceKm: 80 };
const route: CandidateRoute = {
  id: "route-1", routingBasis: "ROAD_DRIVING",
  destinations: [{ id: "Kandy", name: "Kandy", requested: true },
    { id: "Ella", name: "Ella", requested: true }],
  nights: [1, 1], legs: [road], reasons: [], feasibility: "FEASIBLE",
  score: { rankValue: 0, rankable: true,
    components: { requestedCoverage: 0, driving: 0, preferredDriving: 0, longestLeg: 0,
      season: 0, backtracking: 0, switching: 0, uncertainty: 0 } },
};
const matrix: TravelMatrix = {
  locations: route.destinations, source: "OSRM_TABLE", generatedAt: "2026-10-13T00:00:00Z",
  legs: [
    [{ fromId: "Kandy", toId: "Kandy", status: "ROUTED", durationMinutes: 0, distanceKm: 0 }, road],
    [{ ...road, fromId: "Ella", toId: "Kandy" },
      { fromId: "Ella", toId: "Ella", status: "ROUTED", durationMinutes: 0, distanceKm: 0 }],
  ],
};
const hotelLine: CostLineInput = {
  id: "hotel", category: "ACCOMMODATION", description: "Two nights", quantity: 1,
  periodCount: 2, periodUnit: "NIGHT", chargingBasis: "PER_ROOM",
  unitPrice: { kind: "EXACT", evidence: { amount: 25, currency: "USD", status: "KNOWN" } },
};

function activity(id: string, city: string, start: string, end: string): PlanningItineraryV2["days"][number]["items"][number] {
  return { id, city, time: start, plannedStart: start, plannedEnd: end,
    icon: "", label: id, detail: "", cost: 0, category: "activity" };
}
function itinerary(): PlanningItineraryV2 {
  return {
    schemaVersion: 2, id: "trip-1", routeConceptId: "route-1", routeName: "Kandy to Ella",
    routeSlogan: "", routeKey: "", cities: ["Kandy", "Ella"], totalDays: 3, totalPeople: 1,
    currency: "USD", estimatedCostPerPerson: 0, estimatedTotalCost: 0, inputBudget: 500,
    remainingBudget: 0, budgetStatus: "ok", travelStyle: "budget",
    costBreakdown: { hotels: 0, food: 0, transport: 0, activities: 0, entryFees: 0, misc: 0 },
    globalTips: [], warnings: [], highlights: [],
    days: [
      { day: 1, city: "Kandy", flag: "", heroGradient: "", accommodation: "Guesthouse",
        accommodationCostPerNight: 0, dailyCostPerPerson: 0, localTip: "",
        items: [activity("kandy", "Kandy", "10:00", "11:00")] },
      { day: 2, city: "Ella", flag: "", heroGradient: "", accommodation: "Guesthouse",
        accommodationCostPerNight: 0, dailyCostPerPerson: 0, localTip: "",
        items: [
          { id: "transfer", city: "Ella", time: "08:00", plannedStart: "08:00", plannedEnd: "10:00",
            icon: "", label: "Transfer", detail: "", cost: 0, category: "transport",
            transportLegId: "Kandy>Ella" },
          activity("ella", "Ella", "11:00", "12:00"),
        ] },
      { day: 3, city: "Ella", flag: "", heroGradient: "", accommodation: "",
        accommodationCostPerNight: 0, dailyCostPerPerson: 0, localTip: "",
        items: [activity("departure", "Ella", "09:00", "10:00")] },
    ],
  };
}
function fixture(): ValidationInput {
  return { brief: structuredClone(brief), route: structuredClone(route), matrix: structuredClone(matrix),
    itinerary: itinerary(), transportPlan: buildTransportPlan(route, brief, matrix),
    ledger: calculateCostLedger([hotelLine], "USD", 1) };
}
const codes = (input: ValidationInput) => validatePlanningItinerary(input).issues.map(issue => issue.code);

test("valid road itinerary is ready with reconciled accommodation and budget", () => {
  const result = validatePlanningItinerary(fixture());
  assert.equal(result.status, "READY");
  assert.equal(result.budget.status, "WITHIN_BUDGET");
  assert.deepEqual(result.issues, []);
});

test("overlapping activities and route-city mismatch invalidate the plan", () => {
  const input = fixture();
  input.itinerary.days[0].items.push(activity("overlap", "Kandy", "10:30", "11:30"));
  input.itinerary.days[2].city = "Galle";
  assert.equal(validatePlanningItinerary(input).status, "INVALID");
  assert.ok(codes(input).includes("ITEMS_OVERLAP"));
  assert.ok(codes(input).includes("ROUTE_CITY_MISMATCH"));
});

test("hard driving limit is an error and preferred driving limit is a warning", () => {
  const hard = fixture();
  hard.route.legs[0].durationMinutes = 400;
  hard.matrix.legs[0][1].durationMinutes = 400;
  hard.transportPlan = buildTransportPlan(hard.route, hard.brief, hard.matrix);
  hard.itinerary.days[1].items[0].plannedEnd = "14:40";
  hard.itinerary.days[1].items[1].plannedStart = "15:00";
  hard.itinerary.days[1].items[1].plannedEnd = "16:00";
  assert.ok(codes(hard).includes("HARD_DRIVING_LIMIT_EXCEEDED"));
  assert.equal(validatePlanningItinerary(hard).status, "INVALID");

  const preferred = fixture();
  preferred.route.legs[0].durationMinutes = 210;
  preferred.matrix.legs[0][1].durationMinutes = 210;
  preferred.transportPlan = buildTransportPlan(preferred.route, preferred.brief, preferred.matrix);
  preferred.itinerary.days[1].items[0].plannedEnd = "11:30";
  preferred.itinerary.days[1].items[1].plannedStart = "12:00";
  preferred.itinerary.days[1].items[1].plannedEnd = "13:00";
  assert.ok(codes(preferred).includes("PREFERRED_DRIVING_LIMIT_EXCEEDED"));
  assert.equal(validatePlanningItinerary(preferred).status, "READY_WITH_WARNINGS");
});

test("public transport timing remains unknown despite road matrix timing", () => {
  const input = fixture();
  input.brief.transportPreference = "PUBLIC_TRANSPORT";
  input.transportPlan = buildTransportPlan(input.route, input.brief, input.matrix,
    { "Kandy>Ella": "TRAIN" });
  const result = validatePlanningItinerary(input);
  assert.equal(input.transportPlan.legs[0].durationMinutes, undefined);
  assert.equal(result.status, "NEEDS_CONFIRMATION");
  assert.ok(result.unknowns.some(issue => issue.code === "TRANSPORT_TIME_UNKNOWN"));
  assert.ok(!result.errors.some(issue => issue.code === "HARD_DRIVING_LIMIT_EXCEEDED"));
});

test("arrival and departure activity windows enforce endpoint time", () => {
  const input = fixture();
  input.brief.arrival = { location: "Kandy", dateTime: "2026-02-01T10:00:00+05:30" };
  input.brief.departure = { location: "Ella", dateTime: "2026-02-03T12:00:00+05:30" };
  assert.ok(codes(input).includes("ARRIVAL_DAY_VIOLATION"));
  assert.ok(codes(input).includes("DEPARTURE_DAY_VIOLATION"));
  assert.equal(validatePlanningItinerary(input).status, "INVALID");
});

test("transfer timing and missing route legs are checked", () => {
  const short = fixture();
  short.itinerary.days[1].items[0].plannedEnd = "09:00";
  assert.ok(codes(short).includes("TRANSFER_TIME_INSUFFICIENT"));
  const missing = fixture();
  missing.transportPlan.legs = [];
  assert.ok(codes(missing).includes("ROUTE_LEG_MISSING"));
});

test("season caution propagates without a hard weather veto", () => {
  const input = fixture();
  input.brief.travelMonth = 7;
  const result = validatePlanningItinerary(input);
  assert.equal(result.status, "READY_WITH_WARNINGS");
  assert.ok(result.warnings.some(issue => issue.code === "SEASON_CAUTION"));
});

test("budget excess, range risk, and unknown costs have distinct readiness", () => {
  const over = fixture();
  over.brief.budget.amount = 20;
  assert.equal(validatePlanningItinerary(over).budget.status, "OVER_BUDGET");
  assert.equal(validatePlanningItinerary(over).status, "INVALID");
  const risk = fixture();
  risk.brief.budget.amount = 50;
  risk.ledger = calculateCostLedger([{ ...hotelLine, unitPrice: { kind: "RANGE", minimum: 20,
    maximum: 30, currency: "USD", provenance: { status: "ESTIMATED" } } }], "USD", 1);
  assert.equal(validatePlanningItinerary(risk).budget.status, "BUDGET_RISK");
  assert.equal(validatePlanningItinerary(risk).status, "READY_WITH_WARNINGS");
  const unknown = fixture();
  unknown.ledger = calculateCostLedger([{ ...hotelLine, unitPrice: { kind: "UNKNOWN" } }], "USD", 1);
  assert.equal(validatePlanningItinerary(unknown).budget.status, "UNKNOWN");
  assert.equal(validatePlanningItinerary(unknown).status, "NEEDS_CONFIRMATION");
});

test("untrusted place references and false verification invalidate the plan", () => {
  const input = fixture();
  input.itinerary.days[0].items[0].placeId = "missing";
  input.itinerary.days[0].items[0].placeEvidence = { status: "VERIFIED" };
  assert.ok(codes(input).includes("PLACE_ID_NOT_FOUND"));
  assert.ok(codes(input).includes("VERIFIED_PLACE_EVIDENCE_MISSING"));
  const trusted: CandidatePlace = { databaseId: "place-1", name: "Garden", city: "Kandy",
    category: "activity", coordinates: { latitude: 7.29, longitude: 80.64 } };
  input.trustedPlaces = [trusted];
  input.itinerary.days[0].items[0].placeId = "place-1";
  input.itinerary.days[0].items[0].placeEvidence = { status: "VERIFIED", source: "source", checkedAt: "2026-10-13" };
  input.itinerary.days[0].items[0].coordinates = { latitude: 6.9, longitude: 79.9 };
  assert.ok(codes(input).includes("PLACE_COORDINATES_MISMATCH"));
});

test("missing accommodation and tampered ledger are surfaced", () => {
  const input = fixture();
  input.itinerary.days[0].accommodation = "";
  input.ledger.summary.wholeTripTotal = 999;
  assert.ok(codes(input).includes("STAY_UNSPECIFIED"));
  assert.ok(codes(input).includes("LEDGER_OUT_OF_SYNC"));
  assert.equal(validatePlanningItinerary(input).status, "INVALID");
});

test("malformed times, misleading duration, and missing transfer windows remain visible", () => {
  const input = fixture();
  input.itinerary.days[0].items[0].plannedStart = "not-a-time";
  input.itinerary.days[1].items[0].durationMinutes = 30;
  assert.ok(codes(input).includes("ITEM_TIME_INVALID"));
  assert.ok(codes(input).includes("ITEM_DURATION_MISMATCH"));

  const unscheduled = fixture();
  unscheduled.itinerary.days[1].items[0].plannedEnd = undefined;
  assert.ok(codes(unscheduled).includes("TRANSFER_SCHEDULE_TIME_UNKNOWN"));
});

test("cost lines and trip identity must match their planning context", () => {
  const input = fixture();
  input.itinerary.totalPeople = 2;
  input.ledger = calculateCostLedger([{ ...hotelLine, day: 5 }], "USD", 1);
  assert.ok(codes(input).includes("ITINERARY_TRAVELLER_COUNT_MISMATCH"));
  assert.ok(codes(input).includes("COST_DAY_OUT_OF_RANGE"));
});
