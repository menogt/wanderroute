import assert from "node:assert/strict";
import { test } from "node:test";
import { CLASSIC_PLANNER_SCREEN, PRIMARY_PLANNER_SCREEN, resolvePlannerScreen,
  restoreScreen, canRestoreScreen } from "./plannerNavigation.ts";

test("the primary planner opens V2 without a visibility flag", () => {
  assert.equal(PRIMARY_PLANNER_SCREEN, "planning-v2");
  assert.equal(resolvePlannerScreen("planner"), PRIMARY_PLANNER_SCREEN);
  assert.equal(restoreScreen("planner"), PRIMARY_PLANNER_SCREEN);
  assert.equal(restoreScreen("planning-v2"), PRIMARY_PLANNER_SCREEN);
});

test("Classic Planner remains an independently accessible and restorable V1 route", () => {
  assert.equal(CLASSIC_PLANNER_SCREEN, "classic-planner");
  assert.equal(resolvePlannerScreen(CLASSIC_PLANNER_SCREEN), CLASSIC_PLANNER_SCREEN);
  assert.equal(restoreScreen(CLASSIC_PLANNER_SCREEN), CLASSIC_PLANNER_SCREEN);
  assert.equal(canRestoreScreen(CLASSIC_PLANNER_SCREEN), true);
  assert.equal(restoreScreen(null), "home");
});
