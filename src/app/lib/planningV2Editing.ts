import { recalculatePlanningV2Itinerary, type DetailedPlanningResult } from "./planningV2Itinerary.ts";
import { eligibleActivityPlaces } from "./planningV2Places.ts";
import type { DaySelection } from "./planningV2Scheduling.ts";
import type { PlanningV2Session } from "./planningV2Session.ts";

export type PlanningV2Edit =
  | { type: "allowance"; group: import("./planningBudget").BudgetGroup; allowance?: import("./planningBudget").PlanningAllowance }
  | { type: "add"; day: number; placeId: string }
  | { type: "free-time"; day: number }
  | { type: "restore"; day: number; itemId: string }
  | { type: "timing"; itemId: string; durationMinutes: number; preferredStart?: string }
  | { type: "remove"; itemId: string }
  | { type: "replace"; itemId: string; placeId: string }
  | { type: "reorder"; itemId: string; direction: -1 | 1 }
  | { type: "move"; itemId: string; targetDay: number };

const HISTORY_LIMIT = 20;

function selectionsFrom(detail: DetailedPlanningResult): DaySelection[] {
  return detail.itinerary.days.map(day => {
    const activities = day.items.filter(item => item.category === "activity").map(item => {
      if (!item.placeId && !item.isFreeTime) throw new Error("An activity has lost its trusted place reference.");
      return { id: item.id, placeId: item.placeId ?? "", description: item.detail,
        isFreeTime: item.isFreeTime, durationMinutes: item.durationMinutes, preferredStart: item.preferredStart };
    });
    return { placeIds: activities.map(item => item.placeId), activities, note: day.localTip };
  });
}

/** Reject edits outside the selected base, untrusted candidates, duplicates, and infeasible results. */
export function applyPlanningV2Edit(session: PlanningV2Session, edit: PlanningV2Edit): PlanningV2Session {
  const { result, selectedConceptId, detailed } = session;
  if (!result || !selectedConceptId || !detailed || session.view !== "itinerary") return session;
  try {
    if (edit.type === "allowance") {
      if (edit.allowance && (!Number.isFinite(edit.allowance.amount) || edit.allowance.amount < 0 || edit.allowance.amount > 10000000)) throw new Error("Enter a nonnegative planning allowance.");
      const allowances = { ...detailed.allowances };
      if (edit.allowance) allowances[edit.group] = edit.allowance; else delete allowances[edit.group];
      return { ...session, detailed: { ...detailed, allowances }, editPast: [...(session.editPast ?? []), detailed].slice(-HISTORY_LIMIT), editFuture: [], editError: undefined };
    }
    const selections = selectionsFrom(detailed);
    const shortlist = [...(detailed.unscheduledActivities ?? [])];
    const adding = edit.type === "add" || edit.type === "free-time" || edit.type === "restore";
    if (adding) {
      const target = selections[edit.day - 1]?.activities;
      const city = detailed.itinerary.days[edit.day - 1]?.city;
      if (!target || !city) throw new Error("Choose an existing day.");
      if (target.length >= 6) throw new Error("Keep at most six activities per day; use another day for more.");
      if (edit.type === "restore") {
        const entry = shortlist.find(item => item.id === edit.itemId);
        if (!entry || entry.city.toLowerCase() !== city.toLowerCase()) throw new Error("Restore this activity to a day in its destination.");
        if (target.some(item => item.placeId && item.placeId === entry.placeId)) throw new Error("This day already includes that place.");
        target.push(entry);
        shortlist.splice(shortlist.indexOf(entry), 1);
      } else if (edit.type === "free-time") {
        target.push({ id: `activity:${crypto.randomUUID()}`, placeId: "", isFreeTime: true,
          description: "Time to rest, explore independently or adapt your day.", durationMinutes: 60 });
      } else {
        if (!eligibleActivityPlaces(detailed.places, city).some(place => place.databaseId === edit.placeId) ||
          target.some(item => item.placeId === edit.placeId)) throw new Error("Choose a different trusted place in this destination.");
        target.push({ id: `activity:${crypto.randomUUID()}`, placeId: edit.placeId });
      }
    } else {
      const sourceDayIndex = selections.findIndex(day => day.activities?.some(item => item.id === edit.itemId));
    if (sourceDayIndex < 0) throw new Error("That activity is no longer in this itinerary.");
    const source = selections[sourceDayIndex].activities!;
    const index = source.findIndex(item => item.id === edit.itemId);
    const current = source[index];
    const sourceCity = detailed.itinerary.days[sourceDayIndex].city;
    if (edit.type === "remove") {
      source.splice(index, 1);
      const item = detailed.itinerary.days[sourceDayIndex].items.find(item => item.id === edit.itemId)!;
      shortlist.push({ ...current, city: sourceCity, label: item.label });
    } else if (edit.type === "timing") {
      if (!Number.isInteger(edit.durationMinutes) || edit.durationMinutes < 15 || edit.durationMinutes > 480 ||
        edit.preferredStart && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(edit.preferredStart)) throw new Error("Choose a duration from 15 to 480 minutes and a valid preferred time.");
      source[index] = { ...current, durationMinutes: edit.durationMinutes, preferredStart: edit.preferredStart };
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
      if (target.length >= 6 ||
          target.some(item => item.placeId === current.placeId || item.id === current.id)) {
        throw new Error("The destination day is full or already includes this place.");
      }
      source.splice(index, 1);
      target.push(current);
    }
    }
    for (const day of selections) day.placeIds = day.activities!.map(item => item.placeId);
    const next = recalculatePlanningV2Itinerary(result, selectedConceptId, detailed, selections);
    // Existing problems must remain repairable, but an edit may not introduce new errors.
    const key = (issue: DetailedPlanningResult["validation"]["issues"][number]) => `${issue.code}:${issue.day ?? ""}:${issue.itemId ?? ""}:${issue.legId ?? ""}`;
    const oldErrors = new Set(detailed.validation.errors.map(key));
    if (next.validation.errors.some(issue => !oldErrors.has(key(issue))) ||
      next.validation.budget.minimum > detailed.validation.budget.minimum && next.validation.budget.status === "OVER_BUDGET") {
      throw new Error("That change would make the itinerary infeasible. The previous plan was kept.");
    }
    next.unscheduledActivities = shortlist;
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
