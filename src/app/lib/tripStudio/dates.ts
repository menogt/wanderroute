import { civilDay, scheduleMinute } from "../planningCalendar.ts";

export const MAX_DAYS = 21;

export type StudioDates =
  | { kind: "unset" }
  | { kind: "approximate"; period: string; days: number }
  | { kind: "exact"; arrival: string; departure: string; arrivalTime?: string; departureTime?: string }
  | { kind: "partial"; anchor: "arrival" | "departure"; date: string; days: number; time?: string };

export type StudioCalendar = {
  days?: number;
  nights?: number;
  start?: string;
  end?: string;
  provisional?: "arrival" | "departure";
  month?: number;
  startMonth?: string;
  endMonth?: string;
  arrivalTime?: string;
  departureTime?: string;
  issue?: string;
};

const isoDay = (day: number) => new Date(day * 86_400_000).toISOString().slice(0, 10);
export function addDays(date: string | undefined, offset: number): string | undefined {
  const day = civilDay(date);
  return day === undefined ? undefined : isoDay(day + offset);
}

export function studioCalendar(dates: StudioDates): StudioCalendar {
  if (dates.kind === "unset") return {};
  if (dates.kind === "approximate") {
    if (!/^20\d\d-(?:0[1-9]|1[0-2])$/.test(dates.period)) return { issue: "Choose a travel month and year." };
    if (!validDuration(dates.days)) return { issue: durationMessage };
    return { days: dates.days, nights: dates.days - 1, month: Number(dates.period.slice(5)) };
  }
  const arrivalTime = dates.kind === "exact" ? dates.arrivalTime : dates.anchor === "arrival" ? dates.time : undefined;
  const departureTime = dates.kind === "exact" ? dates.departureTime : dates.anchor === "departure" ? dates.time : undefined;
  if ([arrivalTime, departureTime].some(time => time && scheduleMinute(time) === undefined)) {
    return { issue: "Enter a valid Sri Lanka local time." };
  }
  let start: string | undefined;
  let end: string | undefined;
  let provisional: StudioCalendar["provisional"];
  if (dates.kind === "exact") {
    start = dates.arrival;
    end = dates.departure;
  } else {
    if (!validDuration(dates.days)) return { issue: durationMessage };
    provisional = dates.anchor === "arrival" ? "departure" : "arrival";
    start = dates.anchor === "arrival" ? dates.date : addDays(dates.date, 1 - dates.days);
    end = dates.anchor === "departure" ? dates.date : addDays(dates.date, dates.days - 1);
  }
  const first = civilDay(start);
  const last = civilDay(end);
  if (first === undefined || last === undefined) return { issue: "Enter valid travel dates." };
  if (last < first) return { issue: "Departure cannot be before arrival." };
  const days = last - first + 1;
  if (!validDuration(days)) return { issue: durationMessage };
  return {
    days, nights: days - 1, start, end, provisional, arrivalTime, departureTime,
    startMonth: start!.slice(0, 7), endMonth: end!.slice(0, 7),
  };
}

const durationMessage = `Trip Studio supports 2 to ${MAX_DAYS} calendar days. A day-only trip needs no overnight plan.`;
export const validDuration = (days: number) => Number.isInteger(days) && days >= 2 && days <= MAX_DAYS;

/** Start the next form with the active plan's known facts. Applying it is a separate edit. */
export function changeDateMode(current: StudioDates, kind: StudioDates["kind"], plannedDays: number): StudioDates {
  if (kind === current.kind) return current;
  if (kind === "unset") return { kind };
  const calendar = studioCalendar(current);
  const days = calendar.days ?? Math.max(2, plannedDays);
  if (kind === "approximate") return { kind, period: calendar.startMonth ?? "", days };
  if (kind === "exact") return {
    kind, arrival: calendar.provisional === "arrival" ? "" : calendar.start ?? "",
    departure: calendar.provisional === "departure" ? "" : calendar.end ?? "",
    arrivalTime: calendar.arrivalTime, departureTime: calendar.departureTime,
  };
  const anchor = calendar.provisional === "arrival" ? "departure" : "arrival";
  return {
    kind, anchor, date: (anchor === "arrival" ? calendar.start : calendar.end) ?? "",
    time: anchor === "arrival" ? calendar.arrivalTime : calendar.departureTime, days,
  };
}
