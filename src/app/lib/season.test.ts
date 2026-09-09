// Run with: npm test   (Node's built-in runner, no packages needed)
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSeason } from "./season.ts";

const JULY = 7;
const JANUARY = 1;

test("July + Mirissa => avoid", () => {
  const result = checkSeason(["Mirissa"], JULY);
  assert.equal(result.length, 1);
  assert.equal(result[0].city, "Mirissa");
  assert.equal(result[0].region, "South & West");
  assert.equal(result[0].severity, "avoid");
  assert.match(result[0].message, /July/);
  assert.match(result[0].alternative, /Arugam Bay|Trincomalee/);
});

test("July + Arugam Bay => []", () => {
  assert.deepEqual(checkSeason(["Arugam Bay"], JULY), []);
});

test("January + Trincomalee => avoid", () => {
  const result = checkSeason(["Trincomalee"], JANUARY);
  assert.equal(result.length, 1);
  assert.equal(result[0].severity, "avoid");
  assert.equal(result[0].region, "East & North");
  assert.match(result[0].alternative, /Mirissa|Galle/);
});

test("January + Galle => []", () => {
  assert.deepEqual(checkSeason(["Galle"], JANUARY), []);
});

test("null month => []", () => {
  assert.deepEqual(checkSeason(["Mirissa", "Trincomalee"], null), []);
});

test("unknown city => []", () => {
  assert.deepEqual(checkSeason(["Atlantis"], JULY), []);
});

test("mixed known/unknown => only the known one", () => {
  const result = checkSeason(["Atlantis", "Mirissa"], JULY);
  assert.equal(result.length, 1);
  assert.equal(result[0].city, "Mirissa");
});

test("matching is case-insensitive and trims whitespace", () => {
  const result = checkSeason(["  mirissa ", "ARUGAM BAY"], JULY);
  assert.equal(result.length, 1);
  assert.equal(result[0].city, "mirissa");
});

test("caution months are reported as caution", () => {
  const april = checkSeason(["Galle"], 4);
  assert.equal(april[0]?.severity, "caution");
  const hills = checkSeason(["Ella"], JULY);
  assert.equal(hills[0]?.severity, "caution");
});

test("invalid months and empty input => []", () => {
  assert.deepEqual(checkSeason(["Mirissa"], 0), []);
  assert.deepEqual(checkSeason(["Mirissa"], 13), []);
  assert.deepEqual(checkSeason(["Mirissa"], 7.5), []);
  assert.deepEqual(checkSeason([], JULY), []);
});
