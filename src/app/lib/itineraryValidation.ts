import type { CandidatePlace, PlanningItineraryV2, TripBriefV1 } from "./planningTypes";
import type { CandidateRoute } from "./routeTypes";
import { arrivalReadyMinute, arrivalTransferBudgetMinutes, departureDeadlineMinute,
  departureTransferBudgetMinutes, drivingLimits } from "./routeConstraints.ts";
import { assessPlanningSeason, planningSeasonMonth } from "./routeSeason.ts";
import { calculateCostLedger, compareBudget, type BudgetAssessment, type CostLedger } from "./costLedger.ts";
import { assessTransportReadiness, transportLegId } from "./transportPlanning.ts";
import type { TransportLeg, TransportPlan, TransportReadiness } from "./transportTypes";
import { matrixLeg, type TravelMatrix } from "./travelTimeMatrix.ts";

export type ValidationSeverity = "ERROR" | "WARNING" | "UNKNOWN";
export type ValidationIssue = {
  code: string;
  severity: ValidationSeverity;
  day?: number;
  itemId?: string;
  legId?: string;
  details?: Record<string, string | number | boolean>;
};
export type ValidationReadiness = "READY" | "READY_WITH_WARNINGS" | "NEEDS_CONFIRMATION" | "INVALID";
export type ValidationResult = {
  status: ValidationReadiness;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  unknowns: ValidationIssue[];
  issues: ValidationIssue[];
  budget: BudgetAssessment;
  transport: TransportReadiness;
};
export type ValidationInput = {
  itinerary: PlanningItineraryV2;
  brief: TripBriefV1;
  route: CandidateRoute;
  matrix: TravelMatrix;
  transportPlan: TransportPlan;
  ledger: CostLedger;
  trustedPlaces?: CandidatePlace[];
};

function localClockMinute(value?: string): number | undefined {
  const match = value?.match(/(?:T|^)(\d{2}):(\d{2})(?::\d{2})?(?:[Z+-]|$)/);
  if (!match) return undefined;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : undefined;
}

function openingWindow(value: unknown, date?: string): { open: number; close: number } | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as { daily?: { open?: string; close?: string };
    byWeekday?: Record<string, { open?: string; close?: string }> };
  const weekday = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(`${date}T00:00:00Z`).getUTCDay() : undefined;
  const period = weekday !== undefined ? record.byWeekday?.[String(weekday)] ?? record.daily : record.daily;
  const open = localClockMinute(period?.open);
  const close = localClockMinute(period?.close);
  return open !== undefined && close !== undefined && close > open ? { open, close } : undefined;
}

function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const radians = Math.PI / 180;
  const lat1 = a.latitude * radians;
  const lat2 = b.latitude * radians;
  const deltaLat = (b.latitude - a.latitude) * radians;
  const deltaLng = (b.longitude - a.longitude) * radians;
  const h = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function expectedCities(route: CandidateRoute): string[] {
  const overnight = route.destinations.flatMap((stop, index) => Array.from({ length: Math.max(0, route.nights[index] ?? 0) }, () => stop.name));
  return [...overnight, route.destinations[route.destinations.length - 1]?.name].filter((name): name is string => !!name);
}

/** Validation is pure and never calls routing, fare, booking or weather services. */
export function validatePlanningItinerary(input: ValidationInput): ValidationResult {
  const { itinerary, brief, route, matrix, transportPlan, ledger } = input;
  const issues: ValidationIssue[] = [];
  const add = (code: string, severity: ValidationSeverity, extra: Omit<ValidationIssue, "code" | "severity"> = {}) =>
    issues.push({ code, severity, ...extra });
  const days = itinerary.days ?? [];
  const places = new Map((input.trustedPlaces ?? []).filter(place => place.databaseId)
    .map(place => [place.databaseId!, place]));
  const limits = drivingLimits(brief);

  if (itinerary.routeConceptId !== route.id) add("ROUTE_CONCEPT_MISMATCH", "ERROR");

  if (itinerary.totalDays !== brief.durationDays) add("ITINERARY_DAY_COUNT_MISMATCH", "ERROR");
  if (itinerary.totalPeople !== brief.travellerCount) add("ITINERARY_TRAVELLER_COUNT_MISMATCH", "ERROR");
  if (itinerary.currency !== ledger.currency) add("ITINERARY_CURRENCY_MISMATCH", "ERROR");
  if (days.length !== brief.durationDays) add("DAY_COUNT_MISMATCH", "ERROR", { details: { actual: days.length, expected: brief.durationDays } });
  const seenDays = new Set<number>();
  const seenItems = new Set<string>();
  const expected = expectedCities(route);
  if (route.nights.length !== route.destinations.length ||
      route.nights.some(nights => !Number.isInteger(nights) || nights < 1) ||
      route.nights.reduce((sum, nights) => sum + nights, 0) !== Math.max(0, brief.durationDays - 1)) {
    add("NIGHT_ALLOCATION_INVALID", "ERROR");
  }
  for (const [index, day] of days.entries()) {
    if (seenDays.has(day.day)) add("DUPLICATE_DAY_NUMBER", "ERROR", { day: day.day });
    seenDays.add(day.day);
    if (day.day !== index + 1) add("DAY_SEQUENCE_INVALID", "ERROR", { day: day.day });
    const expectedCity = expected[day.day - 1];
    if (expectedCity && day.city.trim().toLowerCase() !== expectedCity.toLowerCase()) {
      add("ROUTE_CITY_MISMATCH", "ERROR", { day: day.day, details: { expectedCity, actualCity: day.city } });
    }
    if (!route.destinations.some(stop => stop.name.toLowerCase() === day.city.toLowerCase())) {
      add("UNEXPLAINED_CITY", "ERROR", { day: day.day });
    }
    if (day.day < brief.durationDays && !day.accommodation?.trim()) add("STAY_UNSPECIFIED", "UNKNOWN", { day: day.day });
    if (day.accommodationPlaceId) {
      const stay = places.get(day.accommodationPlaceId);
      if (!stay || stay.category !== "hotel" || stay.city.toLowerCase() !== day.city.toLowerCase() ||
          stay.name !== day.accommodation) add("ACCOMMODATION_PLACE_MISMATCH", "ERROR", { day: day.day });
    }
    const timed: { start: number; end: number; id: string }[] = [];
    for (const item of day.items ?? []) {
      if (!item.id || seenItems.has(item.id)) add("DUPLICATE_ITEM_ID", "ERROR", { day: day.day, itemId: item.id });
      seenItems.add(item.id);
      if (item.city.toLowerCase() !== day.city.toLowerCase() && item.category !== "transport") {
        add("ITEM_CITY_MISMATCH", "ERROR", { day: day.day, itemId: item.id });
      }
      const start = localClockMinute(item.plannedStart);
      const statedEnd = localClockMinute(item.plannedEnd);
      if (item.plannedStart && start === undefined || item.plannedEnd && statedEnd === undefined) {
        add("ITEM_TIME_INVALID", "ERROR", { day: day.day, itemId: item.id });
      }
      const end = statedEnd ??
        (start !== undefined && item.durationMinutes !== undefined ? start + item.durationMinutes : undefined);
      if (item.durationMinutes !== undefined && (!Number.isFinite(item.durationMinutes) || item.durationMinutes <= 0)) {
        add("ITEM_DURATION_INVALID", "ERROR", { day: day.day, itemId: item.id });
      }
      if (start !== undefined && end !== undefined) {
        if (end <= start || end > 24 * 60) add("ITEM_TIME_ORDER_INVALID", "ERROR", { day: day.day, itemId: item.id });
        else timed.push({ start, end, id: item.id });
        if (item.durationMinutes !== undefined && Math.abs(end - start - item.durationMinutes) > 0.01) {
          add("ITEM_DURATION_MISMATCH", "ERROR", { day: day.day, itemId: item.id });
        }
      }
      const arrivalReady = arrivalReadyMinute(brief);
      if (day.day === 1 && item.category !== "transport" && start !== undefined &&
          arrivalReady !== undefined && start < arrivalReady) add("ARRIVAL_DAY_VIOLATION", "ERROR", { day: 1, itemId: item.id });
      const departureDeadline = departureDeadlineMinute(brief);
      if (day.day === brief.durationDays && item.category !== "transport" &&
          departureDeadline !== undefined && (end ?? start ?? -1) > departureDeadline) {
        add("DEPARTURE_DAY_VIOLATION", "ERROR", { day: day.day, itemId: item.id });
      }
      if (item.placeId) {
        const place = places.get(item.placeId);
        if (!place) add("PLACE_ID_NOT_FOUND", "ERROR", { day: day.day, itemId: item.id });
        else if (item.coordinates && place.coordinates) {
          const km = distanceKm(item.coordinates, place.coordinates);
          if (km > 1) add("PLACE_COORDINATES_MISMATCH", km > 5 ? "ERROR" : "WARNING",
            { day: day.day, itemId: item.id, details: { separationKm: Math.round(km * 100) / 100 } });
        }
        if (place && item.category === "activity") {
          const hours = openingWindow(place.openingHours, day.date);
          if (!hours || start === undefined || end === undefined) {
            add("OPENING_HOURS_UNCONFIRMED", "UNKNOWN", { day: day.day, itemId: item.id });
          } else if (start < hours.open || end > hours.close) {
            add("OPENING_HOURS_CONFLICT", "ERROR", { day: day.day, itemId: item.id });
          }
        }
      }
      if (item.placeEvidence?.status === "VERIFIED" &&
          (!item.placeId || !places.has(item.placeId) || !item.placeEvidence.source?.trim() || !item.placeEvidence.checkedAt?.trim())) {
        add("VERIFIED_PLACE_EVIDENCE_MISSING", "ERROR", { day: day.day, itemId: item.id });
      }
      if (item.priceEvidence?.status === "VERIFIED" &&
          (!item.priceEvidence.source?.trim() || !item.priceEvidence.checkedAt?.trim())) {
        add("VERIFIED_PRICE_EVIDENCE_MISSING", "ERROR", { day: day.day, itemId: item.id });
      }
      if (item.transportLegId && item.category !== "transport") {
        add("TRANSPORT_LINK_ON_NON_TRANSFER", "ERROR", { day: day.day, itemId: item.id });
      }
    }
    timed.sort((a, b) => a.start - b.start);
    for (let i = 1; i < timed.length; i += 1) {
      if (timed[i].start < timed[i - 1].end) add("ITEMS_OVERLAP", "ERROR", { day: day.day,
        itemId: timed[i].id });
    }
  }

  if (transportPlan.routeId !== route.id) add("TRANSPORT_ROUTE_MISMATCH", "ERROR");
  if (route.legs.length !== Math.max(0, route.destinations.length - 1) ||
      transportPlan.legs.length !== route.legs.length) add("ROUTE_LEG_MISSING", "ERROR");
  const dailyDrive = new Map<number, number>();
  let transferDay = 1;
  for (let i = 0; i < route.destinations.length - 1; i += 1) {
    transferDay += route.nights[i] ?? 0;
    const fromId = route.destinations[i].id;
    const toId = route.destinations[i + 1].id;
    const expectedId = transportLegId(fromId, toId);
    const road = route.legs[i];
    const leg = transportPlan.legs[i];
    if (!road || road.fromId !== fromId || road.toId !== toId || !leg || leg.id !== expectedId ||
        leg.fromId !== fromId || leg.toId !== toId) {
      add("ROUTE_LEG_MISSING", "ERROR", { legId: expectedId });
      continue;
    }
    const actualRoad = matrixLeg(matrix, fromId, toId);
    if (!actualRoad && leg.mode === "PRIVATE_DRIVER") add("ROAD_MATRIX_LEG_MISSING", "UNKNOWN", { legId: leg.id });
    if (leg.mode === "PRIVATE_DRIVER" && leg.routingSource === "OSRM_TABLE" && actualRoad &&
        leg.durationMinutes !== undefined && Math.abs((actualRoad.durationMinutes ?? Number.NaN) - leg.durationMinutes) > 0.01) {
      add("ROAD_EVIDENCE_MISMATCH", "ERROR", { legId: leg.id });
    }
    const scheduled = days.flatMap(day => (day.items ?? []).filter(item => item.category === "transport" && item.transportLegId === leg.id)
      .map(item => ({ day: day.day, item })));
    if (scheduled.length === 0) add("TRANSFER_UNSCHEDULED", "UNKNOWN", { legId: leg.id, day: transferDay });
    for (const entry of scheduled) {
      if (entry.day !== transferDay) add("TRANSFER_DAY_MISMATCH", "ERROR", { legId: leg.id, day: entry.day });
      const start = localClockMinute(entry.item.plannedStart);
      const end = localClockMinute(entry.item.plannedEnd) ??
        (start !== undefined && entry.item.durationMinutes !== undefined ? start + entry.item.durationMinutes : undefined);
      if (start === undefined || end === undefined) add("TRANSFER_SCHEDULE_TIME_UNKNOWN", "UNKNOWN", { legId: leg.id, day: entry.day });
      if (leg.durationMinutes !== undefined && start !== undefined && end !== undefined &&
          end - start + 0.01 < leg.durationMinutes) add("TRANSFER_TIME_INSUFFICIENT", "ERROR", { legId: leg.id, day: entry.day });
    }
    if (leg.mode === "PRIVATE_DRIVER" && leg.durationMinutes !== undefined) {
      dailyDrive.set(transferDay, (dailyDrive.get(transferDay) ?? 0) + leg.durationMinutes);
    }
    inspectTransportLeg(leg, transferDay);
  }

  function inspectTransportLeg(leg: TransportLeg, day: number) {
    if (leg.mode !== "PRIVATE_DRIVER" && leg.durationMinutes !== undefined && leg.routingSource === "OSRM_TABLE") {
      add("ROAD_TIME_USED_FOR_NON_CAR_MODE", "ERROR", { legId: leg.id, day });
    }
    if (leg.mode === "PRIVATE_DRIVER" && leg.durationEvidence === "VERIFIED" && leg.routingSource === "OSRM_TABLE") {
      add("OSRM_TIME_MISLABELLED_VERIFIED", "ERROR", { legId: leg.id, day });
    }
    if (leg.status === "UNROUTABLE" && leg.mode === "PRIVATE_DRIVER") add("ROAD_LEG_UNROUTABLE", "ERROR", { legId: leg.id, day });
    if (leg.durationMinutes === undefined) add("TRANSPORT_TIME_UNKNOWN", "UNKNOWN", { legId: leg.id, day });
    else if (!Number.isFinite(leg.durationMinutes) || leg.durationMinutes < 0) add("TRANSPORT_DURATION_INVALID", "ERROR", { legId: leg.id, day });
  }

  function inspectEndpointTransfer(leg: TransportLeg | undefined, location: string | undefined,
    budget: number | undefined, day: number, kind: "ARRIVAL" | "DEPARTURE") {
    if (!location) return;
    const stop = kind === "ARRIVAL" ? route.destinations[0] : route.destinations[route.destinations.length - 1];
    if (!stop || location.trim().toLowerCase() === stop.name.toLowerCase() || location.trim().toLowerCase() === stop.id.toLowerCase()) return;
    if (!leg) { add(`${kind}_TRANSFER_UNKNOWN`, "UNKNOWN", { day }); return; }
    inspectTransportLeg(leg, day);
    const scheduled = days[day - 1]?.items?.find(item => item.category === "transport" && item.transportLegId === leg.id);
    const scheduledStart = localClockMinute(scheduled?.plannedStart);
    const scheduledEnd = localClockMinute(scheduled?.plannedEnd);
    if (!scheduled || scheduledStart === undefined || scheduledEnd === undefined) {
      add(`${kind}_TRANSFER_SCHEDULE_UNKNOWN`, "UNKNOWN", { day, legId: leg.id });
    } else if (kind === "ARRIVAL" && arrivalReadyMinute(brief) !== undefined &&
      scheduledStart < arrivalReadyMinute(brief)!) {
      add("ARRIVAL_TRANSFER_BEFORE_READY", "ERROR", { day, legId: leg.id });
    } else if (kind === "DEPARTURE" && departureDeadlineMinute(brief) !== undefined &&
      scheduledEnd > departureDeadlineMinute(brief)!) {
      add("DEPARTURE_TRANSFER_TOO_LATE", "ERROR", { day, legId: leg.id });
    }
    if (leg.mode === "PRIVATE_DRIVER" && leg.durationMinutes !== undefined) {
      dailyDrive.set(day, (dailyDrive.get(day) ?? 0) + leg.durationMinutes);
    }
    if (budget === undefined) add(`${kind}_TIME_UNKNOWN`, "UNKNOWN", { day });
    else if (leg.durationMinutes === undefined) add(`${kind}_TRANSFER_UNKNOWN`, "UNKNOWN", { day });
    else if (leg.durationMinutes > budget) add(`${kind}_TRANSFER_INFEASIBLE`, "ERROR", { day,
      details: { durationMinutes: leg.durationMinutes, availableMinutes: budget } });
  }
  inspectEndpointTransfer(transportPlan.arrivalTransfer, brief.arrival?.location,
    arrivalTransferBudgetMinutes(brief), 1, "ARRIVAL");
  inspectEndpointTransfer(transportPlan.departureTransfer, brief.departure?.location,
    departureTransferBudgetMinutes(brief), brief.durationDays, "DEPARTURE");
  if (brief.arrival && !brief.arrival.location) add("ARRIVAL_LOCATION_UNKNOWN", "UNKNOWN");
  if (brief.departure && !brief.departure.location) add("DEPARTURE_LOCATION_UNKNOWN", "UNKNOWN");
  for (const [day, minutes] of dailyDrive) {
    if (minutes > limits.hardMinutes) add("HARD_DRIVING_LIMIT_EXCEEDED", "ERROR", { day,
      details: { minutes, limit: limits.hardMinutes } });
    else if (minutes > limits.preferredMinutes) add("PREFERRED_DRIVING_LIMIT_EXCEEDED", "WARNING", { day,
      details: { minutes, limit: limits.preferredMinutes } });
  }

  for (const reason of route.reasons) {
    if (reason.code === "INSUFFICIENT_DAYS") add("ROUTE_INSUFFICIENT_DAYS", "ERROR");
    else if (reason.code === "REQUESTED_CITY_OMITTED") add("REQUESTED_CITY_OMITTED", "WARNING",
      { details: reason.destinations?.[0] ? { city: reason.destinations[0] } : undefined });
  }
  const seasonSeen = new Set<string>();
  for (const reason of route.reasons.filter(reason => reason.code === "SEASON_AVOID" || reason.code === "SEASON_CAUTION")) {
    const city = reason.destinations?.[0] ?? "";
    seasonSeen.add(city.toLowerCase());
    add(reason.code, "WARNING", { details: city ? { city } : undefined });
  }
  const month = planningSeasonMonth(brief);
  for (const stop of route.destinations) {
    if (seasonSeen.has(stop.name.toLowerCase())) continue;
    const assessment = assessPlanningSeason(stop.name, month);
    if (assessment.status === "AVOID" || assessment.status === "CAUTION") {
      add(`SEASON_${assessment.status}`, "WARNING", { details: { city: stop.name, rule: assessment.rule! } });
    } else if (assessment.status === "UNKNOWN") add("SEASON_UNKNOWN", "UNKNOWN", { details: { city: stop.name } });
  }

  const recalculated = calculateCostLedger(ledger.sourceLines, ledger.currency, ledger.travellers, ledger.exchangeRates);
  for (const line of ledger.sourceLines) {
    if (line.day !== undefined && (!Number.isInteger(line.day) || line.day < 1 || line.day > brief.durationDays)) {
      add("COST_DAY_OUT_OF_RANGE", "ERROR", { itemId: line.id });
    }
  }
  if (JSON.stringify(recalculated.summary) !== JSON.stringify(ledger.summary) ||
      JSON.stringify(recalculated.lines) !== JSON.stringify(ledger.lines)) {
    add("LEDGER_OUT_OF_SYNC", "ERROR");
  }
  for (const issue of recalculated.issues) add(`COST_${issue.code}`, issue.severity === "ERROR" ? "ERROR" : "UNKNOWN",
    { itemId: issue.lineId });
  if (ledger.travellers !== brief.travellerCount) add("TRAVELLER_COUNT_MISMATCH", "ERROR");
  const budget = compareBudget(recalculated, brief.budget);
  if (budget.status === "OVER_BUDGET") add("BUDGET_OVER", "ERROR");
  else if (budget.status === "BUDGET_RISK") add("BUDGET_RISK", "WARNING");
  else if (budget.status === "UNKNOWN") add("BUDGET_UNKNOWN", "UNKNOWN");
  const accommodation = recalculated.sourceLines.filter(line => line.category === "ACCOMMODATION");
  if (brief.durationDays > 1 && accommodation.length === 0) add("ACCOMMODATION_PRICE_UNKNOWN", "UNKNOWN");
  const pricedNights = accommodation.reduce((sum, line) => sum +
    (line.periodUnit === "NIGHT" ? line.periodCount ?? 0 : line.chargingBasis === "PER_NIGHT" ? line.quantity : 0), 0);
  if (accommodation.length > 0 && pricedNights < brief.durationDays - 1) add("ACCOMMODATION_NIGHTS_UNDERCOVERED", "WARNING");

  const transport = assessTransportReadiness([...transportPlan.legs,
    ...[transportPlan.arrivalTransfer, transportPlan.departureTransfer].filter((leg): leg is TransportLeg => !!leg)],
    transportPlan.preference);
  if (transport.status !== transportPlan.readiness.status) add("TRANSPORT_READINESS_MISMATCH", "ERROR");
  if (transport.status !== "SUPPORTED" && !issues.some(issue => issue.code === "TRANSPORT_TIME_UNKNOWN")) {
    add("TRANSPORT_SUPPORT_INCOMPLETE", "UNKNOWN");
  }
  const errors = issues.filter(issue => issue.severity === "ERROR");
  const warnings = issues.filter(issue => issue.severity === "WARNING");
  const unknowns = issues.filter(issue => issue.severity === "UNKNOWN");
  const status: ValidationReadiness = errors.length ? "INVALID" : unknowns.length ? "NEEDS_CONFIRMATION" :
    warnings.length ? "READY_WITH_WARNINGS" : "READY";
  return { status, errors, warnings, unknowns, issues, budget, transport };
}
