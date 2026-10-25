import type { TripBriefV1 } from "./planningTypes";

/** Dates and clocks in a Sri Lanka trip brief are local civil values, not browser-zone instants. */
export function civilDay(value?: string): number | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time / 86400000 : undefined;
}

export function planningCalendarProblems(brief: TripBriefV1): string[] {
  const problems: string[] = [];
  const start = brief.travelDates?.start ?? brief.arrival?.dateTime?.slice(0, 10);
  const end = brief.travelDates?.end ?? brief.departure?.dateTime?.slice(0, 10);
  for (const value of [start, end]) if (value && civilDay(value) === undefined) problems.push("Enter real calendar dates.");
  for (const endpoint of [brief.arrival, brief.departure]) {
    if (endpoint?.dateTime && (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(endpoint.dateTime) ||
      civilDay(endpoint.dateTime.slice(0, 10)) === undefined)) problems.push("Enter a valid local arrival or departure date and time.");
  }
  if (start && end && civilDay(start) !== undefined && civilDay(end) !== undefined &&
      civilDay(end)! - civilDay(start)! + 1 !== brief.durationDays) problems.push("Travel dates must cover the selected number of calendar days, including arrival and departure.");
  if (brief.arrival?.dateTime && brief.departure?.dateTime && brief.departure.dateTime <= brief.arrival.dateTime) problems.push("Departure must be after arrival.");
  if (brief.travelDates?.start && brief.arrival?.dateTime && brief.travelDates.start !== brief.arrival.dateTime.slice(0, 10)) problems.push("Arrival must match the first travel date.");
  if (brief.travelDates?.end && brief.departure?.dateTime && brief.travelDates.end !== brief.departure.dateTime.slice(0, 10)) problems.push("Departure must match the last travel date.");
  return [...new Set(problems)];
}

export function planningDate(brief: TripBriefV1, index: number): string | undefined {
  const knownEnd = civilDay(brief.travelDates?.end ?? brief.departure?.dateTime?.slice(0, 10));
  const start = civilDay(brief.travelDates?.start ?? brief.arrival?.dateTime?.slice(0, 10)) ??
    (knownEnd === undefined ? undefined : knownEnd - brief.durationDays + 1);
  return start === undefined ? undefined : new Date((start + index) * 86400000).toISOString().slice(0, 10);
}

/** The travel day follows Sri Lanka's civil date, regardless of the device's home timezone. */
export function sriLankaCalendarDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  return ["year", "month", "day"].map(kind => parts.find(part => part.type === kind)!.value).join("-");
}

/** Allows an arrival transfer to cross midnight without wrapping its end backwards. */
export function scheduleMinute(value?: string, date?: string): number | undefined {
  const match = value?.match(/(?:T|^)([0-2]\d):([0-5]\d)$/);
  if (!match || Number(match[1]) > 23) return undefined;
  const offset = value!.includes("T") && civilDay(date) !== undefined && civilDay(value!.slice(0, 10)) !== undefined
    ? (civilDay(value!.slice(0, 10))! - civilDay(date)!) * 1440 : 0;
  return Number(match[1]) * 60 + Number(match[2]) + offset;
}
