import assert from "node:assert/strict";
import { test } from "node:test";
import { fewerNights, moreNights, type NightChange } from "./routeNights.ts";
import type { DestinationChoice } from "./planningCustomization";

const route = (...nights: number[]): DestinationChoice[] => ["Sigiriya", "Kandy", "Ella", "Mirissa"].slice(0, nights.length)
  .map((city, index) => ({ city, nights: nights[index], requirement: "OPTIONAL" as const }));
const ok = (change: NightChange) => { assert.ok(!("problem" in change), "problem" in change ? change.problem : ""); return change as Exclude<NightChange, { problem: string }>; };
const nights = (change: NightChange) => ok(change).stops.map(stop => stop.nights);

test("− after + gives the night back to the town it came from, not the next town", () => {
  const start = route(2, 2, 2, 3);
  const added = ok(moreNights(start, 0));
  assert.deepEqual(added.stops.map(stop => stop.nights), [3, 2, 2, 2]);
  assert.deepEqual(nights(fewerNights(added.stops, 0, added.moves)), [2, 2, 2, 3]);
});

test("+ after − takes the night back from the town that received it", () => {
  const start = route(3, 2, 2, 2);
  const less = ok(fewerNights(start, 0));
  const back = ok(moreNights(less.stops, 0, less.moves));
  assert.deepEqual(back.stops.map(stop => stop.nights), [3, 2, 2, 2]);
  assert.deepEqual(back.moves, []);
});

test("several + then the same number of − restore the original nights", () => {
  let change = ok(moreNights(route(2, 2, 3, 2), 1));
  change = ok(moreNights(change.stops, 1, change.moves));
  change = ok(fewerNights(change.stops, 1, change.moves));
  change = ok(fewerNights(change.stops, 1, change.moves));
  assert.deepEqual(change.stops.map(stop => stop.nights), [2, 2, 3, 2]);
});

test("without history, − gives the night to the shortest stay, nearest first", () => {
  assert.deepEqual(nights(fewerNights(route(2, 4, 2, 1), 1)), [2, 3, 2, 2]);
  assert.deepEqual(nights(fewerNights(route(1, 4, 1, 3), 1)), [1, 3, 2, 3]);
});

test("− never gives a night to a locked stop", () => {
  const stops = route(2, 3, 1, 2);
  stops[2].locked = true;
  assert.deepEqual(nights(fewerNights(stops, 1)), [3, 2, 1, 2]);
});

test("a borrowed night is not returned to a stop that has since been locked", () => {
  const added = ok(moreNights(route(2, 2, 3), 0));
  const stops = added.stops.map(stop => stop.city === "Ella" ? { ...stop, locked: true } : stop);
  assert.deepEqual(nights(fewerNights(stops, 0, added.moves)), [2, 3, 2]);
});

test("limits still apply", () => {
  assert.ok("problem" in fewerNights(route(1, 2), 0));
  assert.ok("problem" in moreNights(route(1, 1, 1), 0));
  assert.ok("problem" in fewerNights(route(3), 0));
});
