import assert from "node:assert/strict";
import { test } from "node:test";
import type { GeneratedItinerary, TripInputs } from "../components/rl/types";
import type { PlanningItineraryV2, PriceEvidence, RouteConceptV1 } from "./planningTypes";
import { tripInputsToBrief } from "./tripBrief.ts";
import { candidateFromDbPlace } from "./candidatePlaces.ts";
import { adaptStoredTrip, itinerarySchemaVersion } from "./tripVersioning.ts";
import { getSavedTrips } from "../components/rl/tripStorage.ts";

const inputs: TripInputs = {
  budget: 1500, currency: "USD", days: 5, people: 2,
  cities: ["Kandy", "Ella"], interests: ["culture", "food"], travelStyle: "comfort",
};

const legacy = {
  id: "rl-123", routeName: "Hill route", startCity: "Kandy", cities: [],
  totalDays: 1, days: [{ day: 1, city: "Kandy", items: [
    { time: "09:00", icon: "pin", label: "Temple", detail: "Visit", cost: 10, category: "activity" },
  ] }],
} as unknown as GeneratedItinerary;

test("a locally saved legacy snapshot is readable with a stable item ID", () => {
  const previous = globalThis.localStorage;
  const store = new Map([["wanderroute_saved_trips", JSON.stringify([legacy])]]);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: (key: string) => store.get(key) ?? null },
  });
  try {
    const first = adaptStoredTrip(getSavedTrips()[0]);
    const second = adaptStoredTrip(getSavedTrips()[0]);
    assert.deepEqual(first.cities, ["Kandy"]);
    assert.equal(first.days[0].items[0].label, "Temple");
    assert.equal(first.days[0].items[0].id, "legacy:rl-123:0:0");
    assert.equal(first.days[0].items[0].id, second.days[0].items[0].id);
    assert.equal(itinerarySchemaVersion(first), 1);
    assert.equal(getSavedTrips()[0].days[0].items[0].id, undefined);
  } finally {
    if (previous === undefined) delete (globalThis as { localStorage?: Storage }).localStorage;
    else Object.defineProperty(globalThis, "localStorage", { configurable: true, value: previous });
  }
});

test("TripInputs mapping preserves collected meaning and leaves future fields absent", () => {
  const brief = tripInputsToBrief(inputs);
  assert.deepEqual(brief, {
    schemaVersion: 1, durationDays: 5, travellerCount: 2,
    budget: { amount: 1500, currency: "USD" },
    interests: ["culture", "food"], requestedCities: ["Kandy", "Ella"],
    comfortTier: "comfort",
  });
  assert.equal("pace" in brief, false);
  assert.equal("arrival" in brief, false);
  assert.equal("departure" in brief, false);
  assert.equal("travelMonth" in brief, false);
  assert.equal("maxPreferredDailyDrivingMinutes" in brief, false);
  assert.deepEqual(tripInputsToBrief({ ...inputs, cities: [] }).requestedCities, []);
  const futureBrief = { ...brief, pace: "SLOW_TRAVEL" as const, comfortTier: "budget" as const };
  assert.equal(futureBrief.pace, "SLOW_TRAVEL");
  assert.equal(futureBrief.comfortTier, "budget");
});

test("price evidence statuses retain their own source, check time and note", () => {
  const prices: PriceEvidence[] = [
    { amount: 20, currency: "USD", status: "KNOWN", source: "menu" },
    { amount: 25, currency: "USD", status: "ESTIMATED", source: "tier model", confidence: 0.6 },
    { amount: 30, currency: "USD", status: "VERIFIED", source: "provider", checkedAt: "2026-10-08T00:00:00Z", note: "direct quote" },
  ];
  assert.deepEqual(JSON.parse(JSON.stringify(prices)), prices);
  assert.deepEqual(prices.map(p => p.status), ["KNOWN", "ESTIMATED", "VERIFIED"]);
});

test("database place identity and coordinates survive mapping without invented verification", () => {
  const candidate = candidateFromDbPlace({
    id: "place-42", name: "Museum", city: "Colombo", category: "attraction",
    lat: 6.9271, lng: 79.8612, source: "foursquare", price_usd: 12,
  });
  assert.equal(candidate.databaseId, "place-42");
  assert.deepEqual(candidate.coordinates, { latitude: 6.9271, longitude: 79.8612 });
  assert.equal(candidate.sourceProvider, "foursquare");
  assert.deepEqual(candidate.recordedPrice, { amount: 12, currency: "USD" });
  assert.equal(candidate.priceEvidence, undefined);
  assert.equal(candidate.sourceUpdatedAt, undefined);
  assert.equal(candidate.openingHours, undefined);
  const enriched = candidateFromDbPlace({ name: "Museum", city: "Colombo", category: "attraction" }, {
    providerPlaceId: "provider-99", openingHours: { monday: "09:00-17:00" },
    sourceUpdatedAt: "2026-10-08T00:00:00Z",
  });
  assert.equal(enriched.providerPlaceId, "provider-99");
  assert.deepEqual(enriched.openingHours, { monday: "09:00-17:00" });
  assert.equal(enriched.sourceUpdatedAt, "2026-10-08T00:00:00Z");
});

test("V2 itinerary version, concept identity and authored item IDs survive JSON roundtrip", () => {
  const v2: PlanningItineraryV2 = {
    ...legacy, schemaVersion: 2, routeConceptId: "route-1", cities: ["Kandy"],
    days: [{ ...legacy.days[0], items: [{
      ...legacy.days[0].items[0], id: "item-1", city: "Kandy", placeId: "place-42",
      durationMinutes: 90,
    }] }],
  };
  const restored = adaptStoredTrip(JSON.parse(JSON.stringify(v2)));
  assert.equal(itinerarySchemaVersion(restored), 2);
  assert.equal((restored as PlanningItineraryV2).routeConceptId, "route-1");
  assert.equal(restored.days[0].items[0].id, "item-1");
  assert.equal((restored as PlanningItineraryV2).days[0].items[0].placeId, "place-42");
});

test("RouteConcept V1 shape carries planning facts without invoking generation", () => {
  const concept: RouteConceptV1 = {
    schemaVersion: 1, tripBriefVersion: 1, id: "route-1",
    stops: [{ id: "stop-1", destinationName: "Kandy", nights: 2 }], roadLegs: [],
    tradeoffs: [], constraintResults: [{ constraint: "driving", satisfied: null }],
    explanation: "Single destination", generatedAt: "2026-10-08T00:00:00Z", generatorVersion: "test",
  };
  assert.equal(concept.stops[0].nights, 2);
  assert.equal(concept.constraintResults[0].satisfied, null);
});
