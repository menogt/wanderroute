import assert from "node:assert/strict";
import { test } from "node:test";
import { curatedActivityCandidates, eligibleActivityPlaces, loadPlanningV2Places } from "./planningV2Places.ts";
import { suggestedActivities } from "./planningActivityChoices.ts";
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

test("the existing landmark guide supplies stable offline choices without invented facts", () => {
  const first = curatedActivityCandidates("Ella");
  assert.ok(first.some(place => place.name === "Nine Arches Bridge"));
  assert.deepEqual(first, curatedActivityCandidates("Ella"));
  assert.ok(first.every(place => !place.coordinates && !place.openingHours && !place.priceEvidence && !place.recordedPrice));
  assert.ok(eligibleActivityPlaces(first, "Ella").length > 1);
  assert.deepEqual(curatedActivityCandidates("Uncatalogued place"), []);
});

test("service businesses cannot appear as sightseeing replacements", () => {
  assert.deepEqual(eligibleActivityPlaces([
    place("tattoo", "Ella tatoo studio", "attraction"),
    place("tattoo2", "Tattoo Art Studio", "attraction"),
    place("salon", "Beauty salon", "attraction"),
    place("real", "National Museum of Kandy", "attraction"),
  ], "Kandy").map(place => place.databaseId), ["real"]);
});

test("a partial catalog keeps iconic choices and uses the catalog identity for known aliases", async () => {
  const route = { destinations: [{ id: "Kandy", name: "Kandy" }] } as any;
  const candidates = await loadPlanningV2Places(route, async () => [place("temple", "Sri Dalada Maligawa", "temple"),
    place("generic", "Vinja home", "attraction"), place("retail", "earth bound creations", "attraction"), place("vague", "bats", "attraction")]);
  const eligible = eligibleActivityPlaces(candidates, "Kandy");
  assert.ok(eligible.some(place => place.name === "Kandy Lake"));
  assert.equal(eligible.filter(place => /maligawa|tooth/i.test(place.name)).length, 1);
  assert.equal(eligible[0].databaseId, "temple");
  assert.ok(!eligible.some(place => ["generic", "retail", "vague"].includes(place.databaseId!)));
});

test("fallback preferences and local grouping avoid combining distant activities or two long hikes", () => {
  const brief = { interests: ["culture"] } as any;
  const candidates: CandidatePlace[] = [
    { ...place("museum", "Local museum", "attraction"), coordinates: { latitude: 7.29, longitude: 80.63 } },
    { ...place("near", "Garden", "attraction"), coordinates: { latitude: 7.30, longitude: 80.63 } },
    { ...place("far", "Far viewpoint", "attraction"), coordinates: { latitude: 7.8, longitude: 80.9 } },
  ];
  assert.deepEqual(suggestedActivities(candidates, "Kandy", brief, new Set(), 3).map(place => place.databaseId), ["museum", "near"]);
  const hikes = [place("rock", "Ella Rock", "attraction", "guide", "Ella"), place("peak", "Little Adam's Peak", "attraction", "guide", "Ella")];
  assert.equal(suggestedActivities(hikes, "Ella", { interests: ["hiking"] } as any, new Set(), 2).length, 1);
});
