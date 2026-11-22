import test from "node:test";
import assert from "node:assert/strict";
import { estimateLeg, fetchDayLegs, formatLeg, formatMinutes, googleMapsDayUrl, legFromRoad, straightKm } from "./dayTravel.ts";

const sigiriyaRock = { latitude: 7.957, longitude: 80.7603 };
const pidurangala = { latitude: 7.9667, longitude: 80.7597 };
const toothTemple = { latitude: 7.2936, longitude: 80.6413 };
const peradeniya = { latitude: 7.2687, longitude: 80.5966 };

test("straight-line distance is about right", () => {
  const km = straightKm(sigiriyaRock, pidurangala);
  assert.ok(km > 0.9 && km < 1.3, `${km}`);
});

test("short hops are walks, longer ones drives at realistic town speeds", () => {
  assert.deepEqual(legFromRoad(0.8, "Kandy"), { minutes: 10, km: 0.8, walk: true, source: "road" });
  // OSRM says 9 minutes for 6 km in Kandy; 22 km/h in a hill town makes it about 16, shown as 15.
  const drive = legFromRoad(6, "Kandy", 9);
  assert.equal(drive.walk, false);
  assert.equal(drive.minutes, 15);
  // A slower OSRM time is kept.
  assert.equal(legFromRoad(6, "Mirissa", 30).minutes, 30);
  assert.equal(legFromRoad(2, "Mirissa").minutes, 5);
});

test("estimates wind more in the hills", () => {
  const kandy = estimateLeg(toothTemple, peradeniya, "Kandy");
  assert.equal(kandy.source, "estimate");
  assert.equal(kandy.walk, false);
  assert.ok(kandy.km > 8 && kandy.km < 9.5, `${kandy.km}`);
  assert.ok(kandy.km > estimateLeg(toothTemple, peradeniya, "Negombo").km);
});

test("formats legs and durations for people", () => {
  assert.equal(formatLeg({ minutes: 15, km: 6.2, walk: false, source: "road" }), "About 15 min drive · 6.2 km");
  assert.equal(formatLeg({ minutes: 10, km: 0.8, walk: true, source: "estimate" }), "About 10 min walk · 0.8 km");
  assert.equal(formatMinutes(80), "1 h 20 min");
  assert.equal(formatMinutes(120), "2 h");
});

test("Google Maps link runs through the day in order", () => {
  assert.equal(googleMapsDayUrl([]), undefined);
  assert.match(googleMapsDayUrl([sigiriyaRock])!, /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=7\.957000%2C80\.760300$/);
  const url = new URL(googleMapsDayUrl([toothTemple, sigiriyaRock, pidurangala, peradeniya])!);
  assert.equal(url.pathname, "/maps/dir/");
  assert.equal(url.searchParams.get("origin"), "7.293600,80.641300");
  assert.equal(url.searchParams.get("destination"), "7.268700,80.596600");
  assert.equal(url.searchParams.get("waypoints"), "7.957000,80.760300|7.966700,80.759700");
  assert.equal(url.searchParams.get("travelmode"), "driving");
});

test("road legs come from OSRM, corrected, and failures return null", async () => {
  let asked = "";
  const legs = await fetchDayLegs([toothTemple, peradeniya, sigiriyaRock], "Kandy", async url => {
    asked = url;
    return { routes: [{ legs: [{ duration: 540, distance: 6000 }, { duration: 60, distance: 700 }] }] };
  });
  assert.match(asked, /router\.project-osrm\.org\/route\/v1\/driving\/80\.64130,7\.29360;80\.59660,7\.26870;80\.76030,7\.95700\?overview=false/);
  assert.deepEqual(legs, [{ minutes: 15, km: 6, walk: false, source: "road" }, { minutes: 10, km: 0.7, walk: true, source: "road" }]);
  assert.equal(await fetchDayLegs([toothTemple, sigiriyaRock], "Kandy", async () => { throw new Error("down"); }), null);
  assert.equal(await fetchDayLegs([toothTemple, sigiriyaRock], "Kandy", async () => ({ routes: [] })), null);
  assert.deepEqual(await fetchDayLegs([toothTemple], "Kandy"), []);
});
