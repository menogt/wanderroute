import assert from "node:assert/strict";
import { test } from "node:test";
import { handler } from "../../../netlify/functions/generate-v2-itinerary.js";
import { setIndicativePricing } from "./indicativePrices.ts";
import { MUST_SEE } from "./curatedPlaces.ts";
import { planRouteConcepts, validatePlanningBrief, type PlanningV2Result } from "./planningV2.ts";
import { generatePlanningV2Itinerary } from "./planningV2Itinerary.ts";
import { validateAiActivityPlan, type AiActivityPlan } from "./planningV2ItineraryService.ts";
import { routeDayCities } from "./planningV2Scheduling.ts";
import { withPinnedPlaces } from "./planningV2Places.ts";
import { assignPinsToDays, citiesFromPlaces, pickablePlaces, resolveRequestedPlaces, searchPlaces,
  type RequestedPlace } from "./requestedPlaces.ts";
import type { CandidatePlace, TripBriefV1 } from "./planningTypes";
import type { MatrixLocation, RoadLeg, TravelMatrix } from "./travelTimeMatrix";
setIndicativePricing(false);

const tooth: RequestedPlace = { key: "Kandy|Temple of the Sacred Tooth Relic", name: "Temple of the Sacred Tooth Relic",
  city: "Kandy", source: "landmark" };
const bridge: RequestedPlace = { key: "Ella|Nine Arches Bridge", name: "Nine Arches Bridge", city: "Ella", source: "landmark" };
const place = (databaseId: string, name: string, city: string, category = "attraction"): CandidatePlace =>
  ({ databaseId, name, city, category, sourceProvider: "Place database" });
const places: CandidatePlace[] = [
  place("db-dalada", "Sri Dalada Maligawa", "Kandy", "temple"), place("db-lake", "Kandy Lake", "Kandy"),
  place("db-garden", "Udawattakele", "Kandy"), place("db-bridge", "Nine Arch Bridge", "Ella"),
  place("db-peak", "Little Adam's Peak", "Ella"), place("db-falls", "Ravana Falls", "Ella"),
  { databaseId: "stay-kandy", name: "Kandy stay", city: "Kandy", category: "hotel" },
  { databaseId: "stay-ella", name: "Ella stay", city: "Ella", category: "hotel" },
];

test("towns come from the chosen places first, then chosen towns, without repeats and at most eight", () => {
  assert.deepEqual(citiesFromPlaces([bridge, tooth, { ...tooth, key: "x", name: "Kandy Lake" }], ["Galle", "ella"]),
    ["Ella", "Kandy", "Galle"]);
  const many = ["Negombo", "Sigiriya", "Dambulla", "Trincomalee", "Kandy", "Nuwara Eliya", "Ella", "Arugam Bay", "Mirissa"];
  assert.equal(citiesFromPlaces([], many).length, 8);
});

test("the picker lists the most-asked landmarks first, with free photos where available", () => {
  const list = pickablePlaces();
  assert.equal(list[0].name, "Sigiriya Rock Fortress");
  assert.equal(list[1].name, "Temple of the Sacred Tooth Relic");
  assert.equal(list.length, Object.values(MUST_SEE).flat().length);
  assert.match(list[0].photo?.url ?? "", /^https:\/\/(thumb|upload)\.wikimedia\.org\//);
  assert.ok(list[0].photo?.credit && list[0].photo.licence);
});

test("a chosen landmark matches its database record under another name; a database pick matches by ID", () => {
  const resolved = resolveRequestedPlaces([tooth, bridge,
    { key: "db:db-garden", name: "Udawattakele", city: "Kandy", databaseId: "db-garden", source: "database" },
    { key: "Galle|Galle Fort", name: "Galle Fort", city: "Galle", source: "landmark" }], places);
  assert.deepEqual(resolved.map(entry => entry.place?.databaseId), ["db-dalada", "db-bridge", "db-garden", undefined]);
});

test("chosen places spread over their town's days, skip rest days and overflow past the pace limit", () => {
  const pins = [places[0], places[1], places[2], places[3]];
  const { fixed, overflow } = assignPinsToDays(pins, ["Kandy", "Kandy", "Ella"], 1, new Set([0]));
  assert.deepEqual(fixed, [[], ["db-dalada"], ["db-bridge"]]);
  assert.deepEqual(overflow.map(entry => entry.databaseId), ["db-lake", "db-garden"]);
  const spread = assignPinsToDays(pins.slice(0, 3), ["Kandy", "Kandy"], 2);
  assert.deepEqual(spread.fixed, [["db-dalada", "db-garden"], ["db-lake"]]);
});

test("place search shows landmarks first, drops shops and restaurants, and survives a failed database search", async () => {
  const rows = [{ id: "r1", name: "Ella Spice Restaurant", city: "Ella", category: "attraction" },
    { id: "r2", name: "Ella Rock viewpoint trail", city: "Ella", category: "attraction" },
    { id: "r3", name: "Nine Arch Bridge", city: "Ella", category: "attraction" }];
  const found = await searchPlaces("ella", async () => rows);
  assert.equal(found[0].source, "landmark");
  assert.ok(found.some(entry => entry.databaseId === "r2"));
  assert.ok(!found.some(entry => entry.databaseId === "r1" || entry.databaseId === "r3"));
  const offline = await searchPlaces("nine arches", async () => { throw new Error("offline"); });
  assert.deepEqual(offline.map(entry => entry.name), ["Nine Arches Bridge"]);
  assert.deepEqual(await searchPlaces("e", async () => rows), []);
});

test("the brief accepts chosen places from the planner's towns only", () => {
  const brief: TripBriefV1 = { schemaVersion: 1, durationDays: 7, travellerCount: 2, budget: { amount: 1500, currency: "USD" },
    interests: ["culture"], requestedCities: ["Kandy"], requestedPlaces: [tooth] };
  assert.deepEqual(validatePlanningBrief(brief), []);
  assert.ok(validatePlanningBrief({ ...brief, requestedPlaces: [{ ...tooth, city: "Atlantis" }] }).some(issue => issue.code === "PLACES"));
  assert.ok(validatePlanningBrief({ ...brief, requestedPlaces: Array(13).fill(tooth) }).some(issue => issue.code === "PLACES"));
});

test("a chosen database place missing from the town lists is fetched by ID", async () => {
  const extra = place("db-extra", "Bahirawakanda Buddha", "Kandy");
  const asked: string[][] = [];
  const merged = await withPinnedPlaces(places, [{ key: "db:db-extra", name: extra.name, city: "Kandy", databaseId: "db-extra",
    source: "database" }, tooth], async ids => { asked.push(ids); return [extra]; });
  assert.deepEqual(asked, [["db-extra"]]);
  assert.ok(merged.some(entry => entry.databaseId === "db-extra"));
  assert.equal(await withPinnedPlaces(places, [tooth], async () => { throw new Error("no lookups expected"); }), places);
});

function matrix(locations: MatrixLocation[]): TravelMatrix {
  const legs: RoadLeg[][] = locations.map(from => locations.map(to => ({ fromId: from.id, toId: to.id, status: "ROUTED",
    source: "OSRM_TABLE", durationMinutes: from.id === to.id ? 0 : 150, distanceKm: from.id === to.id ? 0 : 90 })));
  return { locations, legs, source: "OSRM_TABLE", generatedAt: "2026-11-22T00:00:00Z" };
}
const tripBrief: TripBriefV1 = { schemaVersion: 1, durationDays: 5, travellerCount: 2, budget: { amount: 2000, currency: "USD" },
  interests: ["culture"], requestedCities: ["Kandy", "Ella"], requestedPlaces: [tooth, bridge], transportPreference: "PRIVATE_DRIVER" };
async function plan(brief = tripBrief): Promise<PlanningV2Result> {
  return planRouteConcepts(brief, { getMatrix: async locations => matrix(locations), now: () => "2026-11-22T00:00:00Z", exactCities: true });
}
const kandyThenElla = (result: PlanningV2Result) => result.concepts.find(concept =>
  concept.candidate.destinations.map(stop => stop.name).join(">") === "Kandy>Ella") ?? result.concepts[0];
const scheduledIds = (output: Awaited<ReturnType<typeof generatePlanningV2Itinerary>>) =>
  output.itinerary.days.flatMap(day => day.items.map(item => item.placeId).filter(Boolean));

test("chosen places are on the plan even when the AI leaves them out, and the AI is told about them", async () => {
  const result = await plan();
  const concept = kandyThenElla(result);
  const cities = routeDayCities(concept.candidate, tripBrief.durationDays);
  let sentFixed: string[][] = [];
  const reply: AiActivityPlan = { schemaVersion: 2, routeConceptId: concept.routeConcept.id,
    days: cities.map((city, index) => ({ day: index + 1, placeIds: city === "Kandy" && index === 1 ? ["db-lake"] : [] })) };
  const output = await generatePlanningV2Itinerary(result, concept.routeConcept.id, { getPlaces: async () => places,
    getAiPlan: async (_brief, _route, _places, _signal, fixed) => { sentFixed = fixed ?? []; return reply; } });
  assert.equal(output.generationMode, "AI");
  assert.ok(scheduledIds(output).includes("db-dalada"));
  assert.ok(scheduledIds(output).includes("db-bridge"));
  assert.ok(sentFixed.flat().includes("db-dalada") && sentFixed.flat().includes("db-bridge"));
  const daleDay = output.itinerary.days.find(day => day.items.some(item => item.placeId === "db-dalada"));
  assert.equal(daleDay?.city, "Kandy");
  assert.ok(!output.validation.issues.some(issue => issue.code === "REQUESTED_PLACE_UNSCHEDULED"));
});

test("an AI reply that repeats a chosen place is rejected, and the limited draft still keeps every chosen place", async () => {
  const result = await plan();
  const concept = kandyThenElla(result);
  const cities = routeDayCities(concept.candidate, tripBrief.durationDays);
  const fixed = cities.map(() => [] as string[]);
  fixed[cities.indexOf("Kandy")] = ["db-dalada"];
  const repeat: AiActivityPlan = { schemaVersion: 2, routeConceptId: concept.routeConcept.id,
    days: cities.map((_, index) => ({ day: index + 1, placeIds: index === cities.lastIndexOf("Kandy") ? ["db-dalada"] : [] })) };
  assert.throws(() => validateAiActivityPlan(repeat, concept.candidate, tripBrief, places, fixed));
  const output = await generatePlanningV2Itinerary(result, concept.routeConcept.id, { getPlaces: async () => places,
    getAiPlan: async () => repeat });
  assert.equal(output.generationMode, "LIMITED_DRAFT");
  assert.ok(scheduledIds(output).includes("db-dalada") && scheduledIds(output).includes("db-bridge"));
});

test("chosen places that don't fit wait in Places to visit with a warning", async () => {
  const brief: TripBriefV1 = { ...tripBrief, durationDays: 3, pace: "SLOW_TRAVEL",
    requestedPlaces: [tooth, { key: "Kandy|Kandy Lake", name: "Kandy Lake", city: "Kandy", source: "landmark" },
      { key: "db:db-garden", name: "Udawattakele", city: "Kandy", databaseId: "db-garden", source: "database" }, bridge] };
  const result = await plan(brief);
  const concept = kandyThenElla(result);
  const output = await generatePlanningV2Itinerary(result, concept.routeConcept.id, { getPlaces: async () => places,
    getAiPlan: async () => { throw new Error("AI unavailable"); } });
  const waiting = output.unscheduledActivities ?? [];
  assert.ok(waiting.length > 0);
  for (const entry of waiting) {
    assert.ok(!scheduledIds(output).includes(entry.placeId));
    assert.ok(output.validation.warnings.some(issue => issue.code === "REQUESTED_PLACE_UNSCHEDULED" &&
      issue.details?.city === entry.city));
  }
});

test("a town gets enough nights for the places chosen there", async () => {
  const kandyPicks: RequestedPlace[] = [tooth, { key: "Kandy|Kandy Lake", name: "Kandy Lake", city: "Kandy", source: "landmark" },
    { key: "Kandy|Royal Botanical Gardens Peradeniya", name: "Royal Botanical Gardens Peradeniya", city: "Kandy", source: "landmark" }];
  const kandyNights = async (requestedPlaces: RequestedPlace[]) => {
    const concept = kandyThenElla(await plan({ ...tripBrief, durationDays: 4, requestedPlaces }));
    return concept.candidate.nights[concept.candidate.destinations.findIndex(stop => stop.name === "Kandy")];
  };
  assert.equal(await kandyNights([]), 1);
  assert.equal(await kandyNights(kandyPicks), 2);
});

test("the AI endpoint keeps chosen places out of the AI's picks and counts only the open slots", async () => {
  const request = { schemaVersion: 2, routeConceptId: "route-a", interests: ["culture"], pace: "BALANCED",
    days: [{ day: 1, city: "Kandy", fixed: ["k1"], places: [{ id: "k1", name: "Temple", category: "temple" },
      { id: "k2", name: "Lake", category: "attraction" }, { id: "k3", name: "Garden", category: "attraction" }] },
    { day: 2, city: "Kandy", places: [{ id: "k1", name: "Temple", category: "temple" }, { id: "k2", name: "Lake", category: "attraction" }] }] };
  const reply = { schemaVersion: 2, routeConceptId: "route-a", days: [
    { day: 1, placeIds: ["k1", "k2", "k3"], descriptions: [{ placeId: "k1", text: "The traveller's choice" }] },
    { day: 2, placeIds: ["k1"] }] };
  const saved = { groq: process.env.GROQ_API_KEY, openrouter: process.env.OPENROUTER_API_KEY, backup: process.env.GROQ_FALLBACK_MODEL };
  const originalFetch = globalThis.fetch;
  let prompt = "";
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    prompt = JSON.parse(String(init.body)).messages[1].content;
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }] }), { status: 200 });
  }) as typeof fetch;
  try {
    process.env.GROQ_API_KEY = "test-only";
    delete process.env.OPENROUTER_API_KEY; delete process.env.GROQ_FALLBACK_MODEL;
    const response = await handler({ httpMethod: "POST", body: JSON.stringify(request) });
    assert.equal(response.statusCode, 200);
    const days = JSON.parse(response.body).plan.days;
    assert.deepEqual(days[0].placeIds, ["k2"]);
    assert.deepEqual(days[1].placeIds, []);
    assert.deepEqual(days[0].descriptions, [{ placeId: "k1", text: "The traveller's choice" }]);
    assert.match(prompt, /"alreadyIncluded":\["k1"\],"chooseUpTo":1/);
    const invalid = { ...request, days: [{ ...request.days[0], fixed: ["unknown"] }, request.days[1]] };
    assert.equal((await handler({ httpMethod: "POST", body: JSON.stringify(invalid) })).statusCode, 400);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of [["GROQ_API_KEY", saved.groq], ["OPENROUTER_API_KEY", saved.openrouter],
      ["GROQ_FALLBACK_MODEL", saved.backup]] as const) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});
