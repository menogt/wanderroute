import assert from "node:assert/strict";
import { test } from "node:test";
import { hotelOptions, suggestedStay } from "./suggestedStay.ts";

const hotel = (name: string, city: string, stayTier?: "budget" | "comfort" | "luxury", amount?: number) => ({
  databaseId: `h:${name}`, name, city, category: "hotel", ...(stayTier ? { stayTier } : {}),
  ...(amount !== undefined ? { recordedPrice: { amount, currency: "USD" as const } } : {}) });
const places = [
  hotel("Database Inn", "Kandy"),
  hotel("Topaz", "Kandy", "comfort", 30), hotel("McLeod", "Kandy", "budget", 14), hotel("Freedom", "Kandy", "budget", 11),
  hotel("Amaya", "Kandy", "luxury", 120),
  hotel("Village", "Sigiriya", "luxury", 90), hotel("Corridor", "Sigiriya", "luxury", 350), hotel("Beyond", "Sigiriya", "budget", 18),
  hotel("Only Database", "Arugam Bay"),
  { databaseId: "sight", name: "Temple", city: "Kandy", category: "temple" },
];

test("suggests the curated hotel matching the comfort level, cheapest first", () => {
  assert.equal(suggestedStay(places, "Kandy", "comfort")?.name, "Topaz");
  assert.equal(suggestedStay(places, "Kandy", "budget")?.name, "Freedom");
  assert.equal(suggestedStay(places, "Kandy", "luxury")?.name, "Amaya");
  assert.equal(suggestedStay(places, "Kandy")?.name, "Topaz");
});

test("falls back to the nearest comfort level, cheaper first", () => {
  assert.equal(suggestedStay(places, "Sigiriya", "comfort")?.name, "Beyond");
});

test("never suggests unvetted database hotels", () => {
  assert.equal(suggestedStay(places, "Arugam Bay", "comfort"), undefined);
  assert.deepEqual(hotelOptions(places, "Arugam Bay").map(place => place.name), ["Only Database"]);
});

test("hotel options list curated hotels first and only hotels", () => {
  assert.deepEqual(hotelOptions(places, "Kandy").map(place => place.name), ["Topaz", "McLeod", "Freedom", "Amaya", "Database Inn"]);
});
