import { buildDetailedPlanningResult, type DetailedPlanningResult } from "./planningV2Itinerary.ts";
import { validatePlanningBrief } from "./planningV2.ts";
import type { PlanningV2Session } from "./planningV2Session";

export const PLANNING_DRAFT_KEY = "wanderroute_planning_draft_v1";
const MAX_BYTES = 2_000_000;
type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type StoredRevision = Pick<DetailedPlanningResult, "places" | "generationMode" | "generationIssue" |
  "allowances" | "customization" | "unscheduledActivities"> & {
  context: NonNullable<DetailedPlanningResult["planningContext"]>;
  selectedId: string;
  selections: { placeIds: string[]; activities: { id: string; placeId: string; description?: string;
    durationMinutes?: number; preferredStart?: string; isFreeTime?: boolean }[]; note?: string }[];
  exchangeRates: DetailedPlanningResult["ledger"]["exchangeRates"];
};

function storeRevision(detail: DetailedPlanningResult): StoredRevision {
  if (!detail.planningContext || !detail.itinerary.routeConceptId) throw new Error("Draft lacks route context.");
  const context = { ...detail.planningContext, concepts: [
    ...detail.planningContext.concepts.filter(item => item.routeConcept.id === detail.itinerary.routeConceptId),
    ...detail.planningContext.concepts.filter(item => item.routeConcept.id !== detail.itinerary.routeConceptId),
  ].slice(0, 6) };
  return { context, selectedId: detail.itinerary.routeConceptId,
    places: detail.places, generationMode: detail.generationMode, generationIssue: detail.generationIssue,
    allowances: detail.allowances, customization: detail.customization, unscheduledActivities: detail.unscheduledActivities,
    exchangeRates: detail.ledger.exchangeRates,
    selections: detail.itinerary.days.map(day => ({ note: day.localTip,
      placeIds: day.items.filter(item => item.category === "activity").map(item => item.placeId ?? ""),
      activities: day.items.filter(item => item.category === "activity").map(item => ({ id: item.id,
        placeId: item.placeId ?? "", description: item.detail, durationMinutes: item.durationMinutes,
        preferredStart: item.preferredStart, isFreeTime: item.isFreeTime })) })) };
}

function restoreRevision(raw: StoredRevision): DetailedPlanningResult {
  const context = raw?.context;
  if (!context || validatePlanningBrief(context.brief).length ||
      !Array.isArray(context.concepts) || context.concepts.length > 20 ||
      !Array.isArray(context.matrix?.locations) || context.matrix.locations.length > 30 ||
      !Array.isArray(context.matrix.legs) || context.matrix.legs.length !== context.matrix.locations.length ||
      context.matrix.legs.some(row => !Array.isArray(row) || row.length !== context.matrix.locations.length) ||
      !["AI", "LIMITED_DRAFT"].includes(raw.generationMode) ||
      !Array.isArray(raw.places) || raw.places.length > 2000 ||
      !Array.isArray(raw.selections) || raw.selections.length !== context.brief.durationDays) throw new Error("Unsupported saved draft.");
  const selected = context.concepts.find(concept => concept.routeConcept.id === raw.selectedId);
  if (!selected || selected.candidate.destinations.length < 1 || selected.candidate.destinations.length > 8) throw new Error("Missing saved route.");
  const ids = new Set<string>();
  for (const day of raw.selections) {
    if (!Array.isArray(day.activities) || day.activities.length > 6) throw new Error("Invalid saved activities.");
    for (const item of day.activities) {
      if (!item || typeof item.id !== "string" || !item.id || ids.has(item.id) ||
          typeof item.placeId !== "string" || !item.isFreeTime && !raw.places.some(place => place.databaseId === item.placeId)) throw new Error("A saved activity has lost its identity or place.");
      ids.add(item.id);
    }
  }
  const detailed = buildDetailedPlanningResult(context, raw.selectedId, raw.places, raw.selections,
    raw.generationMode, raw.generationIssue, raw.exchangeRates, raw.customization);
  detailed.allowances = raw.allowances;
  detailed.unscheduledActivities = raw.unscheduledActivities ?? [];
  return detailed;
}

/** Browser-local only. Never write a restored or test draft to the production trip database. */
export function savePlanningDraft(storage: DraftStorage, session: PlanningV2Session): boolean {
  if (!session.detailed) return true; // Keep the previous usable draft while a replacement is being prepared.
  try {
    const payload = { schemaVersion: 1, savedAt: new Date().toISOString(), current: storeRevision(session.detailed),
      past: (session.editPast ?? []).slice(-6).map(storeRevision), future: (session.editFuture ?? []).slice(0, 6).map(storeRevision),
      preferredRevision: session.preferredRevision };
    let serialized = JSON.stringify(payload);
    while (serialized.length > MAX_BYTES && (payload.past.length || payload.future.length)) {
      if (payload.past.length) payload.past.shift(); else payload.future.pop();
      serialized = JSON.stringify(payload);
    }
    if (serialized.length > MAX_BYTES) return false;
    storage.setItem(PLANNING_DRAFT_KEY, serialized);
    return true;
  } catch { return false; }
}

export function loadPlanningDraft(storage: DraftStorage): PlanningV2Session | undefined {
  try {
    const text = storage.getItem(PLANNING_DRAFT_KEY);
    if (!text || text.length > MAX_BYTES) return undefined;
    const value = JSON.parse(text);
    if (value.schemaVersion !== 1 || !Array.isArray(value.past) || !Array.isArray(value.future) ||
        value.past.length > 6 || value.future.length > 6) return undefined;
    const detailed = restoreRevision(value.current);
    return { view: "itinerary", detailed, result: detailed.planningContext, brief: detailed.planningContext!.brief,
      selectedConceptId: detailed.itinerary.routeConceptId,
      editPast: value.past.map(restoreRevision), editFuture: value.future.map(restoreRevision),
      preferredRevision: typeof value.preferredRevision === "string" ? value.preferredRevision : undefined };
  } catch { return undefined; } // Do not delete an unreadable user's draft or unrelated storage.
}

export function removePlanningDraft(storage: DraftStorage): boolean {
  try { storage.removeItem(PLANNING_DRAFT_KEY); return true; } catch { return false; }
}
