import assert from "node:assert/strict";
import { test } from "node:test";
import { validatePlanningBrief } from "./planningV2.ts";
import { civilDay, sriLankaCalendarDate } from "./planningCalendar.ts";
import type { TripBriefV1 } from "./planningTypes";

const brief: TripBriefV1 = { schemaVersion: 1, durationDays: 7, travellerCount: 2,
  budget: { amount: 1000, currency: "USD" }, interests: ["culture"], requestedCities: ["Kandy"] };
test("invalid dates, reversed flights and contradictory calendar spans fail before routing", () => {
  assert.equal(civilDay("2027-02-29"), undefined);
  for (const dates of [
    { arrival: { dateTime: "2027-02-07T10:00" }, departure: { dateTime: "2027-02-01T18:00" } },
    { arrival: { dateTime: "2027-02-01T10:00" }, departure: { dateTime: "2027-02-10T18:00" } },
    { travelDates: { start: "2027-02-30", end: "2027-03-08" } },
    { travelDates: { start: "2027-02-01" }, arrival: { dateTime: "2027-02-02T10:00" } },
  ]) assert.ok(validatePlanningBrief({ ...brief, ...dates }).some(issue => issue.code === "CALENDAR"));
  assert.deepEqual(validatePlanningBrief({ ...brief, arrival: { dateTime: "2027-02-01T23:00" },
    departure: { dateTime: "2027-02-07T18:00" } }), []);
});

test("the during-trip date rolls over at Sri Lanka midnight rather than the visitor's home timezone", () => {
  assert.equal(sriLankaCalendarDate(new Date("2027-02-01T18:29:00Z")), "2027-02-01");
  assert.equal(sriLankaCalendarDate(new Date("2027-02-01T18:30:00Z")), "2027-02-02");
});
