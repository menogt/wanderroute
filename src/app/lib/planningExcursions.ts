import type { PlanningCustomization } from "./planningCustomization";
import type { CandidateRoute } from "./routeTypes";
import type { TravelMatrix } from "./travelTimeMatrix";
import { matrixLeg } from "./travelTimeMatrix.ts";
import { routeDayCities } from "./planningV2Scheduling.ts";
import { assessTransportReadiness, transportLegFromRoad } from "./transportPlanning.ts";
import type { TransportPlan } from "./transportTypes";
import type { TripBriefV1 } from "./planningTypes";

/** A day visit returns to the same overnight base; it never consumes another hotel night. */
export function excursionTransport(brief: TripBriefV1, route: CandidateRoute, matrix: TravelMatrix,
  transport: TransportPlan, requests: PlanningCustomization["wishlist"] = []): TransportPlan {
  const cities = routeDayCities(route, brief.durationDays);
  const used = new Set<number>();
  const excursions = requests.filter(request => request.requirement !== "EXCLUDED" && request.role === "VISIT" && request.day !== undefined)
    .map(request => {
      const day = request.day!, base = cities[day - 1];
      if (!Number.isInteger(day) || day <= 1 || day >= brief.durationDays || !base || cities[day - 2] !== base ||
          request.city === base || used.has(day)) throw new Error("Choose a free middle day at the same overnight base for each day visit. Arrival, departure and hotel-change days stay protected.");
      used.add(day);
      const mode = request.mode ?? (brief.transportPreference === "PRIVATE_DRIVER" ? "PRIVATE_DRIVER" : "UNASSIGNED");
      const from = route.destinations.find(stop => stop.name === base)?.id ?? base;
      const to = matrix.locations.find(location => location.name === request.city)?.id ?? request.city;
      const outbound = transportLegFromRoad(matrixLeg(matrix, from, to), mode, from, to);
      const inbound = transportLegFromRoad(matrixLeg(matrix, to, from), mode, to, from);
      return { day, city: request.city, base,
        outbound: { ...outbound, id: `visit:${day}:${from}>${to}:out` },
        inbound: { ...inbound, id: `visit:${day}:${to}>${from}:back` } };
    });
  const readiness = assessTransportReadiness([...transport.legs,
    ...[transport.arrivalTransfer, transport.departureTransfer].filter(Boolean),
    ...excursions.flatMap(visit => [visit.outbound, visit.inbound])], transport.preference);
  return { ...transport, excursions, readiness };
}
