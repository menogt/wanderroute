import assert from "node:assert/strict";
import { test } from "node:test";
import { PLANNING_DRAFT_KEY, loadPlanningDraft, savePlanningDraft, removePlanningDraft } from "./planningDraft.ts";
import { planRouteConcepts } from "./planningV2.ts";
import { generatePlanningV2Itinerary } from "./planningV2Itinerary.ts";
import { applyPlanningV2Edit, undoPlanningV2Edit } from "./planningV2Editing.ts";
import { planningPresentation } from "./planningPresentation.ts";
import { showPlanningConcepts, showPlanningItinerary, selectPlanningConcept } from "./planningV2Session.ts";
import type { TripBriefV1 } from "./planningTypes";

function memoryStorage() {
  const records = new Map<string, string>([["other-app-data", "keep"]]);
  return { records, getItem: (key: string) => records.get(key) ?? null,
    setItem: (key: string, value: string) => { records.set(key, value); }, removeItem: (key: string) => { records.delete(key); } };
}
async function fixture() {
  const brief: TripBriefV1 = { schemaVersion: 1, durationDays: 3, travellerCount: 2, interests: ["culture"], requestedCities: ["Kandy"], budget: { amount: 1000, currency: "USD" }, transportPreference: "PUBLIC_TRANSPORT" };
  const result = await planRouteConcepts(brief, { getMatrix: async locations => ({ locations, source: "UNAVAILABLE", generatedAt: "2026-10-24", legs: locations.map(from => locations.map(to => ({ fromId: from.id, toId: to.id, status: "UNAVAILABLE" }))) }) });
  const id = result.concepts[0].routeConcept.id;
  const detail = await generatePlanningV2Itinerary(result, id, { getPlaces: async () => [{ databaseId: "garden", city: "Kandy", category: "attraction", name: "Garden" }], getAiPlan: async () => { throw new Error("Unavailable"); } });
  return showPlanningItinerary(selectPlanningConcept(showPlanningConcepts(result), id), id, detail);
}
const presentation = (session: Awaited<ReturnType<typeof fixture>>) => planningPresentation(session.detailed!, session.result!.brief, session.result!.concepts.find(concept => concept.routeConcept.id === session.selectedConceptId)!);

test("local recovery rebuilds current facts, stable IDs, approval and undo history", async () => {
  const storage = memoryStorage(); const session = await fixture();
  const current = applyPlanningV2Edit(session, { type: "free-time", day: 2 });
  current.preferredRevision = presentation(current).revision;
  assert.equal(savePlanningDraft(storage, current), true);
  const stored = JSON.parse(storage.records.get(PLANNING_DRAFT_KEY)!);
  assert.equal(stored.current.ledger, undefined); // Never trust cached totals or readiness.
  assert.equal(stored.current.validation, undefined);
  const restored = loadPlanningDraft(storage)!;
  assert.equal(presentation(restored).revision, presentation(current).revision);
  assert.equal(restored.preferredRevision, presentation(restored).revision);
  assert.equal(presentation(undoPlanningV2Edit(restored)).revision, presentation(session).revision);
  assert.equal(restored.detailed!.generationMode, "LIMITED_DRAFT");
  assert.equal(storage.records.get("other-app-data"), "keep");
});

test("invalid stored identities, versions and route facts never restore or erase user data", async () => {
  const storage = memoryStorage(); savePlanningDraft(storage, await fixture());
  const original = storage.records.get(PLANNING_DRAFT_KEY)!;
  for (const mutate of [
    (value: any) => { value.schemaVersion = 999; },
    (value: any) => { value.current.selections[0].activities[0].placeId = "missing"; },
    (value: any) => { value.current.context.brief.durationDays = 30; },
    (value: any) => { value.current.selectedId = "missing-route"; },
  ]) {
    const value = JSON.parse(original); mutate(value); const text = JSON.stringify(value);
    storage.setItem(PLANNING_DRAFT_KEY, text);
    assert.equal(loadPlanningDraft(storage), undefined);
    assert.equal(storage.getItem(PLANNING_DRAFT_KEY), text);
  }
  storage.setItem(PLANNING_DRAFT_KEY, "broken JSON"); assert.equal(loadPlanningDraft(storage), undefined);
  assert.equal(storage.records.get("other-app-data"), "keep");
});

test("quota failures keep the current session usable and replacing a draft never erases its predecessor early", async () => {
  const storage = memoryStorage(); const session = await fixture(); savePlanningDraft(storage, session);
  const previous = storage.getItem(PLANNING_DRAFT_KEY);
  assert.equal(savePlanningDraft(storage, { view: "brief" }), true);
  assert.equal(storage.getItem(PLANNING_DRAFT_KEY), previous);
  const blocked = { ...storage, setItem: () => { throw new Error("Quota exceeded"); } };
  assert.equal(savePlanningDraft(blocked, session), false);
  assert.ok(session.detailed!.itinerary.days.length);
  assert.equal(removePlanningDraft(storage), true);
  assert.equal(storage.getItem(PLANNING_DRAFT_KEY), null);
  assert.equal(storage.records.get("other-app-data"), "keep");
});
