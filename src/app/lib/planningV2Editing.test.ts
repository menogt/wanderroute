import { planningBudget } from "./planningBudget.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { applyPlanningV2Edit, redoPlanningV2Edit, undoPlanningV2Edit } from "./planningV2Editing.ts";
import { generatePlanningV2Itinerary } from "./planningV2Itinerary.ts";
import { planRouteConcepts } from "./planningV2.ts";
import { returnToPlanningConcepts, selectPlanningConcept, showPlanningConcepts,
  showPlanningItinerary } from "./planningV2Session.ts";
import type { CandidatePlace, TripBriefV1 } from "./planningTypes";
import type { MatrixLocation, RoadLeg, TravelMatrix } from "./travelTimeMatrix";

const brief: TripBriefV1 = { schemaVersion: 1, durationDays: 4, travellerCount: 1,
  budget: { amount: 500, currency: "USD" }, interests: ["culture"], requestedCities: ["Kandy"],
  pace: "BALANCED", transportPreference: "PUBLIC_TRANSPORT" };
const places: CandidatePlace[] = [
  { databaseId: "p1", name: "Temple", city: "Kandy", category: "temple", sourceProvider: "Test places",
    priceBasis: "PER_PERSON", priceEvidence: { amount: 10, currency: "USD", status: "KNOWN", source: "Test tariff" } },
  { databaseId: "p2", name: "Museum", city: "Kandy", category: "attraction", sourceProvider: "Test places" },
  { databaseId: "p3", name: "Garden", city: "Kandy", category: "attraction", sourceProvider: "Test places",
    priceBasis: "PER_PERSON", priceEvidence: { amount: 30, currency: "USD", status: "KNOWN", source: "Test tariff" } },
  { databaseId: "p4", name: "Lake walk", city: "Kandy", category: "attraction", sourceProvider: "Test places" },
  { databaseId: "elsewhere", name: "Other town", city: "Ella", category: "attraction" },
  { databaseId: "hotel", name: "Kandy stay", city: "Kandy", category: "hotel" },
];

function matrix(locations: MatrixLocation[]): TravelMatrix {
  const legs: RoadLeg[][] = locations.map(from => locations.map(to => ({ fromId: from.id, toId: to.id,
    status: "ROUTED", source: "OSRM_TABLE", durationMinutes: from.id === to.id ? 0 : 90,
    distanceKm: from.id === to.id ? 0 : 50 })));
  return { locations, legs, source: "OSRM_TABLE", generatedAt: "2026-10-16T00:00:00Z" };
}

async function session() {
  const result = await planRouteConcepts(brief, { getMatrix: async locations => matrix(locations),
    now: () => "2026-10-16T00:00:00Z" });
  const selectedId = result.concepts[0].routeConcept.id;
  const detail = await generatePlanningV2Itinerary(result, selectedId, { getPlaces: async () => places,
    getAiPlan: async () => ({ schemaVersion: 2, routeConceptId: selectedId, days: [
      { day: 1, placeIds: ["p1", "p2"] }, { day: 2, placeIds: ["p3"] },
      { day: 3, placeIds: [] }, { day: 4, placeIds: [] },
    ] }) });
  return showPlanningItinerary(selectPlanningConcept(showPlanningConcepts(result), selectedId), selectedId, detail);
}

const activityIds = (day: NonNullable<Awaited<ReturnType<typeof session>>["detailed"]>["itinerary"]["days"][number]) =>
  day.items.filter(item => item.category === "activity").map(item => item.id);

test("reordering and moving keep item identity while recalculating schedules and ledger days", async () => {
  const original = await session();
  const firstId = activityIds(original.detailed!.itinerary.days[0])[0];
  const secondId = activityIds(original.detailed!.itinerary.days[0])[1];
  const reordered = applyPlanningV2Edit(original, { type: "reorder", itemId: secondId, direction: -1 });
  assert.deepEqual(activityIds(reordered.detailed!.itinerary.days[0]), [secondId, firstId]);
  assert.equal(reordered.detailed!.itinerary.days[0].items.find(item => item.id === secondId)?.plannedStart, "09:00");
  const moved = applyPlanningV2Edit(reordered, { type: "move", itemId: firstId, targetDay: 2 });
  assert.deepEqual(activityIds(moved.detailed!.itinerary.days[0]), [secondId]);
  assert.ok(activityIds(moved.detailed!.itinerary.days[1]).includes(firstId));
  assert.equal(moved.detailed!.ledger.sourceLines.find(line => line.id === `cost:${firstId}`)?.day, 2);
  assert.equal(moved.detailed!.ledger.summary.byDay[1].minimum, 0);
  assert.equal(moved.detailed!.ledger.summary.byDay[2].minimum, 40);
  assert.equal(moved.detailed!.itinerary.routeConceptId, original.selectedConceptId);
  assert.deepEqual(moved.detailed!.itinerary.days.map(day => day.city), original.detailed!.itinerary.days.map(day => day.city));
  assert.notEqual(moved.detailed!.readiness, "INVALID");
  assert.ok(!moved.detailed!.validation.issues.some(issue => issue.code === "ITEMS_OVERLAP"));
  const undone = undoPlanningV2Edit(moved);
  assert.deepEqual(activityIds(undone.detailed!.itinerary.days[0]), [secondId, firstId]);
  const redone = redoPlanningV2Edit(undone);
  assert.ok(activityIds(redone.detailed!.itinerary.days[1]).includes(firstId));
  const reopened = selectPlanningConcept(returnToPlanningConcepts(redone), original.selectedConceptId!);
  assert.ok(activityIds(reopened.detailed!.itinerary.days[1]).includes(firstId));
  assert.equal(reopened.editPast?.length, 2);
});

test("replacement uses a trusted same-city place and keeps the activity ID", async () => {
  const original = await session();
  const itemId = activityIds(original.detailed!.itinerary.days[0])[1];
  const replaced = applyPlanningV2Edit(original, { type: "replace", itemId, placeId: "p4" });
  assert.equal(replaced.detailed!.itinerary.days[0].items.find(item => item.id === itemId)?.placeId, "p4");
  assert.equal(replaced.detailed!.ledger.sourceLines.find(line => line.id === `cost:${itemId}`)?.unitPrice.kind, "UNKNOWN");
  const priced = applyPlanningV2Edit(replaced, { type: "replace", itemId, placeId: "p3" });
  assert.equal(priced.detailed!.ledger.lines.find(line => line.input.id === `cost:${itemId}`)?.total?.exact, 30);
  assert.equal(priced.detailed!.ledger.summary.byDay[1].minimum, 40);
  const untrusted = applyPlanningV2Edit(priced, { type: "replace", itemId, placeId: "elsewhere" });
  assert.equal(untrusted.detailed, priced.detailed);
  assert.match(untrusted.editError!, /trusted place/);
  const duplicate = applyPlanningV2Edit(priced, { type: "replace", itemId, placeId: "p1" });
  assert.equal(duplicate.detailed, priced.detailed);
});

test("remove, undo and redo preserve route and known prices", async () => {
  const original = await session();
  const itemId = activityIds(original.detailed!.itinerary.days[0])[0];
  const removed = applyPlanningV2Edit(original, { type: "remove", itemId });
  assert.ok(!removed.detailed!.itinerary.days[0].items.some(item => item.id === itemId));
  assert.ok(!removed.detailed!.ledger.sourceLines.some(line => line.id === `cost:${itemId}`));
  assert.equal(removed.detailed!.ledger.summary.trip.minimum, 30);
  assert.equal(undoPlanningV2Edit(removed).detailed, original.detailed);
  assert.equal(redoPlanningV2Edit(undoPlanningV2Edit(removed)).detailed, removed.detailed);
});

test("incompatible moves and over-budget replacements leave the prior validated plan intact", async () => {
  const original = await session();
  const itemId = activityIds(original.detailed!.itinerary.days[0])[0];
  const otherId = activityIds(original.detailed!.itinerary.days[0])[1];
  const full = applyPlanningV2Edit(original, { type: "move", itemId, targetDay: 2 });
  assert.ok(activityIds(full.detailed!.itinerary.days[1]).includes(itemId));
  const duplicate = applyPlanningV2Edit(full, { type: "move", itemId: otherId, targetDay: 2 });
  assert.ok(activityIds(duplicate.detailed!.itinerary.days[1]).includes(otherId));
  assert.equal(duplicate.editError, undefined);
  const expensivePlaces = places.map(place => place.databaseId === "p4" ? { ...place,
    priceBasis: "PER_PERSON" as const,
    priceEvidence: { amount: 900, currency: "USD" as const, status: "KNOWN" as const, source: "Test tariff" } } : place);
  const expensiveSession = { ...original, detailed: { ...original.detailed!, places: expensivePlaces } };
  const rejected = applyPlanningV2Edit(expensiveSession, { type: "replace", itemId, placeId: "p4" });
  assert.equal(rejected.detailed, expensiveSession.detailed);
  assert.match(rejected.editError!, /infeasible/);
});


test("add, free time, duration, removal and restore retain independent stable IDs through undo", async () => {
  const original = await session();
  const added = applyPlanningV2Edit(original, { type: "add", day: 3, placeId: "p4" });
  const id = activityIds(added.detailed!.itinerary.days[2])[0];
  assert.ok(id);
  const free = applyPlanningV2Edit(added, { type: "free-time", day: 3 });
  assert.equal(activityIds(free.detailed!.itinerary.days[2]).length, 2);
  const timed = applyPlanningV2Edit(free, { type: "timing", itemId: id, durationMinutes: 120, preferredStart: "11:00" });
  const item = timed.detailed!.itinerary.days[2].items.find(item => item.id === id)!;
  assert.equal(item.plannedStart, "11:00");
  assert.equal(item.plannedEnd, "13:00");
  const removed = applyPlanningV2Edit(timed, { type: "remove", itemId: id });
  assert.equal(removed.detailed!.unscheduledActivities?.[0].id, id);
  const restored = applyPlanningV2Edit(removed, { type: "restore", day: 4, itemId: id });
  assert.ok(activityIds(restored.detailed!.itinerary.days[3]).includes(id));
  assert.equal(restored.detailed!.unscheduledActivities?.length, 0);
  assert.equal(undoPlanningV2Edit(restored).detailed, removed.detailed);
  assert.equal(redoPlanningV2Edit(undoPlanningV2Edit(restored)).detailed, restored.detailed);
  assert.deepEqual(restored.detailed!.itinerary.days[0], original.detailed!.itinerary.days[0]);
});

test("an existing over-budget draft can be repaired without first becoming affordable", async () => {
  const original = await session();
  const result = { ...original.result!, brief: { ...brief, budget: { amount: 5, currency: "USD" as const } } };
  const detail = await generatePlanningV2Itinerary(result, original.selectedConceptId!, { getPlaces: async () => places,
    getAiPlan: async () => ({ schemaVersion: 2, routeConceptId: original.selectedConceptId!, days: [
      { day: 1, placeIds: ["p1", "p3"] }, { day: 2, placeIds: [] }, { day: 3, placeIds: [] }, { day: 4, placeIds: [] }] }) });
  const invalid = { ...original, result, detailed: detail };
  const id = activityIds(detail.itinerary.days[0])[0];
  const repaired = applyPlanningV2Edit(invalid, { type: "remove", itemId: id });
  assert.equal(repaired.editError, undefined);
  assert.equal(repaired.detailed!.ledger.summary.trip.minimum, 30);
  assert.equal(repaired.detailed!.validation.budget.status, "OVER_BUDGET");
});


test("personal allowances use explicit rooms and party quantities without rewriting price evidence", async () => {
  const original = await session();
  const familyBrief = { ...brief, durationDays: 4, travellerCount: 6 };
  let updated = applyPlanningV2Edit(original, { type: "allowance", group: "stays", allowance: { amount: 100, basis: "ROOM_NIGHT", rooms: 2 } });
  updated = applyPlanningV2Edit(updated, { type: "allowance", group: "meals", allowance: { amount: 10, basis: "PERSON_DAY" } });
  const budget = planningBudget(updated.detailed!, familyBrief);
  assert.equal(budget.rows.find(row => row.key === "stays")?.allowanceTotal, 600);
  assert.equal(budget.rows.find(row => row.key === "meals")?.allowanceTotal, 240);
  assert.equal(budget.scenarioMinimum, 880); // 40 supported + 600 rooms + 240 meals
  assert.ok(budget.uncovered.includes("Local transport"));
  assert.equal(updated.detailed!.ledger, original.detailed!.ledger);
  assert.equal(undoPlanningV2Edit(updated).detailed?.allowances?.meals, undefined);
  const unknownRooms = planningBudget({ ...updated.detailed!, allowances: { stays: { amount: 100, basis: "ROOM_NIGHT" } } }, familyBrief);
  assert.equal(unknownRooms.rows.find(row => row.key === "stays")?.allowanceTotal, undefined);
});
