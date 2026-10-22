import type { TripBriefV1 } from "./planningTypes";
import type { CandidateRoute } from "./routeTypes";
import { matrixLeg, type RoadLeg, type TravelMatrix } from "./travelTimeMatrix.ts";
import type { TransportCapability, TransportLeg, TransportMode, TransportPlan,
  TransportPreference, TransportReadiness } from "./transportTypes";

export function transportCapability(mode: TransportMode): TransportCapability {
  return {
    mode,
    roadRoutingAvailable: mode === "PRIVATE_DRIVER" || mode === "TUK_TUK_SELF_DRIVE",
    scheduledTimeAvailable: false,
    fareAvailable: false,
    timingSupport: mode === "PRIVATE_DRIVER" ? "ROAD_ESTIMATE" : "UNKNOWN",
    priceSupport: "UNKNOWN",
  };
}

export function transportLegId(fromId: string, toId: string): string {
  return `${fromId}>${toId}`;
}

/** OSRM car routing informs private-driver road time only. Other mode times remain unknown. */
export function transportLegFromRoad(road: RoadLeg | undefined, mode: TransportMode,
  fromId: string, toId: string): TransportLeg {
  const base: TransportLeg = {
    id: transportLegId(fromId, toId), fromId, toId, mode,
    status: "UNKNOWN", durationEvidence: "UNKNOWN", distanceEvidence: "UNKNOWN",
  };
  if (mode === "PRIVATE_DRIVER") {
    if (road?.status === "UNROUTABLE") return { ...base, status: "UNROUTABLE", routingSource: road.source };
    if (road?.source === "OSRM_TABLE" && road.durationMinutes !== undefined) {
      return { ...base, status: road.distanceKm === undefined ? "PARTIAL_ROAD_ESTIMATE" : "ROAD_ESTIMATE",
        routingSource: "OSRM_TABLE", durationMinutes: road.durationMinutes,
        durationEvidence: "ESTIMATED",
        ...(road.distanceKm !== undefined ? { distanceKm: road.distanceKm, distanceEvidence: "ESTIMATED" as const } : {}) };
    }
    return base;
  }
  if ((mode === "TUK_TUK_SELF_DRIVE" || mode === "SELF_DRIVE") && road?.source === "OSRM_TABLE" && road.distanceKm !== undefined) {
    return { ...base, roadReferenceDistanceKm: road.distanceKm, routingSource: "OSRM_TABLE" };
  }
  return base;
}

function assignedMode(preference: TransportPreference | undefined, key: string,
  assignments: Record<string, TransportMode>): TransportMode {
  if (preference === "PRIVATE_DRIVER") return "PRIVATE_DRIVER";
  if (preference === "TUK_TUK_SELF_DRIVE") return "TUK_TUK_SELF_DRIVE";
  if (preference === "PUBLIC_TRANSPORT") return assignments[key] === "BUS" || assignments[key] === "TRAIN"
    ? assignments[key] : "PUBLIC_TRANSPORT_UNSPECIFIED";
  if (preference === "MIXED") return assignments[key] ?? "UNASSIGNED";
  // RECOMMEND and absent preference do not silently choose a private driver.
  return "UNASSIGNED";
}

export function assessTransportReadiness(legs: TransportLeg[], preference?: TransportPreference): TransportReadiness {
  const reasons = new Set<TransportReadiness["reasons"][number]>();
  if (legs.length === 0) {
    return { status: preference === "PRIVATE_DRIVER" ? "SUPPORTED" : "PARTIALLY_SUPPORTED",
      reasons: preference === "PRIVATE_DRIVER" ? ["MODE_PRICE_UNKNOWN"] :
        preference === "PUBLIC_TRANSPORT" ? ["PUBLIC_SCHEDULE_UNAVAILABLE", "MODE_PRICE_UNKNOWN"] :
          ["MODE_UNASSIGNED", "MODE_PRICE_UNKNOWN"] };
  }
  let knownTiming = 0;
  for (const leg of legs) {
    if (leg.mode === "UNASSIGNED") reasons.add("MODE_UNASSIGNED");
    if (["TRAIN", "BUS", "PUBLIC_TRANSPORT_UNSPECIFIED"].includes(leg.mode)) reasons.add("PUBLIC_SCHEDULE_UNAVAILABLE");
    if (leg.durationMinutes === undefined || leg.status === "UNKNOWN") reasons.add("MODE_TIME_UNKNOWN");
    else knownTiming += 1;
    if (leg.mode === "PRIVATE_DRIVER" && leg.status === "UNROUTABLE") reasons.add("ROAD_ROUTING_UNAVAILABLE");
  }
  reasons.add("MODE_PRICE_UNKNOWN");
  const allRoadKnown = legs.every(leg => leg.mode === "PRIVATE_DRIVER" &&
    leg.durationMinutes !== undefined && leg.status !== "UNROUTABLE");
  return {
    status: allRoadKnown ? "SUPPORTED" : knownTiming > 0 ? "PARTIALLY_SUPPORTED" : "UNSUPPORTED_WITH_CURRENT_DATA",
    reasons: [...reasons],
  };
}

function endpointId(matrix: TravelMatrix, location?: string): string | undefined {
  if (!location) return undefined;
  const key = location.trim().toLowerCase();
  return matrix.locations.find(item => item.id.toLowerCase() === key || item.name.toLowerCase() === key)?.id;
}

/** Pure adapter from Task 4 road candidates; no transit schedule is fetched or inferred. */
export function buildTransportPlan(route: CandidateRoute, brief: TripBriefV1, matrix: TravelMatrix,
  assignments: Record<string, TransportMode> = {}): TransportPlan {
  const preference = brief.transportPreference;
  const legs = route.legs.map(road => transportLegFromRoad(road,
    assignedMode(preference, transportLegId(road.fromId, road.toId), assignments), road.fromId, road.toId));
  const first = route.destinations[0];
  const last = route.destinations[route.destinations.length - 1];
  const arrivalId = endpointId(matrix, brief.arrival?.location);
  const departureId = endpointId(matrix, brief.departure?.location);
  const arrivalTransfer = brief.arrival?.location && first && brief.arrival.location.toLowerCase() !== first.name.toLowerCase()
    ? transportLegFromRoad(arrivalId ? matrixLeg(matrix, arrivalId, first.id) : undefined,
      assignedMode(preference, transportLegId(arrivalId ?? brief.arrival.location, first.id), assignments),
      arrivalId ?? brief.arrival.location, first.id) : undefined;
  const departureTransfer = brief.departure?.location && last && brief.departure.location.toLowerCase() !== last.name.toLowerCase()
    ? transportLegFromRoad(departureId ? matrixLeg(matrix, last.id, departureId) : undefined,
      assignedMode(preference, transportLegId(last.id, departureId ?? brief.departure.location), assignments),
      last.id, departureId ?? brief.departure.location) : undefined;
  return { routeId: route.id, preference, legs,
    ...(arrivalTransfer ? { arrivalTransfer } : {}),
    ...(departureTransfer ? { departureTransfer } : {}),
    readiness: assessTransportReadiness([...legs, ...[arrivalTransfer, departureTransfer].filter((leg): leg is TransportLeg => !!leg)], preference),
  };
}
