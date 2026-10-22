import assert from "node:assert/strict";
import { test } from "node:test";
import { planRouteConcepts } from "./planningV2.ts";
import { generatePlanningV2Itinerary } from "./planningV2Itinerary.ts";
import { planningPresentation } from "./planningPresentation.ts";
import { applyPlanningV2Edit, undoPlanningV2Edit } from "./planningV2Editing.ts";
import { customizationDraft, previewPlanningCustomization } from "./planningCustomization.ts";
import { showPlanningConcepts, selectPlanningConcept, showPlanningItinerary } from "./planningV2Session.ts";
import type { TripBriefV1 } from "./planningTypes";

async function fixture() {
  const brief: TripBriefV1 = { schemaVersion: 1, durationDays: 4, travellerCount: 2, interests: ["culture"], budget: { amount: 1000, currency: "USD" }, requestedCities: ["Kandy"], transportPreference: "PUBLIC_TRANSPORT", travelDates: { start: "2027-02-01", end: "2027-02-04" } };
  const result = await planRouteConcepts(brief, { getMatrix: async locations => ({ locations, source: "UNAVAILABLE", generatedAt: "2026-10-22", legs: locations.map(from => locations.map(to => ({ fromId: from.id, toId: to.id, status: "UNAVAILABLE" }))) }) });
  const id = result.concepts[0].routeConcept.id;
  const detail = await generatePlanningV2Itinerary(result, id, { getPlaces: async () => [
    { databaseId: "a", name: "A first visit", city: "Kandy", category: "attraction" },
    { databaseId: "b", name: "Café garden", city: "Kandy", category: "attraction" },
  ], getAiPlan: async () => { throw new Error("Unavailable"); } });
  return showPlanningItinerary(selectPlanningConcept(showPlanningConcepts(result), id), id, detail);
}
const snapshot = (session: Awaited<ReturnType<typeof fixture>>) => planningPresentation(session.detailed!, session.result!.brief, session.result!.concepts.find(concept => concept.routeConcept.id === session.selectedConceptId)!);

test("review and PDF snapshot reflect current edits, movement and undo without changing the source", async () => {
  const session = await fixture(), original = snapshot(session);
  const item = session.detailed!.itinerary.days[0].items.find(item => item.category === "activity")!;
  const removed = applyPlanningV2Edit(session, { type: "remove", itemId: item.id });
  const removedPlan = snapshot(removed);
  assert.notEqual(removedPlan.revision, original.revision);
  assert.ok(!removedPlan.days.flatMap(day => day.items).some(entry => entry.id === item.id));
  assert.ok(removedPlan.unscheduled.some(entry => entry.id === item.id));
  assert.equal(snapshot(undoPlanningV2Edit(removed)).revision, original.revision);
  const moved = applyPlanningV2Edit(session, { type: "move", itemId: item.id, targetDay: 4 });
  const movedPlan = snapshot(moved);
  assert.ok(movedPlan.days[3].items.some(entry => entry.id === item.id));
  assert.ok(!movedPlan.days[0].items.some(entry => entry.id === item.id));
  movedPlan.days[3].items[0].label = "Detached change";
  assert.notEqual(session.detailed!.itinerary.days[0].items[0].label, "Detached change");
  assert.ok(original.days.flatMap(day => day.items).some(entry => entry.label === "Café garden"));
});

test("snapshot keeps recorded room prices separate from allowances and unknown costs", async () => {
  const session = await fixture(), draft = customizationDraft(session);
  draft.stays.Kandy = { name: "Family's own hotel", rooms: 2, nightlyRoomAmount: 80, rateCurrency: "USD", status: "TRAVELLER_BOOKED" };
  draft.brief.travellerCount = 4;
  const updated = previewPlanningCustomization(session, draft).session!;
  const allowed = applyPlanningV2Edit(updated, { type: "allowance", group: "meals", allowance: { amount: 10, basis: "PERSON_DAY" } });
  const plan = snapshot(allowed);
  assert.equal(plan.budget.supported, 480); // 2 rooms x 3 nights x 80, not 4 guests x room rate
  assert.equal(plan.budget.allowanceTotal, 160); // 4 guests x 4 days x 10
  assert.equal(plan.budget.scenarioMinimum, 640);
  assert.ok(plan.route[0].status.includes("not independently verified"));
  assert.ok(plan.costLines.some(line => line.amount === "Price to confirm"));
  assert.ok(plan.budget.uncovered.includes("Local transport"));
  assert.equal(plan.generationMode, "LIMITED_DRAFT");
  assert.equal(plan.days[0].date, "2027-02-01");
  assert.equal(plan.days[3].date, "2027-02-04");
});

test("room-night allowances cover only unpriced nights without double charging recorded stays", async () => {
  const session = await fixture(), draft = customizationDraft(session);
  draft.stops = [{ city: "Kandy", nights: 2, requirement: "OPTIONAL" }, { city: "Ella", nights: 1, requirement: "OPTIONAL" }];
  draft.stays.Kandy = { name: "Recorded stay", rooms: 2, nightlyRoomAmount: 80, rateCurrency: "USD", status: "NEEDS_BOOKING" };
  const updated = previewPlanningCustomization(session, draft).session!;
  const allowed = applyPlanningV2Edit(updated, { type: "allowance", group: "stays", allowance: { amount: 100, basis: "ROOM_NIGHT", rooms: 2 } });
  const plan = snapshot(allowed);
  assert.equal(plan.budget.supported, 320);
  assert.equal(plan.budget.rows.find(row => row.key === "stays")!.allowanceTotal, 200);
  assert.equal(plan.budget.scenarioMinimum, 520);
});


test("independent free-time blocks can move without false duplicate-place conflicts", async () => {
  let session = await fixture();
  session = applyPlanningV2Edit(session, { type: "free-time", day: 1 });
  session = applyPlanningV2Edit(session, { type: "free-time", day: 4 });
  const id = session.detailed!.itinerary.days[0].items.find(item => item.isFreeTime)!.id;
  const moved = applyPlanningV2Edit(session, { type: "move", itemId: id, targetDay: 4 });
  assert.equal(moved.editError, undefined);
  assert.equal(moved.detailed!.itinerary.days[3].items.filter(item => item.isFreeTime).length, 2);
  assert.ok(moved.detailed!.itinerary.days[3].items.some(item => item.id === id));
});
