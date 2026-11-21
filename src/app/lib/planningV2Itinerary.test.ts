import assert from "node:assert/strict";
import { test } from "node:test";
import { setIndicativePricing } from "./indicativePrices.ts";
import { handler } from "../../../netlify/functions/generate-v2-itinerary.js";
import { planRouteConcepts, type PlanningV2Result } from "./planningV2.ts";
import { generatePlanningV2Itinerary } from "./planningV2Itinerary.ts";
import { requestAiActivityPlan, validateAiActivityPlan, type AiActivityPlan } from "./planningV2ItineraryService.ts";
import { routeDayCities, schedulePlanningDays } from "./planningV2Scheduling.ts";
import { returnToPlanningConcepts, selectPlanningConcept, showPlanningConcepts,
  showPlanningItinerary } from "./planningV2Session.ts";
import { validatePlanningItinerary } from "./itineraryValidation.ts";
import type { CandidatePlace, TripBriefV1 } from "./planningTypes";
import type { MatrixLocation, RoadLeg, TravelMatrix } from "./travelTimeMatrix";
// This file checks sourced, recorded and allowance arithmetic on its own; estimates are tested in indicativePrices.test.ts.
setIndicativePricing(false);

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
  const used = new Set<string>();
  return { schemaVersion: 2, routeConceptId: selectedId,
    days: routeDayCities(concept.candidate, result.brief.durationDays).map((city, index) => ({
      day: index + 1, placeIds: candidates.filter(place => place.city === city &&
        ["temple", "attraction", "beach"].includes(place.category) && !used.has(place.databaseId!)).slice(0, 1).map(place => { used.add(place.databaseId!); return place.databaseId!; }),
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

test("AI extras cannot override validated place IDs or inject misclassified venues", async () => {
  const result = await route();
  const selected = chosen(result);
  const restaurant: CandidatePlace = { databaseId: "restaurant-kandy", name: "Balaji Dosai",
    city: "Kandy", category: "temple", sourceProvider: "foursquare" };
  const candidates = [...places, restaurant];
  const untrusted = aiPlan(result, selected.routeConcept.id);
  Object.assign(untrusted.days[0], { activities: [{ id: "injected-item",
    placeId: restaurant.databaseId, description: "Recommended temple" }] });
  const validated = validateAiActivityPlan(untrusted, selected.candidate, result.brief, candidates);
  assert.equal(Object.prototype.hasOwnProperty.call(validated.days[0], "activities"), false);
  const output = await generatePlanningV2Itinerary(result, selected.routeConcept.id, {
    getPlaces: async () => candidates, getAiPlan: async () => untrusted,
  });
  assert.ok(output.itinerary.days.flatMap(day => day.items).some(item => item.placeId === "temple-kandy"));
  assert.ok(output.itinerary.days.flatMap(day => day.items).every(item =>
    item.placeId !== restaurant.databaseId && item.id !== "injected-item"));
  const selections = validated.days.map(day => ({ placeIds: [...day.placeIds] }));
  selections[0].placeIds = [restaurant.databaseId!];
  assert.throws(() => schedulePlanningDays(result.brief, selected.candidate,
    selected.transport, candidates, selections));
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

test("V2 endpoint keeps the valid part of a flawed model reply instead of discarding it", async () => {
  const places = (city: string, ids: string[]) => ids.map(id => ({ id, name: id, category: "attraction" }));
  const request = { schemaVersion: 2, routeConceptId: "route-a", interests: ["culture"], pace: "BALANCED",
    days: [{ day: 1, city: "Kandy", places: places("Kandy", ["k1", "k2", "k3"]) },
      { day: 2, city: "Kandy", places: places("Kandy", ["k1", "k2", "k3"]) },
      { day: 3, city: "Ella", places: places("Ella", ["e1"]) }] };
  const reply = { schemaVersion: 2, routeConceptId: "route-typo", days: [
    { day: 1, placeIds: ["k1", "invented", "k2", "k3"], note: "x".repeat(300),
      descriptions: [{ placeId: "k1", text: "Lovely" }, { placeId: "invented", text: "Made up" }] },
    { day: 2, placeIds: ["k1", "k3"] },
  ] };
  const saved = { groq: process.env.GROQ_API_KEY, openrouter: process.env.OPENROUTER_API_KEY, backup: process.env.GROQ_FALLBACK_MODEL };
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => { calls++; return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }] }), { status: 200 }); }) as typeof fetch;
  try {
    process.env.GROQ_API_KEY = "test-only";
    delete process.env.OPENROUTER_API_KEY; delete process.env.GROQ_FALLBACK_MODEL;
    const response = await handler({ httpMethod: "POST", body: JSON.stringify(request) });
    assert.equal(response.statusCode, 200);
    assert.equal(calls, 1);
    const plan = JSON.parse(response.body).plan;
    assert.equal(plan.routeConceptId, "route-a");
    assert.deepEqual(plan.days.map((day: { placeIds: string[] }) => day.placeIds), [["k1", "k2"], ["k3"], []]);
    assert.equal(plan.days[0].note.length, 240);
    assert.deepEqual(plan.days[0].descriptions, [{ placeId: "k1", text: "Lovely" }]);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of [["GROQ_API_KEY", saved.groq], ["OPENROUTER_API_KEY", saved.openrouter],
      ["GROQ_FALLBACK_MODEL", saved.backup]] as const) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

test("V2 endpoint falls back to OpenRouter only when Groq fails and a fallback key is configured", async () => {
  const request = { schemaVersion: 2, routeConceptId: "route-a", interests: ["culture"], pace: "BALANCED",
    days: [{ day: 1, city: "Kandy", places: [{ id: "temple-kandy", name: "Kandy Temple", category: "temple" }] },
      { day: 2, city: "Kandy", places: [] }] };
  const valid = JSON.stringify({ schemaVersion: 2, routeConceptId: "route-a",
    days: [{ day: 1, placeIds: ["temple-kandy"] }, { day: 2, placeIds: [] }] });
  const saved = { groq: process.env.GROQ_API_KEY, openrouter: process.env.OPENROUTER_API_KEY,
    backup: process.env.GROQ_FALLBACK_MODEL };
  const originalFetch = globalThis.fetch;
  const calls: { url: string; body: any }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    return url.includes("groq.com")
      ? new Response(JSON.stringify({ error: { code: "rate_limit_exceeded" } }), { status: 429 })
      : new Response(JSON.stringify({ choices: [{ message: { content: valid } }] }), { status: 200 });
  }) as typeof fetch;
  try {
    process.env.GROQ_API_KEY = "test-only";
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.GROQ_FALLBACK_MODEL;
    const groqOnly = await handler({ httpMethod: "POST", body: JSON.stringify(request) });
    assert.equal(groqOnly.statusCode, 502);
    assert.equal(JSON.parse(groqOnly.body).code, "GROQ_API_ERROR");
    // Groq limits are per model, so the free backup models are tried before giving up.
    assert.deepEqual(calls.map(call => call.body.model), ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]);
    assert.match(calls[0].body.messages[1].content, /Select zero to 2 IDs per day/);
    // Each model gets reasoning settings it accepts.
    assert.equal(calls[1].body.reasoning_effort, "low");
    assert.equal(calls[1].body.reasoning_format, undefined);
    assert.equal(calls[2].body.reasoning_effort, "none");
    assert.equal(calls[2].body.reasoning_format, "hidden");
    assert.equal(groqOnly.headers["X-WanderRoute-Model"], undefined);

    process.env.GROQ_FALLBACK_MODEL = "qwen/qwen3.8-27b, openai/gpt-oss-120b";
    calls.length = 0;
    await handler({ httpMethod: "POST", body: JSON.stringify(request) });
    assert.deepEqual(calls.map(call => call.body.model), ["openai/gpt-oss-120b", "qwen/qwen3.8-27b"]);

    process.env.GROQ_FALLBACK_MODEL = "none";
    calls.length = 0;
    await handler({ httpMethod: "POST", body: JSON.stringify(request) });
    assert.equal(calls.length, 1);

    process.env.OPENROUTER_API_KEY = "test-only";
    calls.length = 0;
    const withFallback = await handler({ httpMethod: "POST", body: JSON.stringify(request) });
    assert.equal(withFallback.statusCode, 200);
    assert.deepEqual(JSON.parse(withFallback.body).plan.days[0].placeIds, ["temple-kandy"]);
    assert.deepEqual(calls.map(call => new URL(call.url).hostname), ["api.groq.com", "openrouter.ai"]);
    assert.equal(calls[1].body.model, "openai/gpt-oss-120b");
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of [["GROQ_API_KEY", saved.groq], ["OPENROUTER_API_KEY", saved.openrouter],
      ["GROQ_FALLBACK_MODEL", saved.backup]] as const) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});


test("V2 endpoint serves the plan from the backup Groq model when the main model is rate limited", async () => {
  const request = { schemaVersion: 2, routeConceptId: "route-a", interests: ["culture"], pace: "BALANCED",
    days: [{ day: 1, city: "Kandy", places: [{ id: "temple-kandy", name: "Kandy Temple", category: "temple" }] },
      { day: 2, city: "Kandy", places: [] }] };
  const valid = JSON.stringify({ schemaVersion: 2, routeConceptId: "route-a",
    days: [{ day: 1, placeIds: ["temple-kandy"] }, { day: 2, placeIds: [] }] });
  const saved = { groq: process.env.GROQ_API_KEY, openrouter: process.env.OPENROUTER_API_KEY,
    backup: process.env.GROQ_FALLBACK_MODEL };
  const originalFetch = globalThis.fetch;
  const models: string[] = [];
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    const model = JSON.parse(String(init.body)).model;
    models.push(model);
    return model === "openai/gpt-oss-120b"
      ? new Response(JSON.stringify({ error: { code: "rate_limit_exceeded" } }), { status: 429 })
      : new Response(JSON.stringify({ choices: [{ message: { content: valid } }] }), { status: 200 });
  }) as typeof fetch;
  try {
    process.env.GROQ_API_KEY = "test-only";
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.GROQ_FALLBACK_MODEL;
    const result = await handler({ httpMethod: "POST", body: JSON.stringify(request) });
    assert.equal(result.statusCode, 200);
    assert.deepEqual(JSON.parse(result.body).plan.days[0].placeIds, ["temple-kandy"]);
    assert.deepEqual(models, ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]);
    assert.equal(result.headers["X-WanderRoute-Model"], "openai/gpt-oss-20b");
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of [["GROQ_API_KEY", saved.groq], ["OPENROUTER_API_KEY", saved.openrouter],
      ["GROQ_FALLBACK_MODEL", saved.backup]] as const) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

test("fallback distributes distinct places, retains multiple activities and does not assign arbitrary hotels", async () => {
  const input = { ...brief, durationDays: 4, requestedCities: ["Kandy"] };
  const result = await route(input);
  const candidates = [...places, ...Array.from({length: 5}, (_, i) => ({ databaseId: `sight-${i}`, city: "Kandy", category: "attraction", name: `Sight ${i}` }))];
  const detail = await generatePlanningV2Itinerary(result, result.concepts[0].routeConcept.id, {
    getPlaces: async () => candidates, getAiPlan: async () => { throw new Error("unavailable"); } });
  const ids = detail.itinerary.days.flatMap(day => day.items.filter(item => item.category === "activity").map(item => item.placeId));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(detail.itinerary.days[0].items.filter(item => item.category === "activity").length, 2);
  assert.ok(detail.itinerary.days.every(day => !day.accommodationPlaceId));
  assert.equal(detail.generationMode, "LIMITED_DRAFT");
});

test("23:00 arrival permits a nearby overnight transfer with explicit next-day clocks and recovery", async () => {
  const input: TripBriefV1 = { ...brief, durationDays: 7, requestedCities: ["Negombo"],
    arrival: { location: "CMB", dateTime: "2027-02-01T23:00" }, departure: { location: "CMB", dateTime: "2027-02-07T18:00" } };
  const result = await planRouteConcepts(input, { getMatrix: async locations => matrix(locations, 45), exactCities: true });
  assert.ok(result.concepts.length);
  assert.equal(result.concepts[0].knownDrivingMinutes, 90);
  const detail = await generatePlanningV2Itinerary(result, result.concepts[0].routeConcept.id, { getPlaces: async () => [] });
  const transfer = detail.itinerary.days[0].items.find(item => item.category === "transport")!;
  assert.equal(transfer.plannedStart, "2027-02-02T00:30");
  assert.equal(transfer.plannedEnd, "2027-02-02T01:15");
  assert.equal(detail.itinerary.days[0].items.filter(item => item.category === "activity").length, 0);
  assert.ok(!detail.validation.errors.length, JSON.stringify(detail.validation.errors));
});


test("repeated AI attractions across different days are rejected instead of filling the itinerary", async () => {
  const result = await route({ ...brief, requestedCities: ["Kandy"] });
  const selected = result.concepts[0];
  const response = { schemaVersion: 2 as const, routeConceptId: selected.routeConcept.id,
    days: [{ day: 1, placeIds: ["temple-kandy"] }, { day: 2, placeIds: ["temple-kandy"] }, { day: 3, placeIds: [] }] };
  assert.throws(() => validateAiActivityPlan(response, selected.candidate, result.brief, places));
});


test("generation reports actual operations and finishes without an animation timer", async () => {
  const result = await route();
  const id = chosen(result).routeConcept.id;
  const events: string[] = [];
  const output = await generatePlanningV2Itinerary(result, id, {
    onProgress: stage => events.push(stage),
    getPlaces: async () => { events.push("places returned"); return places; },
    getAiPlan: async () => { events.push("AI returned"); return aiPlan(result, id); },
  });
  assert.deepEqual(events, ["places", "places returned", "suggestions", "AI returned", "assembling"]);
  assert.equal(output.generationMode, "AI");
});

test("cancelling during place lookup prevents AI and does not build a fallback", async () => {
  const result = await route();
  const controller = new AbortController();
  let aiCalls = 0;
  await assert.rejects(generatePlanningV2Itinerary(result, chosen(result).routeConcept.id, {
    signal: controller.signal,
    getPlaces: async () => { controller.abort(); return places; },
    getAiPlan: async () => { aiCalls++; throw new Error("must not run"); },
  }), { name: "AbortError" });
  assert.equal(aiCalls, 0);
});

test("cancelling an AI request is not an AI failure and cannot publish a limited draft", async () => {
  const result = await route();
  const controller = new AbortController();
  const stages: string[] = [];
  await assert.rejects(generatePlanningV2Itinerary(result, chosen(result).routeConcept.id, {
    signal: controller.signal, onProgress: stage => stages.push(stage), getPlaces: async () => places,
    getAiPlan: async (_brief, _route, _places, signal) => {
      assert.equal(signal, controller.signal);
      controller.abort(); throw new Error("cancelled");
    },
  }), { name: "AbortError" });
  assert.deepEqual(stages, ["places", "suggestions"]);
});


test("the AI client aborts its HTTP request when generation is cancelled", async context => {
  const result = await route();
  const controller = new AbortController();
  let requestSignal: AbortSignal | undefined;
  context.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    requestSignal = init.signal as AbortSignal;
    return await new Promise<Response>((_resolve, reject) => {
      requestSignal!.addEventListener("abort", () => reject(new DOMException("Cancelled", "AbortError")), { once: true });
    });
  });
  const pending = requestAiActivityPlan(result.brief, chosen(result).candidate, places, controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(requestSignal?.aborted, true);
});

test("an already cancelled request does not contact the AI endpoint", async context => {
  const result = await route();
  const controller = new AbortController();
  controller.abort();
  const fetchMock = context.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected request"); });
  await assert.rejects(requestAiActivityPlan(result.brief, chosen(result).candidate, places, controller.signal), { name: "AbortError" });
  assert.equal(fetchMock.mock.callCount(), 0);
});
