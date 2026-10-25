import assert from "node:assert/strict";
import { test } from "node:test";
import { planRouteConcepts } from "./planningV2.ts";
import { generatePlanningV2Itinerary } from "./planningV2Itinerary.ts";
import { customizationDraft, previewPlanningCustomization } from "./planningCustomization.ts";
import { applyPlanningV2Edit, undoPlanningV2Edit } from "./planningV2Editing.ts";
import { planningPresentation } from "./planningPresentation.ts";
import { PLANNING_DRAFT_KEY, loadPlanningDraft, savePlanningDraft } from "./planningDraft.ts";
import { showPlanningConcepts, selectPlanningConcept, showPlanningItinerary } from "./planningV2Session.ts";
import { knownPlanningDestinations } from "./routeCandidates.ts";
import type { TripBriefV1 } from "./planningTypes";
import type { TravelMatrix } from "./travelTimeMatrix";

async function fixture(minutes = 45) {
  const brief: TripBriefV1 = { schemaVersion: 1, durationDays: 4, travellerCount: 4, interests: ["culture"], budget: { amount: 2000, currency: "USD" }, requestedCities: ["Sigiriya"], transportPreference: "PRIVATE_DRIVER", travelDates: { start: "2027-02-01", end: "2027-02-04" } };
  const locations = knownPlanningDestinations().filter(place => ["Sigiriya", "Dambulla"].includes(place.name));
  const matrix: TravelMatrix = { locations, source: "OSRM_TABLE", generatedAt: "2026-10-24", legs: locations.map(from => locations.map(to => ({ fromId: from.id, toId: to.id, status: "ROUTED", source: "OSRM_TABLE", durationMinutes: from.id === to.id ? 0 : minutes, distanceKm: from.id === to.id ? 0 : 25 }))) };
  const result = await planRouteConcepts(brief, { getMatrix: async () => matrix });
  const id = result.concepts[0].routeConcept.id;
  const detailed = await generatePlanningV2Itinerary(result, id, { getPlaces: async () => [
    { databaseId: "rock", name: "Rock fortress", category: "attraction", city: "Sigiriya" },
    { databaseId: "museum", name: "Museum", category: "attraction", city: "Sigiriya" },
    { databaseId: "cave", name: "Cave temple", category: "temple", city: "Dambulla", priceBasis: "PER_PERSON", priceEvidence: { amount: 10, currency: "USD", status: "KNOWN", source: "Fixture tariff" } },
  ], getAiPlan: async () => { throw new Error("Unavailable"); } });
  return showPlanningItinerary(selectPlanningConcept(showPlanningConcepts(result), id), id, detailed);
}

test("a day visit adds both transfers and admissions while retaining hotel nights, identity and undo", async () => {
  const original = await fixture(); const draft = customizationDraft(original);
  draft.wishlist.push({ city: "Dambulla", role: "VISIT", requirement: "MUST", day: 2, mode: "PRIVATE_DRIVER" });
  const changed = previewPlanningCustomization(original, draft);
  assert.deepEqual(changed.problems, []);
  const next = changed.session!, day = next.detailed!.itinerary.days[1];
  assert.equal(day.city, "Sigiriya"); assert.equal(day.overnightCity, "Sigiriya"); assert.equal(day.visitCity, "Dambulla");
  assert.equal(day.items.filter(item => item.category === "transport").length, 2);
  assert.equal(day.items.find(item => item.placeId === "cave")!.city, "Dambulla");
  assert.equal(next.detailed!.ledger.summary.byCategory.ENTRY_FEES.minimum, 40);
  assert.equal(next.detailed!.ledger.lines.filter(line => line.input.category === "ACCOMMODATION").length, 3);
  assert.equal(next.detailed!.ledger.lines.filter(line => line.input.category === "TRANSPORT").length, 3); // two visit legs plus local transport
  assert.ok(!next.detailed!.validation.errors.some(issue => issue.code === "MUST_VISIT_UNSCHEDULED"));
  assert.equal(next.detailed!.validation.errors.length, 0);
  const plan = planningPresentation(next.detailed!, next.result!.brief, next.result!.concepts[0]);
  assert.equal(plan.days[1].visitCity, "Dambulla"); assert.equal(plan.transfers.length, 2);
  const id = day.items.find(item => item.placeId === "cave")!.id;
  const removed = applyPlanningV2Edit(next, { type: "remove", itemId: id });
  assert.ok(removed.detailed!.unscheduledActivities!.some(item => item.id === id && item.city === "Dambulla"));
  const restored = applyPlanningV2Edit(removed, { type: "restore", itemId: id, day: 2 });
  assert.equal(restored.editError, undefined);
  assert.equal(restored.detailed!.ledger.summary.byCategory.ENTRY_FEES.minimum, 40);
  assert.equal(undoPlanningV2Edit(next).detailed, original.detailed);
  const data = new Map<string, string>(); const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
  savePlanningDraft(storage, next);
  assert.ok(data.has(PLANNING_DRAFT_KEY));
  assert.equal(loadPlanningDraft(storage)!.detailed!.itinerary.days[1].visitCity, "Dambulla");
});

test("unknown public transport visits remain untimed; car estimates never become train schedules", async () => {
  const original = await fixture(); const draft = customizationDraft(original);
  draft.wishlist.push({ city: "Dambulla", role: "VISIT", requirement: "OPTIONAL", day: 2, mode: "TRAIN" });
  const next = previewPlanningCustomization(original, draft).session!;
  assert.equal(next.detailed!.readiness, "NEEDS_CONFIRMATION");
  assert.ok(next.detailed!.itinerary.days[1].items.every(item => !item.plannedStart));
  assert.ok(next.detailed!.transport!.excursions!.every(visit => visit.outbound.durationMinutes === undefined && visit.inbound.durationMinutes === undefined));
  assert.ok(next.detailed!.validation.unknowns.some(issue => issue.code === "DAY_VISIT_SERVICE_UNCONFIRMED"));
});

test("arrival/departure visits and excessive return drives cannot be applied", async () => {
  for (const day of [1, 4]) {
    const original = await fixture(); const draft = customizationDraft(original);
    draft.wishlist.push({ city: "Dambulla", role: "VISIT", requirement: "MUST", day, mode: "PRIVATE_DRIVER" });
    assert.equal(previewPlanningCustomization(original, draft).session, undefined);
  }
  const original = await fixture(240), draft = customizationDraft(original);
  draft.wishlist.push({ city: "Dambulla", role: "VISIT", requirement: "MUST", day: 2, mode: "PRIVATE_DRIVER" });
  assert.equal(previewPlanningCustomization(original, draft).session, undefined);
});

test("a next-day visit cannot assert an early departure when overnight arrival recovery is unknown", async () => {
  const original = await fixture(), draft = customizationDraft(original);
  draft.brief.arrival = { location: "CMB", dateTime: "2027-02-01T23:00" };
  draft.wishlist.push({ city: "Dambulla", role: "VISIT", requirement: "OPTIONAL", day: 2, mode: "PRIVATE_DRIVER" });
  const next = previewPlanningCustomization(original, draft).session!;
  assert.ok(next);
  assert.ok(next.detailed!.itinerary.days[1].items.every(item => !item.plannedStart));
  assert.ok(next.detailed!.validation.unknowns.some(issue => issue.code === "DAY_VISIT_SERVICE_UNCONFIRMED"));
});
