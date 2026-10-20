import { recalculatePlanningV2Itinerary, type DetailedPlanningResult } from "./planningV2Itinerary.ts";
import { eligibleActivityPlaces } from "./planningV2Places.ts";
import type { DaySelection } from "./planningV2Scheduling.ts";
import type { PlanningV2Session } from "./planningV2Session.ts";

export type PlanningV2Edit =
  | { type: "remove"; itemId: string }
  | { type: "replace"; itemId: string; placeId: string }
  | { type: "reorder"; itemId: string; direction: -1 | 1 }
  | { type: "move"; itemId: string; targetDay: number };

const HISTORY_LIMIT = 20;
const PACE_LIMIT = { SLOW_TRAVEL: 1, RELAXED: 2, BALANCED: 2, PACKED: 3 } as const;

function selectionsFrom(detail: DetailedPlanningResult): DaySelection[] {
  return detail.itinerary.days.map(day => {
    const activities = day.items.filter(item => item.category === "activity").map(item => {
      if (!item.placeId) throw new Error("An activity has lost its trusted place reference.");
      return { id: item.id, placeId: item.placeId, description: item.detail };
    });
    return { placeIds: activities.map(item => item.placeId), activities, note: day.localTip };
  });
}

/** Reject edits outside the selected base, untrusted candidates, duplicates, and infeasible results. */
export function applyPlanningV2Edit(session: PlanningV2Session, edit: PlanningV2Edit): PlanningV2Session {
  const { result, selectedConceptId, detailed } = session;
  if (!result || !selectedConceptId || !detailed || session.view !== "itinerary") return session;
  try {
    const selections = selectionsFrom(detailed);
    const sourceDayIndex = selections.findIndex(day => day.activities?.some(item => item.id === edit.itemId));
    if (sourceDayIndex < 0) throw new Error("That activity is no longer in this itinerary.");
    const source = selections[sourceDayIndex].activities!;
    const index = source.findIndex(item => item.id === edit.itemId);
    const current = source[index];
    const sourceCity = detailed.itinerary.days[sourceDayIndex].city;
    if (edit.type === "remove") {
      source.splice(index, 1);
    } else if (edit.type === "replace") {
      const allowed = eligibleActivityPlaces(detailed.places, sourceCity);
      if (!allowed.some(place => place.databaseId === edit.placeId) ||
          source.some(item => item.placeId === edit.placeId && item.id !== edit.itemId)) {
        throw new Error("Choose a different trusted place in this destination.");
      }
      if (current.placeId === edit.placeId) return session;
      source[index] = { id: current.id, placeId: edit.placeId };
    } else if (edit.type === "reorder") {
      const target = index + edit.direction;
      if (target < 0 || target >= source.length) throw new Error("This activity is already at the edge of the day.");
      [source[index], source[target]] = [source[target], source[index]];
    } else {
      const targetIndex = edit.targetDay - 1;
      const target = selections[targetIndex]?.activities;
      const targetCity = detailed.itinerary.days[targetIndex]?.city;
      if (!target || targetIndex === sourceDayIndex || targetCity.toLowerCase() !== sourceCity.toLowerCase()) {
        throw new Error("Activities can move only between days in the same destination.");
      }
      if (target.length >= PACE_LIMIT[result.brief.pace ?? "BALANCED"] ||
          target.some(item => item.placeId === current.placeId || item.id === current.id)) {
        throw new Error("The destination day is full or already includes this place.");
      }
      source.splice(index, 1);
      target.push(current);
    }
    for (const day of selections) day.placeIds = day.activities!.map(item => item.placeId);
    const next = recalculatePlanningV2Itinerary(result, selectedConceptId, detailed, selections);
    if (next.readiness === "INVALID") throw new Error("That change would make the itinerary infeasible. The previous plan was kept.");
    return { ...session, detailed: next, editPast: [...(session.editPast ?? []), detailed].slice(-HISTORY_LIMIT),
      editFuture: [], editError: undefined };
  } catch (error) {
    return { ...session, editError: error instanceof Error ? error.message : "This edit could not be applied." };
  }
}

export function undoPlanningV2Edit(session: PlanningV2Session): PlanningV2Session {
  if (!session.detailed || !session.editPast?.length) return session;
  const previous = session.editPast[session.editPast.length - 1];
  return { ...session, detailed: previous, editPast: session.editPast.slice(0, -1),
    editFuture: [session.detailed, ...(session.editFuture ?? [])].slice(0, HISTORY_LIMIT), editError: undefined };
}

export function redoPlanningV2Edit(session: PlanningV2Session): PlanningV2Session {
  if (!session.detailed || !session.editFuture?.length) return session;
  const [next, ...future] = session.editFuture;
  return { ...session, detailed: next, editPast: [...(session.editPast ?? []), session.detailed].slice(-HISTORY_LIMIT),
    editFuture: future, editError: undefined };
}
