import type { TripBriefV1, TravelPace } from "./planningTypes";
import { matrixLeg, type RoadLeg, type TravelMatrix } from "./travelTimeMatrix.ts";
import type { PlanningDestination, RouteReason } from "./routeTypes";

/** Planning V2 policy only. V1 itinerary generation does not read these values. */
export const PACE_POLICY: Record<TravelPace, {
  preferredDrivingMinutes: number;
  hardDrivingMinutes: number;
  minimumNightsPerBase: number;
  minimumUsableDaysPerBase: number;
}> = {
  SLOW_TRAVEL: { preferredDrivingMinutes: 90, hardDrivingMinutes: 240, minimumNightsPerBase: 2, minimumUsableDaysPerBase: 2 },
  RELAXED: { preferredDrivingMinutes: 120, hardDrivingMinutes: 300, minimumNightsPerBase: 2, minimumUsableDaysPerBase: 1.75 },
  BALANCED: { preferredDrivingMinutes: 180, hardDrivingMinutes: 360, minimumNightsPerBase: 1, minimumUsableDaysPerBase: 1.25 },
  PACKED: { preferredDrivingMinutes: 240, hardDrivingMinutes: 420, minimumNightsPerBase: 1, minimumUsableDaysPerBase: 1 },
};
export const DEFAULT_PACE: TravelPace = "BALANCED";
export const TRANSFER_POLICY = {
  arrivalProcessingMinutes: 90,
  departureBufferMinutes: 180,
  sightseeingStartMinute: 8 * 60,
  sightseeingEndMinute: 21 * 60,
  earliestDepartureTransferMinute: 4 * 60,
  arrivalTransferEndMinute: 24 * 60,
} as const;

export function drivingLimits(brief: TripBriefV1) {
  const pace = brief.pace ?? DEFAULT_PACE;
  const policy = PACE_POLICY[pace];
  const requested = brief.maxPreferredDailyDrivingMinutes;
  const preferredMinutes = typeof requested === "number" && Number.isFinite(requested) && requested > 0
    ? requested : policy.preferredDrivingMinutes;
  return {
    pace, preferredMinutes,
    hardMinutes: Math.max(policy.hardDrivingMinutes, preferredMinutes + 120),
    minimumNightsPerBase: policy.minimumNightsPerBase,
    minimumUsableDaysPerBase: policy.minimumUsableDaysPerBase,
  };
}

export function maximumPlanningBases(brief: TripBriefV1): number {
  const limits = drivingLimits(brief);
  const usableDays = brief.durationDays - (arrivalDayUsableMinutes(brief) === 0 ? 1 : 0) -
    (departureDayUsableMinutes(brief) === 0 ? 1 : 0);
  return Math.max(1, Math.min(
    Math.floor(Math.max(0, brief.durationDays - 1) / limits.minimumNightsPerBase),
    Math.floor(Math.max(0, usableDays) / limits.minimumUsableDaysPerBase)
  ));
}

function clockMinute(value?: string): number | undefined {
  const match = value?.match(/(?:T|^)(\d{2}):(\d{2})(?::\d{2})?(?:[Z+-]|$)/);
  if (!match) return undefined;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : undefined;
}

function arrivalMinute(brief: TripBriefV1): number | undefined {
  // Latest arrival is conservative when only a window is known.
  return clockMinute(brief.arrival?.window?.latest ?? brief.arrival?.dateTime);
}
function departureMinute(brief: TripBriefV1): number | undefined {
  // Earliest departure is conservative when only a window is known.
  return clockMinute(brief.departure?.window?.earliest ?? brief.departure?.dateTime);
}

/** Local clock minutes from supplied endpoint data; no timezone is inferred. */
export function arrivalReadyMinute(brief: TripBriefV1): number | undefined {
  const arrival = arrivalMinute(brief);
  return arrival === undefined ? undefined : arrival + TRANSFER_POLICY.arrivalProcessingMinutes;
}
export function departureDeadlineMinute(brief: TripBriefV1): number | undefined {
  const departure = departureMinute(brief);
  return departure === undefined ? undefined : departure - TRANSFER_POLICY.departureBufferMinutes;
}

export function arrivalDayUsableMinutes(brief: TripBriefV1): number | undefined {
  const arrival = arrivalMinute(brief);
  return arrival === undefined ? undefined : Math.max(0,
    TRANSFER_POLICY.sightseeingEndMinute - Math.max(TRANSFER_POLICY.sightseeingStartMinute,
      arrival + TRANSFER_POLICY.arrivalProcessingMinutes));
}
export function departureDayUsableMinutes(brief: TripBriefV1): number | undefined {
  const departure = departureMinute(brief);
  return departure === undefined ? undefined : Math.max(0,
    Math.min(TRANSFER_POLICY.sightseeingEndMinute, departure - TRANSFER_POLICY.departureBufferMinutes) -
    TRANSFER_POLICY.sightseeingStartMinute);
}
export function arrivalTransferBudgetMinutes(brief: TripBriefV1): number | undefined {
  const arrival = arrivalMinute(brief);
  return arrival === undefined ? undefined : arrival >= 21 * 60 ? 120 : Math.max(0,
    TRANSFER_POLICY.arrivalTransferEndMinute - arrival - TRANSFER_POLICY.arrivalProcessingMinutes);
}
export function departureTransferBudgetMinutes(brief: TripBriefV1): number | undefined {
  const departure = departureMinute(brief);
  return departure === undefined ? undefined : Math.max(0,
    departure - TRANSFER_POLICY.departureBufferMinutes - TRANSFER_POLICY.earliestDepartureTransferMinute);
}

function endpointId(matrix: TravelMatrix, location: string): string | undefined {
  const key = location.trim().toLowerCase();
  return matrix.locations.find(item => item.id.toLowerCase() === key || item.name.toLowerCase() === key)?.id;
}

function transferReason(
  brief: TripBriefV1, matrix: TravelMatrix, stop: PlanningDestination, kind: "ARRIVAL" | "DEPARTURE"
): RouteReason[] {
  const location = kind === "ARRIVAL" ? brief.arrival?.location : brief.departure?.location;
  const budget = kind === "ARRIVAL" ? arrivalTransferBudgetMinutes(brief) : departureTransferBudgetMinutes(brief);
  if (!location) return (kind === "ARRIVAL" ? brief.arrival : brief.departure)
    ? [{ code: "ENDPOINT_UNKNOWN", severity: "UNCERTAIN" }] : [];
  if (budget === undefined) return [{ code: kind === "ARRIVAL" ? "ARRIVAL_TIME_UNKNOWN" : "DEPARTURE_TIME_UNKNOWN", severity: "UNCERTAIN", destinations: [location] }];
  const id = endpointId(matrix, location);
  if (!id) return [{ code: "ENDPOINT_UNKNOWN", severity: "UNCERTAIN", destinations: [location] }];
  if (id === stop.id) return [];
  const leg = kind === "ARRIVAL" ? matrixLeg(matrix, id, stop.id) : matrixLeg(matrix, stop.id, id);
  if (!leg || leg.status === "MISSING_COORDINATES" || leg.status === "UNAVAILABLE" || leg.status === "PARTIAL" && leg.durationMinutes === undefined) {
    return [{ code: "ROUTING_UNKNOWN", severity: "UNCERTAIN", destinations: [location, stop.name] }];
  }
  if (leg.status === "UNROUTABLE") return [{ code: "UNROUTABLE", severity: "REJECTION", destinations: [location, stop.name] }];
  return leg.durationMinutes! > budget
    ? [{ code: kind === "ARRIVAL" ? "ARRIVAL_CONFLICT" : "DEPARTURE_CONFLICT", severity: "REJECTION",
      destinations: [location, stop.name], details: { transferMinutes: leg.durationMinutes!, availableMinutes: budget } }]
    : [];
}

export function assessRouteConstraints(
  brief: TripBriefV1, stops: PlanningDestination[], legs: RoadLeg[], matrix: TravelMatrix
): RouteReason[] {
  if (stops.length === 0) return [{ code: "INSUFFICIENT_DAYS", severity: "REJECTION" }];
  const limits = drivingLimits(brief);
  const reasons: RouteReason[] = [
    ...transferReason(brief, matrix, stops[0], "ARRIVAL"),
    ...transferReason(brief, matrix, stops[stops.length - 1], "DEPARTURE"),
  ];
  const usableDays = brief.durationDays - (arrivalDayUsableMinutes(brief) === 0 ? 1 : 0) -
    (departureDayUsableMinutes(brief) === 0 ? 1 : 0);
  if (usableDays <= 0) reasons.push({ code: "INSUFFICIENT_DAYS", severity: "REJECTION",
    details: { usableDays } });
  for (const leg of legs) {
    if (leg.status === "UNROUTABLE") {
      reasons.push({ code: "UNROUTABLE", severity: "REJECTION", destinations: [leg.fromId, leg.toId] });
    } else if (leg.durationMinutes === undefined) {
      reasons.push({ code: "ROUTING_UNKNOWN", severity: "UNCERTAIN", destinations: [leg.fromId, leg.toId] });
    } else if (leg.durationMinutes > limits.hardMinutes) {
      reasons.push({ code: "EXCESSIVE_DRIVING", severity: "REJECTION", destinations: [leg.fromId, leg.toId],
        details: { durationMinutes: leg.durationMinutes, hardMinutes: limits.hardMinutes } });
    } else if (leg.durationMinutes > limits.preferredMinutes) {
      reasons.push({ code: "PREFERRED_DRIVING_EXCEEDED", severity: "PENALTY", destinations: [leg.fromId, leg.toId],
        details: { durationMinutes: leg.durationMinutes, preferredMinutes: limits.preferredMinutes } });
    }
  }
  return reasons;
}
