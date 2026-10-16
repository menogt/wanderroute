import assert from "node:assert/strict";
import { test } from "node:test";
import { handler } from "../../../netlify/functions/generate-v2-itinerary.js";
import { planRouteConcepts, type PlanningV2Result } from "./planningV2.ts";
import { generatePlanningV2Itinerary } from "./planningV2Itinerary.ts";
import { validateAiActivityPlan, type AiActivityPlan } from "./planningV2ItineraryService.ts";
import { routeDayCities } from "./planningV2Scheduling.ts";
import { returnToPlanningConcepts, selectPlanningConcept, showPlanningConcepts,
  showPlanningItinerary } from "./planningV2Session.ts";
import { validatePlanningItinerary } from "./itineraryValidation.ts";
import type { CandidatePlace, TripBriefV1 } from "./planningTypes";
import type { MatrixLocation, RoadLeg, TravelMatrix } from "./travelTimeMatrix";

const brief: TripBriefV1 = { schemaVersion: 1, durationDays: 3, travellerCount: 1,
  budget: { amount: 800, currency: "USD" }, interests: ["culture"],
  requestedCities: ["Kandy", "Ella"], transportPreference: "PRIVATE_DRIVER", travelMonth: 2 };
const places: CandidatePlace[] = [
  { databaseId: "temple-kandy", name: "Kandy Temple", city: "Kandy", category: "temple",
    sourceProvider: "Place database", openingHours: { daily: { open: "10:00", close: "17:00" } } },
  { databaseId: "walk-ella", name: "Ella viewpoint", city: "Ella", category: "attraction",
    sourceProvider: "Place database" },
  { databaseId: "stay-kandy", name: "Kandy stay", city: "Kandy", category: "hotel" },
  { databaseId: "stay-ella", name: "Ella stay", city: "Ella", category: "hotel" },
];

function matrix(locations: MatrixLocation[], duration = 120): TravelMatrix {
  const legs: RoadLeg[][] = locations.map(from => locations.map(to => ({
    fromId: from.id, toId: to.id, status: "ROUTED", source: "OSRM_TABLE",
    durationMinutes: from.id === to.id ? 0 : duration, distanceKm: from.id === to.id ? 0 : 80,
  })));
  return { locations, legs, source: "OSRM_TABLE", generatedAt: "2026-10-16T00:00:00Z" };
}
async function route(input: TripBriefV1 = brief): Promise<PlanningV2Result> {
  return planRouteConcepts(input, { getMatrix: async locations => matrix(locations),
    now: () => "2026-10-16T00:00:00Z" });
}
function chosen(result: PlanningV2Result) {
  return result.concepts.find(concept => concept.candidate.destinations.map(stop => stop.name).join(">") ===
    result.brief.requestedCities.join(">")) ?? result.concepts[0];
}
function aiPlan(result: PlanningV2Result, selectedId: string, candidates = places): AiActivityPlan {
  const concept = result.concepts.find(item => item.routeConcept.id === selectedId)!;
  return { schemaVersion: 2, routeConceptId: selectedId,
    days: routeDayCities(concept.candidate, result.brief.durationDays).map((city, index) => ({
      day: index + 1, placeIds: candidates.filter(place => place.city === city &&
        ["temple", "attraction", "beach"].includes(place.category)).slice(0, 1).map(place => place.databaseId!),
      note: `Explore ${city}.`,
    })) };
}
async function detailed(result: PlanningV2Result, candidates = places) {
  const id = chosen(result).routeConcept.id;
  return generatePlanningV2Itinerary(result, id, { getPlaces: async () => candidates,
    getAiPlan: async () => aiPlan(result, id, candidates) });
}

test("selected concept fixes the day sequence and overnight allocation", async () => {
  const result = await route();
  const selected = chosen(result);
  const output = await detailed(result);
  assert.equal(output.itinerary.routeConceptId, selected.routeConcept.id);
  assert.deepEqual(output.itinerary.days.map(day => day.city), routeDayCities(selected.candidate, brief.durationDays));
  assert.equal(output.itinerary.days.length, brief.durationDays);
  assert.deepEqual(output.itinerary.days.filter(day => day.overnightCity).map(day => day.overnightCity),
    selected.candidate.destinations.flatMap((stop, index) => Array(selected.candidate.nights[index]).fill(stop.name)));
  assert.ok(output.itinerary.days.flatMap(day => day.items).some(item => item.transportLegId));
});

test("trusted place IDs survive generation; unknown AI IDs become a limited draft", async () => {
  const result = await route();
  const id = chosen(result).routeConcept.id;
  const output = await detailed(result);
  assert.ok(output.itinerary.days.flatMap(day => day.items).some(item => item.placeId === "temple-kandy"));
  assert.ok(output.itinerary.days.flatMap(day => day.items).every(item => !item.placeId ||
    places.some(place => place.databaseId === item.placeId)));
  const invalid = aiPlan(result, id);
  invalid.days[0].placeIds = ["invented-place"];
  assert.throws(() => validateAiActivityPlan(invalid, chosen(result).candidate, brief, places));
  const fallback = await generatePlanningV2Itinerary(result, id, { getPlaces: async () => places,
    getAiPlan: async () => invalid });
  assert.equal(fallback.generationMode, "LIMITED_DRAFT");
  assert.equal(fallback.readiness, "NEEDS_CONFIRMATION");
  assert.ok(fallback.itinerary.days.flatMap(day => day.items).every(item => item.placeId !== "invented-place"));
});

test("known opening hours guide scheduling; unknown hours stay uncertain", async () => {
  const result = await route();
  const output = await detailed(result);
  const kandy = output.itinerary.days.find(day => day.city === "Kandy")!;
  assert.equal(kandy.items.find(item => item.placeId === "temple-kandy")?.plannedStart, "10:00");
  assert.ok(output.validation.issues.some(issue => issue.code === "OPENING_HOURS_UNCONFIRMED"));
  const changed = structuredClone(output.itinerary);
  changed.days[0].items.find(item => item.placeId === "temple-kandy")!.plannedStart = "08:00";
  changed.days[0].items.find(item => item.placeId === "temple-kandy")!.plannedEnd = "09:30";
  const validation = validatePlanningItinerary({ itinerary: changed, brief: result.brief,
    route: chosen(result).candidate, matrix: result.matrix, transportPlan: chosen(result).transport,
    ledger: output.ledger, trustedPlaces: places });
  assert.ok(validation.issues.some(issue => issue.code === "OPENING_HOURS_CONFLICT"));
  assert.equal(validation.status, "INVALID");
});

test("arrival and departure windows leave unsafe activities unscheduled", async () => {
  const input = { ...brief, arrival: { location: "Kandy", dateTime: "2026-11-01T17:00" },
    departure: { location: "Ella", dateTime: "2026-11-03T10:00" } };
  const result = await route(input);
  const output = await detailed(result);
  assert.equal(output.itinerary.days[0].items.find(item => item.category === "activity")?.plannedStart, undefined);
  assert.equal(output.itinerary.days[2].items.find(item => item.category === "activity")?.plannedStart, undefined);
  assert.ok(!output.validation.issues.some(issue => ["ARRIVAL_DAY_VIOLATION", "DEPARTURE_DAY_VIOLATION"].includes(issue.code)));
});

test("public transport and mixed legs never inherit car schedule times", async () => {
  const publicResult = await route({ ...brief, transportPreference: "PUBLIC_TRANSPORT" });
  const publicOutput = await detailed(publicResult);
  const transfer = publicOutput.itinerary.days.flatMap(day => day.items).find(item => item.transportLegId);
  assert.equal(transfer?.plannedStart, undefined);
  assert.equal(transfer?.durationMinutes, undefined);
  assert.equal(publicOutput.readiness, "NEEDS_CONFIRMATION");
  const mixedResult = await planRouteConcepts({ ...brief, durationDays: 7, requestedCities: ["Kandy", "Ella", "Galle"],
    transportPreference: "MIXED" }, { getMatrix: async locations => matrix(locations),
    assignments: { "Kandy>Ella": "PRIVATE_DRIVER", "Ella>Galle": "BUS" } });
  const mixed = mixedResult.concepts.find(concept => concept.transport.legs.some(leg => leg.mode === "BUS"))!;
  const mixedOutput = await generatePlanningV2Itinerary(mixedResult, mixed.routeConcept.id,
    { getPlaces: async () => places, getAiPlan: async () => aiPlan(mixedResult, mixed.routeConcept.id) });
  const bus = mixed.transport.legs.find(leg => leg.mode === "BUS")!;
  const busItem = mixedOutput.itinerary.days.flatMap(day => day.items).find(item => item.transportLegId === bus.id);
  assert.equal(busItem?.durationMinutes, undefined);
  assert.equal(busItem?.plannedStart, undefined);
});

test("solo low-budget trip has unknown prices without an assumed driver", async () => {
  const result = await route({ ...brief, budget: { amount: 120, currency: "USD" },
    transportPreference: "PUBLIC_TRANSPORT" });
  const output = await detailed(result);
  assert.ok(output.ledger.summary.unknownCostCount > 0);
  assert.equal(output.ledger.summary.trip.exact, undefined);
  assert.equal(output.itinerary.estimatedTotalCost, undefined);
  assert.ok(chosen(result).transport.legs.every(leg => leg.mode !== "PRIVATE_DRIVER"));
  assert.equal(output.validation.budget.status, "UNKNOWN");
});

test("sourced prices convert once, reconcile by day and category, and flag over-budget", async () => {
  const priced = places.map(place => place.databaseId === "temple-kandy" ? { ...place,
    priceBasis: "PER_PERSON" as const, priceEvidence: { amount: 900, currency: "USD" as const,
      status: "KNOWN" as const, source: "Test source" } } : place);
  const result = await route({ ...brief, budget: { amount: 100, currency: "EUR" } });
  const id = chosen(result).routeConcept.id;
  const output = await generatePlanningV2Itinerary(result, id, { getPlaces: async () => priced,
    getAiPlan: async () => aiPlan(result, id, priced),
    exchangeRates: [{ from: "USD", to: "EUR", rate: 0.9, source: "Test FX" }] });
  const fee = output.ledger.lines.find(line => line.input.id.includes("temple-kandy"))!;
  assert.equal(fee.total?.minimum, 810);
  assert.equal(output.ledger.summary.byCategory.ENTRY_FEES.minimum, 810);
  assert.equal(output.ledger.summary.byDay[1].minimum, 810);
  assert.equal(output.ledger.summary.trip.minimum, 810);
  assert.equal(output.validation.budget.status, "OVER_BUDGET");
  assert.equal(output.readiness, "INVALID");
});

test("excessive private-driver time cannot be marked ready", async () => {
  const result = await route();
  const selected = chosen(result);
  const output = await detailed(result);
  const changed = structuredClone(selected.transport);
  changed.legs[0].durationMinutes = 500;
  const validation = validatePlanningItinerary({ itinerary: output.itinerary, brief: result.brief,
    route: selected.candidate, matrix: result.matrix, transportPlan: changed,
    ledger: output.ledger, trustedPlaces: places });
  assert.equal(validation.status, "INVALID");
  assert.ok(validation.issues.some(issue => issue.code === "HARD_DRIVING_LIMIT_EXCEEDED"));
});

test("session retains route and prevents stale detail from replacing another selection", async () => {
  const result = await route();
  assert.ok(result.concepts.length >= 2);
  const first = selectPlanningConcept(showPlanningConcepts(result), result.concepts[0].routeConcept.id);
  const firstDetail = await generatePlanningV2Itinerary(result, first.selectedConceptId!,
    { getPlaces: async () => places, getAiPlan: async () => aiPlan(result, first.selectedConceptId!) });
  const second = selectPlanningConcept(returnToPlanningConcepts(first), result.concepts[1].routeConcept.id);
  const ignored = showPlanningItinerary(second, first.selectedConceptId!, firstDetail);
  assert.equal(ignored, second);
  assert.equal(ignored.selectedConceptId, result.concepts[1].routeConcept.id);
});

test("V2 endpoint rejects malformed JSON and invented place IDs without touching V1", async () => {
  const request = { schemaVersion: 2, routeConceptId: "route-a", interests: ["culture"], pace: "BALANCED",
    days: [{ day: 1, city: "Kandy", places: [{ id: "temple-kandy", name: "Kandy Temple", category: "temple" }] },
      { day: 2, city: "Kandy", places: [] }] };
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = "test-only";
  try {
    for (const content of ["{bad json", JSON.stringify({ schemaVersion: 2, routeConceptId: "route-a",
      days: [{ day: 1, placeIds: ["invented"] }, { day: 2, placeIds: [] }] })]) {
      globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
      const response = await handler({ httpMethod: "POST", body: JSON.stringify(request) });
      assert.equal(response.statusCode, 502);
      assert.equal(JSON.parse(response.body).code, "MODEL_OUTPUT_INVALID");
    }
    const bad = await handler({ httpMethod: "POST", body: JSON.stringify({ ...request, days: [] }) });
    assert.equal(bad.statusCode, 400);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = originalKey;
  }
});
