import assert from "node:assert/strict";
import { test } from "node:test";
import { eligibleActivityPlaces } from "./planningV2Places.ts";
import type { CandidatePlace } from "./planningTypes";

const place = (databaseId: string, name: string, category: CandidatePlace["category"],
  sourceProvider = "overpass", city = "Kandy"): CandidatePlace =>
  ({ databaseId, name, category, sourceProvider, city });

test("V2 activity candidates exclude miscategorised dining and lodging records", () => {
  const candidates = [
    place("temple", "Sri Dalada Maligawa", "temple"),
    place("museum", "Ceylon Tea Museum", "attraction"),
    place("dosai", "Balaji Dosai", "temple", "foursquare"),
    place("delight", "Delight", "temple", "foursquare"),
    place("hotel", "Thilanka Hotel", "temple"),
    place("restaurant", "Honey Pot Restaurant", "restaurant"),
    place("other-city", "Ella viewpoint", "attraction", "overpass", "Ella"),
  ];
  assert.deepEqual(eligibleActivityPlaces(candidates, "Kandy").map(candidate => candidate.databaseId),
    ["temple", "museum"]);
});

test("a Foursquare temple needs a name identifying a religious site", () => {
  assert.deepEqual(eligibleActivityPlaces([
    place("real", "Temple of the Sacred Tooth Relic", "temple", "foursquare"),
    place("retail", "Kandy City Center", "temple", "foursquare"),
  ], "Kandy").map(candidate => candidate.databaseId), ["real"]);
});
