import type { Currency } from "../../components/rl/types";
import { scheduleMinute, civilDay } from "../planningCalendar.ts";
import { TRANSFER_POLICY } from "../routeConstraints.ts";
import { assessPlanningSeason } from "../routeSeason.ts";
import { matrixLeg, type MatrixLocation, type TravelMatrix } from "../travelTimeMatrix.ts";
import { airports, isTown, locations, locationName, studioPlace } from "./catalog.ts";
import { addDays, studioCalendar, type StudioDates } from "./dates.ts";

export const currencies: Currency[] = ["USD", "EUR", "GBP", "AUD", "LKR"];
export const modes = {
  undecided: "Choose later", private: "Private transfer", drive: "Self-drive", rail: "Train", bus: "Bus",
} as const;
export type StudioMode = keyof typeof modes;
export const paceMinutes = { relaxed: 150, balanced: 210, fast: 300 };
export const MAX_BASES = 8;
export const MAX_NIGHTS = 20;

export type StudioStay = {
  name: string;
  lock?: { checkIn: string; checkOut: string };
  recorded?: { amount: number; currency: Currency; paid: boolean; nights: number; checkIn?: string };
  rateId?: string;
};
export type StudioBase = { place: string; nights: number; stay?: StudioStay };
export type StudioVisit = { place: string; dayKey: string };
export type StudioBudget = {
  currency: Currency;
  target?: number;
  meals?: number;
  other?: number;
  usdConversion?: { rate: number; checked: string };
};
export type StudioPlan = {
  version: 1;
  dates: StudioDates;
  start: string | null;
  end: string | null;
  party: number | null;
  pace: keyof typeof paceMinutes;
  mode: StudioMode;
  legModes: Record<string, StudioMode>;
  wishes: { place: string; required: boolean }[];
  bases: StudioBase[];
  visits: StudioVisit[];
  budget: StudioBudget;
};

export function newStudioPlan(): StudioPlan {
  return {
    version: 1, dates: { kind: "unset" }, start: null, end: null, party: null, pace: "balanced",
    mode: "undecided", legModes: {}, wishes: [], bases: [], visits: [], budget: { currency: "USD" },
  };
}

export type StudioDay = { key: string; number: number; date?: string; base?: StudioBase; visits: StudioVisit[] };
export type StudioLeg = {
  id: string; from: string; to: string; day: number; kind: "arrival" | "transfer" | "departure" | "visit";
  mode: StudioMode; roadMinutes?: number; distanceKm?: number; noRoad?: boolean;
};
export type StudioIssue = { severity: "conflict" | "advice" | "unknown"; message: string };
const legId = (from: string, to: string) => `${from} → ${to}`;
export const canUseDriveTime = (mode: StudioMode) => mode === "private" || mode === "drive";

export function studioDays(plan: StudioPlan): StudioDay[] {
  const calendar = studioCalendar(plan.dates);
  const days: StudioDay[] = [];
  for (const base of plan.bases) {
    for (let night = 0; night < base.nights; night++) {
      const key = `${base.place}:${night}`;
      days.push({
        key, number: days.length + 1,
        date: days.length < (calendar.nights ?? Infinity) ? addDays(calendar.start, days.length) : undefined,
        base, visits: plan.visits.filter(visit => visit.dayKey === key),
      });
    }
  }
  if (days.length) {
    while (days.length < (calendar.nights ?? 0)) {
      days.push({ key: `unallocated:${days.length}`, number: days.length + 1, date: addDays(calendar.start, days.length), visits: [] });
    }
    days.push({ key: "departure", number: days.length + 1,
      date: days.length === calendar.nights ? calendar.end : undefined, visits: [] });
  }
  return days;
}

export function stayWindow(plan: StudioPlan, base: StudioBase) {
  const calendar = studioCalendar(plan.dates);
  if (!calendar.start || calendar.provisional) return undefined;
  const index = plan.bases.findIndex(b => b.place === base.place);
  if (index < 0) return undefined;
  const offset = plan.bases.slice(0, index).reduce((sum, b) => sum + b.nights, 0);
  return { checkIn: addDays(calendar.start, offset)!, checkOut: addDays(calendar.start, offset + base.nights)! };
}

export function lockedStayConflict(plan: StudioPlan): StudioBase | undefined {
  return plan.bases.find(base => {
    if (!base.stay?.lock) return false;
    const current = stayWindow(plan, base);
    return current?.checkIn !== base.stay.lock.checkIn || current?.checkOut !== base.stay.lock.checkOut;
  });
}

export function studioLegs(plan: StudioPlan, matrix?: TravelMatrix): StudioLeg[] {
  const legs: StudioLeg[] = [];
  function add(from: string | null, to: string | null, day: number, kind: StudioLeg["kind"]) {
    if (!from || !to || from === to) return;
    const id = legId(from, to);
    const road = matrix && matrixLeg(matrix, from, to);
    legs.push({
      id, from, to, day, kind, mode: plan.legModes[id] ?? plan.mode,
      roadMinutes: road?.durationMinutes, distanceKm: road?.distanceKm, noRoad: road?.status === "UNROUTABLE",
    });
  }
  let former = plan.start;
  const days = studioDays(plan);
  for (const day of days) {
    if (!day.base) continue;
    const town = day.base.place;
    add(former, town, day.number, day.number === 1 ? "arrival" : "transfer");
    former = town;
    const visited = new Set(day.visits.map(v => studioPlace.get(v.place)?.town).filter(place => place && place !== town));
    for (const target of visited) {
      add(town, target!, day.number, "visit");
      add(target!, town, day.number, "visit");
    }
  }
  add(former, plan.end, studioCalendar(plan.dates).days ?? (days.length || 1), "departure");
  return legs;
}

export function roadLocations(plan: StudioPlan): MatrixLocation[] {
  const towns = plan.visits.map(visit => studioPlace.get(visit.place)?.town);
  return [...new Set([plan.start, plan.end, ...plan.bases.map(b => b.place), ...towns])]
    .flatMap(id => id && locations[id]?.coordinates ? [locations[id]] : []);
}

export function flightArrivalReserved(plan: StudioPlan) {
  return airports.has(plan.start ?? "") && !!studioCalendar(plan.dates).arrivalTime;
}

export function studioIssues(plan: StudioPlan, matrix?: TravelMatrix): StudioIssue[] {
  const result: StudioIssue[] = [];
  const add = (severity: StudioIssue["severity"], message: string) => result.push({ severity, message });
  const calendar = studioCalendar(plan.dates);
  const days = studioDays(plan);
  const nights = plan.bases.reduce((sum, base) => sum + base.nights, 0);
  const legs = studioLegs(plan, matrix);
  if (calendar.nights !== undefined && calendar.nights !== nights) {
    const difference = calendar.nights - nights;
    add(difference > 0 ? "advice" : "conflict", difference > 0
      ? `Allocate ${difference} more ${difference === 1 ? "night" : "nights"} in Journey.`
      : `Remove ${-difference} allocated ${difference === -1 ? "night" : "nights"}, or change your travel dates if they are flexible.`);
  }
  if (plan.bases.length && (!plan.start || !plan.end)) add("unknown", "Set both endpoints to include the complete journey.");
  if (plan.bases.length && calendar.days === undefined) add("unknown", "Add travel dates or a period to check nights and regional conditions.");
  if (plan.bases.length >= 3 && nights / plan.bases.length < 1.5) add("advice", "Most bases have one night. Consider fewer hotel changes or combine nearby visits from one base.");
  if (plan.start?.startsWith("custom:") || plan.end?.startsWith("custom:")) add("unknown", "A custom endpoint needs a location check. Its transfer is unpriced and unrouted.");
  if (legs.some(leg => leg.noRoad && canUseDriveTime(leg.mode))) add("unknown", "A road segment could not be routed. Verify access before relying on it.");
  if (legs.some(leg => !canUseDriveTime(leg.mode) || leg.roadMinutes === undefined)) add("unknown", "Some transfer times need checking. Train and bus times are separate from the car reference.");
  for (const day of new Set(legs.map(leg => leg.day))) {
    const number = legs.filter(leg => leg.day === day && canUseDriveTime(leg.mode)).reduce((sum, leg) => sum + (leg.roadMinutes ?? 0), 0);
    if (number > paceMinutes[plan.pace]) add("advice", `Day ${day} includes at least ${Math.round(number)} minutes of estimated driving. Try fewer transfers or a nearer base.`);
  }
  for (const day of days) {
    const limit = plan.pace === "relaxed" ? 2 : 3;
    if (day.visits.length > limit) {
      add("advice", `Day ${day.number} has ${day.visits.length} planned visits. Move a visit to another day or confirm enough time for all of them.`);
    }
  }
  const locked = lockedStayConflict(plan);
  if (locked) add("conflict", `The current dates do not fit the locked stay in ${locked.place}. Change the dates or explicitly unlock and revise that stay.`);
  const boundary = legs.find(leg => leg.kind === "arrival");
  const arrival = scheduleMinute(calendar.arrivalTime);
  if (flightArrivalReserved(plan)) {
    const firstDayHasVisits = days.some(day => day.number === 1 && day.visits.length);
    if (firstDayHasVisits) add("conflict", "Move the first day's visits to leave time for airport clearance and transfer.");
    if (arrival !== undefined && boundary?.roadMinutes !== undefined && canUseDriveTime(boundary.mode) &&
        arrival + TRANSFER_POLICY.arrivalProcessingMinutes + boundary.roadMinutes >= 1440) {
      add("advice", "Your airport arrival and transfer may run past midnight. Check late check-in or choose a nearer first base.");
    }
  }
  const last = legs.find(leg => leg.kind === "departure");
  const departure = scheduleMinute(calendar.departureTime);
  if (departure !== undefined && airports.has(plan.end ?? "")) {
    const travel = last && canUseDriveTime(last.mode) ? last.roadMinutes : undefined;
    if (departure - TRANSFER_POLICY.departureBufferMinutes - (travel ?? 0) < TRANSFER_POLICY.earliestDepartureTransferMinute) {
      add("advice", "This flight may need a very early or previous-night transfer. Confirm check-in and pickup with the providers.");
    }
    if (last && travel === undefined) add("unknown", "Confirm that the final transfer can reach the airport before the flight check-in buffer.");
  }
  const must = plan.wishes.filter(w => w.required && !plan.bases.some(b => b.place === w.place) &&
    !plan.visits.some(v => v.place === w.place || studioPlace.get(v.place)?.town === w.place));
  for (const wish of must) add("conflict", `Schedule ${studioPlace.get(wish.place)?.name} or clear its must-visit setting.`);
  const cautions = new Set<string>();
  for (const day of days) {
    if (!day.base) continue;
    const month = day.date ? Number(day.date.slice(5, 7)) : calendar.month;
    const towns = new Set([day.base.place, ...day.visits.map(v => studioPlace.get(v.place)!.town)]);
    for (const town of towns) {
      const season = assessPlanningSeason(town, month);
      if (season.status === "CAUTION" || season.status === "AVOID") {
        const key = `${town}/${month}`;
        if (cautions.has(key)) continue;
        cautions.add(key);
        const period = day.date?.slice(0, 7) ?? (plan.dates.kind === "approximate" ? plan.dates.period : "");
        add("advice", `${town} · ${period}: ${season.rule}. Check current conditions.`);
      }
    }
  }
  if (calendar.provisional) add("unknown", `The ${calendar.provisional} date is provisional. Accommodation and activity availability remain unconfirmed.`);
  return result;
}

export function formatEndpoint(id: string | null) {
  return id?.startsWith("custom:") ? id.slice(7) : locationName(id);
}

export function orderAlternative(plan: StudioPlan, matrix: TravelMatrix | undefined) {
  if (plan.bases.length < 2 || !plan.start || !plan.end || matrix?.source !== "OSRM_TABLE") return undefined;
  const calculate = (bases: StudioBase[]) => {
    const candidate = { ...plan, bases };
    if (lockedStayConflict(candidate)) return undefined;
    const legs = studioLegs(candidate, matrix);
    if (legs.some(leg => leg.roadMinutes === undefined)) return undefined;
    const total = legs.reduce((sum, leg) => sum + leg.roadMinutes!, 0);
    const byDay = new Map<number, number>();
    for (const leg of legs) byDay.set(leg.day, (byDay.get(leg.day) ?? 0) + leg.roadMinutes!);
    const dailyPenalty = [...byDay.values()].reduce((sum, minutes) => sum + Math.max(0, minutes - paceMinutes[plan.pace]), 0);
    const calendar = studioCalendar(candidate.dates);
    const weatherPenalty = studioDays(candidate).filter(day => day.base && assessPlanningSeason(day.base.place,
      day.date ? Number(day.date.slice(5, 7)) : calendar.month).status === "AVOID").length * 30;
    const flightPenalty = studioIssues(candidate, matrix).filter(issue => issue.message.includes("past midnight") || issue.message.includes("previous-night")).length * 360;
    return { score: total + dailyPenalty + weatherPenalty + flightPenalty, total };
  };
  const current = calculate(plan.bases);
  if (!current) return undefined;
  // Bounded order search. Each option retains the exact same bases and nights.
  if (studioLegs(plan).some(leg => leg.mode === "rail" || leg.mode === "bus")) return undefined;
  const candidates: StudioBase[][] = [[...plan.bases].reverse()];
  plan.bases.forEach((base, from) => {
    for (let to = 0; to < plan.bases.length; to++) {
      if (from === to) continue;
      const moved = plan.bases.filter(item => item !== base);
      moved.splice(to, 0, base);
      candidates.push(moved);
    }
  });
  let best: { bases: StudioBase[]; total: number; currentTotal: number; score: number } | undefined;
  for (const bases of candidates) {
    const next = calculate(bases);
    if (next && next.score < (best?.score ?? current.score) - 1) best = { bases, total: next.total, score: next.score, currentTotal: current.total };
  }
  return best;
}

export function canScheduleVisit(plan: StudioPlan, place: string, dayKey: string): boolean {
  const day = studioDays(plan).find(item => item.key === dayKey);
  if (!day?.base || day.number === 1 && flightArrivalReserved(plan)) return false;
  const town = studioPlace.get(place)?.town;
  if (!town) return false;
  if (town === day.base.place) return true;
  return day.visits.every(item => item.place === place || [day.base!.place, town].includes(studioPlace.get(item.place)?.town ?? ""));
}

/** A provisional outline preserves every saved destination. Visits stay in the wishlist. */
export function wishlistOutline(plan: StudioPlan): { bases?: StudioBase[]; error?: string } {
  const towns = plan.wishes.map(item => item.place).filter(isTown);
  if (!towns.length || plan.bases.length) return {};
  const calendar = studioCalendar(plan.dates);
  const nights = calendar.nights ?? towns.length * 2;
  if (towns.length > MAX_BASES || towns.length > nights) {
    return { error: "There are too many saved destinations for separate nights. Choose a few bases and add nearby places as day visits." };
  }
  const allocated = Math.floor(nights / towns.length);
  const extra = nights % towns.length;
  return { bases: towns.map((place, index) => ({ place, nights: allocated + (index < extra ? 1 : 0) })) };
}

export function replaceBases(plan: StudioPlan, bases: StudioBase[]): { plan?: StudioPlan; error?: string } {
  if (bases.length > MAX_BASES || bases.reduce((sum, base) => sum + base.nights, 0) > MAX_NIGHTS) {
    return { error: `The workspace supports up to ${MAX_BASES} bases and ${MAX_NIGHTS} allocated nights.` };
  }
  const removedLock = plan.bases.find(base => base.stay?.lock && !bases.some(next => next.place === base.place && next.nights === base.nights));
  if (removedLock) return { error: `Unlock the stay in ${removedLock.place} before moving or removing its nights.` };
  const next = { ...plan, bases };
  for (const base of bases) {
    const lock = base.stay?.lock;
    if (!lock) continue;
    const before = stayWindow(plan, base);
    const after = stayWindow(next, base);
    const fits = after?.checkIn === lock.checkIn && after.checkOut === lock.checkOut;
    if (!fits && (before?.checkIn !== after?.checkIn || before?.checkOut !== after?.checkOut)) {
      return { error: `This would move the locked stay in ${base.place}. Adjust another base or unlock the stay first.` };
    }
  }
  const validDays = new Set(studioDays(next).map(day => day.key));
  if (next.visits.some(visit => !validDays.has(visit.dayKey))) return { error: "Move or remove the visits on the affected nights before changing those nights." };
  return { plan: next };
}

export const validLockedWindow = (checkIn?: string, checkOut?: string) => {
  const first = civilDay(checkIn), last = civilDay(checkOut);
  return first !== undefined && last !== undefined && last > first && last - first <= MAX_NIGHTS;
};
export const knownLocation = (id: string) => Object.prototype.hasOwnProperty.call(locations, id);
export { isTown };
