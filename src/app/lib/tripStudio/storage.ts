import { civilDay } from "../planningCalendar.ts";
import { studioCalendar } from "./dates.ts";
import { studioPlace } from "./catalog.ts";
import { currencies, isTown, knownLocation, MAX_BASES, MAX_NIGHTS, modes, newStudioPlan,
  paceMinutes, studioDays, validLockedWindow, type StudioPlan } from "./model.ts";

export const studioStorageKey = "wanderroute.trip-studio.v1";
export type StudioHistory = {
  current: StudioPlan;
  past: StudioPlan[];
  future: StudioPlan[];
  saved: { id: string; plan: StudioPlan }[];
};

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max: number) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
const money = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1e9;
const currency = (value: unknown) => (currencies as readonly unknown[]).includes(value);
const oneOf = (value: unknown, options: object) => typeof value === "string" && Object.prototype.hasOwnProperty.call(options, value);
const endpoint = (value: unknown) => value === null || typeof value === "string" &&
  (knownLocation(value) || /^custom:.{1,100}$/.test(value) && text(value.slice(7), 100));
const unique = (ids: string[]) => ids.length === new Set(ids).size;

export function validStudioPlan(value: unknown): value is StudioPlan {
  if (!object(value) || value.version !== 1 || !object(value.dates) || !object(value.budget) ||
      !endpoint(value.start) || !endpoint(value.end) || !oneOf(value.mode, modes) || !oneOf(value.pace, paceMinutes) ||
      !object(value.legModes) || Object.keys(value.legModes).length > 300 ||
      Object.entries(value.legModes).some(([key, mode]) => !text(key, 240) || !oneOf(mode, modes))) return false;
  const plan = value as StudioPlan;
  if (!["unset", "exact", "approximate", "partial"].includes(plan.dates.kind)) return false;
  if (plan.dates.kind === "partial" && !["arrival", "departure"].includes(plan.dates.anchor)) return false;
  if ([value.dates.arrivalTime, value.dates.departureTime, value.dates.time].some(time =>
    time !== undefined && (typeof time !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)))) return false;
  const date = plan.dates;
  if (date.kind === "approximate" && typeof date.period !== "string" ||
      date.kind === "exact" && (typeof date.arrival !== "string" || typeof date.departure !== "string") ||
      date.kind === "partial" && typeof date.date !== "string" || studioCalendar(date).issue) return false;
  if (plan.party !== null && (!Number.isInteger(plan.party) || plan.party < 1 || plan.party > 12)) return false;
  const budget = plan.budget;
  if (!currency(budget.currency) || [budget.target, budget.meals, budget.other].some(amount =>
    amount !== undefined && !money(amount))) return false;
  if (budget.usdConversion !== undefined && (!object(budget.usdConversion) || !money(budget.usdConversion.rate) ||
      budget.usdConversion.rate <= 0 || typeof budget.usdConversion.checked !== "string" ||
      civilDay(budget.usdConversion.checked) === undefined)) return false;
  if (!Array.isArray(plan.bases) || plan.bases.length > MAX_BASES ||
      plan.bases.some(base => !object(base) || typeof base.place !== "string" || !isTown(base.place) ||
        !Number.isInteger(base.nights) || base.nights < 1 || base.nights > MAX_NIGHTS ||
        base.stay !== undefined && (!object(base.stay) || !text(base.stay.name, 100) ||
          base.stay.lock !== undefined && (!object(base.stay.lock) || typeof base.stay.lock.checkIn !== "string" ||
            typeof base.stay.lock.checkOut !== "string" || !validLockedWindow(base.stay.lock.checkIn, base.stay.lock.checkOut)) ||
          base.stay.recorded !== undefined && (!object(base.stay.recorded) || !money(base.stay.recorded.amount) ||
            !currency(base.stay.recorded.currency) || typeof base.stay.recorded.paid !== "boolean" ||
            !Number.isInteger(base.stay.recorded.nights) || base.stay.recorded.nights < 1 ||
            base.stay.recorded.nights > MAX_NIGHTS ||
            base.stay.recorded.checkIn !== undefined && (typeof base.stay.recorded.checkIn !== "string" ||
              civilDay(base.stay.recorded.checkIn) === undefined)) ||
          base.stay.rateId !== undefined && !text(base.stay.rateId, 40)))) return false;
  if (!unique(plan.bases.map(b => b.place)) || plan.bases.reduce((sum, b) => sum + b.nights, 0) > MAX_NIGHTS) return false;
  if (!Array.isArray(plan.wishes) || plan.wishes.length > studioPlace.size || plan.wishes.some(w => !object(w) ||
      typeof w.place !== "string" || !studioPlace.has(w.place) || typeof w.required !== "boolean")) return false;
  if (!Array.isArray(plan.visits) || plan.visits.length > studioPlace.size || plan.visits.some(v => !object(v) ||
      typeof v.place !== "string" || !studioPlace.has(v.place) || !text(v.dayKey, 60))) return false;
  if (!unique(plan.wishes.map(w => w.place)) || !unique(plan.visits.map(v => v.place))) return false;
  const activeDays = studioDays(plan).filter(day => day.base);
  return plan.visits.every(v => activeDays.some(day => day.key === v.dayKey)) && activeDays.every(day => {
    const sideTrips = new Set(day.visits.map(v => studioPlace.get(v.place)?.town).filter(town => town !== day.base?.place));
    return sideTrips.size <= 1;
  });
}

export function loadStudio(store?: Pick<Storage, "getItem">): StudioHistory {
  const fallback: StudioHistory = { current: newStudioPlan(), past: [], future: [], saved: [] };
  try {
    const raw = (store ?? localStorage).getItem(studioStorageKey);
    if (!raw || raw.length > 500_000) return fallback;
    const value = JSON.parse(raw);
    if (!object(value) || !validStudioPlan(value.current)) return fallback;
    const history = (key: "future" | "past") => Array.isArray(value[key]) ? value[key].filter(validStudioPlan).slice(-20) : [];
    const saved = Array.isArray(value.saved) ? value.saved.filter(item =>
      object(item) && typeof item.id === "string" && Number.isFinite(Date.parse(item.id)) && validStudioPlan(item.plan)).slice(0, 5) : [];
    return { current: value.current, past: history("past"), future: history("future"), saved };
  } catch {
    return fallback;
  }
}

export function saveStudio(history: StudioHistory, store?: Pick<Storage, "setItem">): boolean {
  try {
    (store ?? localStorage).setItem(studioStorageKey, JSON.stringify(history));
    return true;
  } catch {
    return false;
  }
}
export function reviseStudio(history: StudioHistory, plan: StudioPlan): StudioHistory {
  if (JSON.stringify(plan) === JSON.stringify(history.current) || !validStudioPlan(plan)) return history;
  return { ...history, current: plan, past: [...history.past, history.current].slice(-20), future: [] };
}
export function undoStudio(history: StudioHistory): StudioHistory {
  const current = history.past[history.past.length - 1];
  if (!current) return history;
  return { ...history, current, past: history.past.slice(0, -1), future: [history.current, ...history.future].slice(0, 20) };
}
export function redoStudio(history: StudioHistory): StudioHistory {
  const current = history.future[0];
  if (!current) return history;
  return { ...history, current, past: [...history.past, history.current].slice(-20), future: history.future.slice(1) };
}
