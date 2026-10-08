import assert from "node:assert/strict";
import { test } from "node:test";
import { handler } from "../../../netlify/functions/generate-itinerary.js";
import { autoSelectCities } from "./cityPlan.ts";

const input = (days: number, cities = autoSelectCities(days)) => ({
  budget: 2000,
  currency: "USD",
  days,
  people: 2,
  cities,
  interests: ["culture"],
  travelStyle: "comfort",
  realPlaces: "Kandy: Attractions: Temple of the Tooth",
});

function modelItinerary(request: ReturnType<typeof input>) {
  return {
    routeName: "Sri Lanka journey",
    routeSlogan: "A route across the island.",
    cities: request.cities,
    estimatedCostPerPerson: 500,
    estimatedTotalCost: 1000,
    budgetStatus: "ok",
    days: Array.from({ length: request.days }, (_, index) => ({
      day: index + 1,
      city: request.cities[Math.min(index, request.cities.length - 1)],
      flag: "📍",
      heroGradient: "linear-gradient(135deg, #111111, #222222)",
      accommodation: "Sample hotel",
      accommodationCostPerNight: 50,
      dailyCostPerPerson: 50,
      localTip: "Plan ahead.",
      items: [{
        time: "09:00",
        icon: "📍",
        label: "City walk",
        detail: "Explore the area.",
        cost: 10,
        category: "activity",
      }],
    })),
    costBreakdown: {
      hotels: 400,
      food: 200,
      transport: 200,
      activities: 100,
      entryFees: 50,
      misc: 50,
    },
    globalTips: [],
    warnings: [],
    highlights: [],
  };
}

async function runWithMockGroq(
  request: ReturnType<typeof input>,
  content = JSON.stringify(modelItinerary(request)),
) {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GROQ_API_KEY;
  let calls = 0;
  process.env.GROQ_API_KEY = "test-server-key";
  globalThis.fetch = async (url, options) => {
    calls += 1;
    assert.equal(String(url), "https://api.groq.com/openai/v1/chat/completions");
    const outgoing = JSON.parse(String(options?.body));
    assert.deepEqual(outgoing.messages[1].content.includes(request.cities.join(" → ")), true);
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
  };
  try {
    const response = await handler({ httpMethod: "POST", body: JSON.stringify(request) });
    return { response, payload: JSON.parse(response.body), calls };
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = originalKey;
  }
}

test("server accepts a valid short trip", async () => {
  const { response, payload, calls } = await runWithMockGroq(input(2));
  assert.equal(response.statusCode, 200);
  assert.equal(calls, 1);
  assert.equal(payload.itinerary.days.length, 2);
});

test("server accepts the normal seven-day route", async () => {
  const request = input(7);
  const { response, payload } = await runWithMockGroq(request);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(payload.itinerary.cities, request.cities);
});

test("server accepts all current automatic route sizes", async () => {
  for (const days of [8, 11, 12, 30]) {
    const request = input(days);
    assert.ok(request.cities.length > 6);
    const { response, payload } = await runWithMockGroq(request);
    assert.equal(response.statusCode, 200, `${days}-day trip was rejected: ${payload.error}`);
    assert.equal(payload.itinerary.days.length, days);
  }
});

test("server rejects malformed client input without calling Groq", async () => {
  const request = { ...input(7), budget: -1, cities: ["Kandy", "", "Galle"] };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Groq must not be called"); };
  try {
    const response = await handler({ httpMethod: "POST", body: JSON.stringify(request) });
    const payload = JSON.parse(response.body);
    assert.equal(response.statusCode, 400);
    assert.equal(payload.code, "INVALID_INPUT");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("server rejects malformed model JSON", async () => {
  const { response, payload } = await runWithMockGroq(input(7), "not-json");
  assert.equal(response.statusCode, 502);
  assert.equal(payload.code, "MODEL_OUTPUT_INVALID");
  assert.equal(JSON.stringify(payload).includes("test-server-key"), false);
});

test("missing server key produces a controlled error without calling Groq", async () => {
  const originalKey = process.env.GROQ_API_KEY;
  const originalFetch = globalThis.fetch;
  delete process.env.GROQ_API_KEY;
  globalThis.fetch = async () => { throw new Error("Groq must not be called"); };
  try {
    const response = await handler({ httpMethod: "POST", body: JSON.stringify(input(7)) });
    const payload = JSON.parse(response.body);
    assert.equal(response.statusCode, 500);
    assert.equal(payload.code, "SERVER_CONFIGURATION");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = originalKey;
  }
});
