import type { StayChoice } from "./planningCustomization";
import { planningDate } from "./planningCalendar.ts";
import type { CandidatePlace, PlanningDayV2, PlanningItemV2, TripBriefV1 } from "./planningTypes";
import { arrivalReadyMinute, departureDeadlineMinute } from "./routeConstraints.ts";
import type { CandidateRoute } from "./routeTypes";
import type { TransportLeg, TransportPlan } from "./transportTypes";
import { eligibleActivityPlaces } from "./planningV2Places.ts";


export function routeDayCities(route: CandidateRoute, duration: number): string[] {
  if (!route.destinations.length || route.nights.length !== route.destinations.length ||
      route.nights.some(nights => !Number.isInteger(nights) || nights < 1) ||
      route.nights.reduce((sum, nights) => sum + nights, 0) !== duration - 1) {
    throw new Error("The selected route has an invalid overnight allocation.");
  }
  return [...route.destinations.flatMap((destination, index) =>
    Array.from({ length: route.nights[index] }, () => destination.name)),
    route.destinations[route.destinations.length - 1].name];
}

function clock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function openingWindow(place: CandidatePlace, date?: string): { open: number; close: number } | undefined {
  const value = place.openingHours;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as { daily?: { open?: string; close?: string };
    byWeekday?: Record<string, { open?: string; close?: string }> };
  const weekday = date ? new Date(`${date}T00:00:00Z`).getUTCDay() : undefined;
  const period = weekday !== undefined ? record.byWeekday?.[String(weekday)] ?? record.daily : record.daily;
  const parse = (time?: string) => {
    const match = time?.match(/^(\d{2}):(\d{2})$/);
    return match && Number(match[1]) <= 23 && Number(match[2]) <= 59
      ? Number(match[1]) * 60 + Number(match[2]) : undefined;
  };
  const open = parse(period?.open);
  const close = parse(period?.close);
  return open !== undefined && close !== undefined && close > open ? { open, close } : undefined;
}

function transportItem(day: number, leg: TransportLeg, label: string,
  start?: number, date?: string): PlanningItemV2 {
  const canSchedule = start !== undefined && leg.durationMinutes !== undefined &&
    Number.isFinite(leg.durationMinutes) && start >= 0 && start + Math.ceil(leg.durationMinutes) <= (date ? 1800 : 1440);
  const format = (minutes: number) => minutes >= 1440 && date
    ? `${new Date(Date.parse(`${date}T00:00:00Z`) + Math.floor(minutes / 1440) * 86400000).toISOString().slice(0, 10)}T${clock(minutes % 1440)}` : clock(minutes);
  const plannedStart = canSchedule ? format(start!) : undefined;
  const plannedEnd = canSchedule ? format(start! + Math.ceil(leg.durationMinutes!)) : undefined;
  return { id: `day-${day}:transfer:${leg.id}`, city: leg.toId,
    time: plannedStart ?? "Time to confirm", icon: "↗", label,
    detail: leg.durationMinutes === undefined ? "Journey time and service need confirmation." :
      `${Math.ceil(leg.durationMinutes)} min road-driving estimate; timing is not a booking.`,
    category: "transport", transportLegId: leg.id,
    ...(leg.durationMinutes !== undefined ? { durationMinutes: Math.ceil(leg.durationMinutes), durationEvidence: "ESTIMATED" as const } : {}),
    ...(plannedStart && plannedEnd ? { plannedStart, plannedEnd } : {}),
  };
}

export type ActivitySelection = { id: string; placeId: string; description?: string; durationMinutes?: number; preferredStart?: string; isFreeTime?: boolean };
export type DaySelection = { placeIds: string[]; descriptions?: { placeId: string; text: string }[]; note?: string;
  /** Editing keeps this identity even when the place or day changes. */
  activities?: ActivitySelection[] };

/** Pure schedule. Unknown transfer times stay unscheduled and block timed activities that day. */
export function schedulePlanningDays(brief: TripBriefV1, route: CandidateRoute,
  transport: TransportPlan, places: CandidatePlace[], selections: DaySelection[], stays: Record<string, StayChoice> = {}): PlanningDayV2[] {
  const cities = routeDayCities(route, brief.durationDays);
  const transferByDay = new Map<number, { leg: TransportLeg; from: string; to: string }>();
  let transferDay = 1;
  route.destinations.slice(0, -1).forEach((destination, index) => {
    transferDay += route.nights[index];
    const leg = transport.legs[index];
    if (leg) transferByDay.set(transferDay, { leg, from: destination.name, to: route.destinations[index + 1].name });
  });
  return cities.map((city, index) => {
    const dayNumber = index + 1;
    const warnings: string[] = [];
    const items: PlanningItemV2[] = [];
    let activityStart = 9 * 60;
    let transferStart = 8 * 60;
    let activityEnd = 18 * 60;
    let scheduleKnown = true;
    const overnight = dayNumber < brief.durationDays;
    const stay = stays[city];
    const hotel = stay?.placeId ? places.find(place => place.databaseId === stay.placeId && place.city === city && place.category === "hotel") : undefined;

    if (dayNumber === 1 && brief.arrival?.location) {
      const ready = arrivalReadyMinute(brief);
      if (ready !== undefined && ready >= 21 * 60) warnings.push("Late arrival: arrange overnight check-in and transfer with your accommodation; rest takes priority.");
      const leg = transport.arrivalTransfer;
      if (ready !== undefined) activityStart = Math.max(activityStart, ready);
      if (leg) {
        items.push(transportItem(dayNumber, leg, `Arrival transfer to ${city}`, ready, planningDate(brief, index)));
        if (ready === undefined || leg.durationMinutes === undefined) scheduleKnown = false;
        else activityStart = Math.max(activityStart, ready + Math.ceil(leg.durationMinutes) + 30);
      } else if (ready === undefined) scheduleKnown = false;
    }
    if (dayNumber === 2 && (arrivalReadyMinute(brief) ?? 0) >= 21 * 60) {
      const arrivalDuration = transport.arrivalTransfer?.durationMinutes;
      if (arrivalDuration === undefined) scheduleKnown = false;
      else {
        const recovered = arrivalReadyMinute(brief)! + arrivalDuration + 8 * 60 - 1440;
        activityStart = Math.max(activityStart, recovered);
        transferStart = Math.max(transferStart, recovered);
      }
      warnings.push("Allow recovery after your overnight arrival; transfer and check-in need confirmation.");
    }
    const intercity = transferByDay.get(dayNumber);
    if (intercity) {
      const start = transferStart;
      items.push(transportItem(dayNumber, intercity.leg, `${intercity.from} to ${intercity.to}`,
        intercity.leg.durationMinutes !== undefined ? start : undefined));
      if (intercity.leg.durationMinutes === undefined) scheduleKnown = false;
      else activityStart = Math.max(activityStart, start + Math.ceil(intercity.leg.durationMinutes) + 60);
    }
    if (dayNumber === brief.durationDays && brief.departure?.location) {
      const deadline = departureDeadlineMinute(brief);
      const leg = transport.departureTransfer;
      if (leg) {
        const start = deadline !== undefined && leg.durationMinutes !== undefined
          ? deadline - Math.ceil(leg.durationMinutes) : undefined;
        items.push(transportItem(dayNumber, leg, `Departure transfer from ${city}`, start));
        if (start === undefined) scheduleKnown = false;
        else activityEnd = Math.min(activityEnd, start - 60);
      } else if (deadline === undefined) scheduleKnown = false;
      else activityEnd = Math.min(activityEnd, deadline);
    }

    const allowed = new Map(eligibleActivityPlaces(places, city)
      .map(place => [place.databaseId!, place]));
    const selection = selections[index] ?? { placeIds: [] };

    let cursor = activityStart;
    const activities: ActivitySelection[] = selection.activities ?? selection.placeIds.map(id => ({
      id: `day-${dayNumber}:place:${id}`, placeId: id,
      description: selection.descriptions?.find(item => item.placeId === id)?.text,
    }));
    for (const activity of activities) {
      const place = activity.isFreeTime ? { name: "Free time", city, category: "free-time" } as CandidatePlace : allowed.get(activity.placeId);
      if (!place) throw new Error(`An activity is outside the selected route's allowed places: ${activity.placeId}`);
      const duration = activity.durationMinutes ?? 90;
      const hours = openingWindow(place, planningDate(brief, index));
      const requested = activity.preferredStart ? Number(activity.preferredStart.slice(0, 2)) * 60 + Number(activity.preferredStart.slice(3)) : cursor;
      const proposed = hours ? Math.max(cursor, requested, hours.open) : Math.max(cursor, requested);
      const canTime = scheduleKnown && !place.sourceProvider?.startsWith("WanderRoute landmark guide") && proposed + duration <= activityEnd && proposed + duration <= 21 * 60 &&
        (!hours || proposed + duration <= hours.close);
      const start = canTime ? clock(proposed) : undefined;
      const end = canTime ? clock(proposed + duration) : undefined;
      if (canTime && activity.preferredStart && start !== activity.preferredStart) warnings.push(`${place.name}: preferred start adjusted to fit this day and available opening hours.`);
      if (!canTime) warnings.push(`${place.name}: visit time needs confirmation.`);
      if (!hours && !activity.isFreeTime) warnings.push(`${place.name}: opening hours are unknown.`);
      items.push({ id: activity.id, city, ...(activity.isFreeTime ? { isFreeTime: true } : { placeId: activity.placeId }),
        ...(activity.preferredStart ? { preferredStart: activity.preferredStart } : {}),
        placeEvidence: { status: "KNOWN", ...(place.sourceProvider ? { source: place.sourceProvider } : {}) },
        ...(place.coordinates ? { coordinates: place.coordinates } : {}),
        ...(place.priceEvidence ? { priceEvidence: place.priceEvidence } : {}),
        time: start ?? "Time to confirm", icon: "✦", label: place.name,
        detail: activity.description ?? "Suggested from the available place records; visit details need confirmation.",
        category: "activity", durationMinutes: duration, durationEvidence: "ESTIMATED",
        ...(start && end ? { plannedStart: start, plannedEnd: end } : {}),
      });
      if (canTime) cursor = proposed + duration + 30;
    }
    items.push({ id: `day-${dayNumber}:meal`, city, time: "Venue to choose", icon: "◌",
      label: "Meal in town", detail: "Choose a venue; price and opening hours are not confirmed.", category: "meal" });
    if (overnight) warnings.push(`Accommodation in ${city} needs confirmation.`);
    if (!activities.length) warnings.push(`No activity place was selected for ${city} on this day.`);
    return { day: dayNumber, city, ...(planningDate(brief, index) ? { date: planningDate(brief, index) } : {}),
      ...(overnight ? { overnightCity: city } : {}), flag: "📍", heroGradient: "", localTip: selection.note ?? "Check opening hours and reservations before travel.",
      accommodation: overnight ? hotel?.name || stay?.name?.trim() || (stay?.area ? `Stay in ${stay.area}, ${city}` : `Stay to confirm in ${city}`) : "",
      ...(overnight && hotel?.databaseId ? { accommodationPlaceId: hotel.databaseId } : {}),
      items, warnings };
  });
}
