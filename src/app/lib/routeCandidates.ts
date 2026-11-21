import { cityInterestAffinity } from "./planningActivityChoices.ts";
import { CANONICAL_CITY_ORDER, autoSelectCities } from "./cityPlan.ts";
import { CITY_COORDS } from "../components/rl/mapConfig.ts";
import type { TripBriefV1 } from "./planningTypes";
import { arrivalDayUsableMinutes, departureDayUsableMinutes, assessRouteConstraints, drivingLimits, maximumPlanningBases } from "./routeConstraints.ts";
import { assessPlanningSeason, planningSeasonMonth, type PlanningSeason } from "./routeSeason.ts";
import { scoreRoute } from "./routeScoring.ts";
import { typicalMaxNights } from "./routeStayPolicy.ts";
import type { CandidateRoute, PlanningDestination, RouteReason } from "./routeTypes";
import { matrixLeg, type MatrixLocation, type RoadLeg, type TravelMatrix } from "./travelTimeMatrix.ts";

const MAX_DESTINATIONS = 8;
const MAX_SUBSETS = 5;
const MAX_ORDERS_PER_SUBSET = 4;

export function knownPlanningDestinations(): MatrixLocation[] {
  return Object.entries(CITY_COORDS).map(([name, [latitude, longitude]]) => ({
    id: name, name, coordinates: { latitude, longitude },
  }));
}

/** Requested places are retained even when no trusted coordinate is available. */
export function buildCandidateDestinations(
  brief: TripBriefV1, available: MatrixLocation[] = knownPlanningDestinations()
): PlanningDestination[] {
  const names = brief.requestedCities.length > 0 ? brief.requestedCities : autoSelectCities(brief.durationDays);
  const seen = new Set<string>();
  return names.flatMap(name => {
    const key = name.trim().toLowerCase();
    if (!key || seen.has(key)) return [];
    seen.add(key);
    const match = available.find(item => item.id.toLowerCase() === key || item.name.toLowerCase() === key);
    return [{
      id: match?.id ?? `requested:${key}`,
      name: match?.name ?? name.trim(),
      ...(match?.coordinates ? { coordinates: match.coordinates } : {}),
      requested: brief.requestedCities.length > 0,
    }];
  });
}

function canonicalOrder(destinations: PlanningDestination[]): PlanningDestination[] {
  return [...destinations].sort((a, b) => {
    const rank = (name: string) => {
      const index = CANONICAL_CITY_ORDER.findIndex(city => city.toLowerCase() === name.toLowerCase());
      return index < 0 ? CANONICAL_CITY_ORDER.length : index;
    };
    return rank(a.name) - rank(b.name);
  });
}

function nearestOrder(seed: PlanningDestination, destinations: PlanningDestination[], matrix: TravelMatrix): PlanningDestination[] {
  const remaining = destinations.filter(destination => destination.id !== seed.id);
  const ordered = [seed];
  while (remaining.length) {
    const previous = ordered[ordered.length - 1];
    remaining.sort((a, b) => {
      const aTime = matrixLeg(matrix, previous.id, a.id)?.durationMinutes ?? Number.POSITIVE_INFINITY;
      const bTime = matrixLeg(matrix, previous.id, b.id)?.durationMinutes ?? Number.POSITIVE_INFINITY;
      return aTime - bTime || a.id.localeCompare(b.id);
    });
    ordered.push(remaining.shift()!);
  }
  return ordered;
}

function ordersFor(destinations: PlanningDestination[], matrix: TravelMatrix): PlanningDestination[][] {
  const canonical = canonicalOrder(destinations);
  const proposals = [destinations, canonical, [...canonical].reverse(), nearestOrder(canonical[0], destinations, matrix),
    nearestOrder(canonical[canonical.length - 1], destinations, matrix)];
  const unique = new Set<string>();
  return proposals.filter(order => {
    const key = order.map(destination => destination.id).join("|");
    if (unique.has(key)) return false;
    unique.add(key);
    return true;
  }).slice(0, MAX_ORDERS_PER_SUBSET);
}

function subsetsFor(destinations: PlanningDestination[], limit: number, matrix: TravelMatrix): PlanningDestination[][] {
  if (destinations.length === 1) return [destinations];
  const canonical = canonicalOrder(destinations);
  const proposals = [
    ...(destinations.length <= limit ? [destinations] : []),
    destinations.slice(0, limit),
    destinations.slice(-limit),
    canonical.slice(0, limit),
    nearestOrder(canonical[0], destinations, matrix).slice(0, limit),
    // A genuine rest / fewer-hotel-changes alternative, with omissions kept explicit.
    canonical.slice(0, Math.max(1, Math.min(destinations.length, limit) - 1)),
    canonical.slice(-Math.max(1, Math.min(destinations.length, limit) - 1)),
  ];
  const unique = new Set<string>();
  return proposals.filter(subset => {
    const key = [...subset].map(destination => destination.id).sort().join("|");
    if (unique.has(key)) return false;
    unique.add(key);
    return true;
  }).slice(0, MAX_SUBSETS);
}

function allocateNights(
  brief: TripBriefV1, stops: PlanningDestination[], legs: RoadLeg[], finalNights?: number
): number[] {
  const totalNights = Math.max(0, brief.durationDays - 1);
  const minimum = drivingLimits(brief).minimumNightsPerBase;
  const nights = stops.map(() => minimum);
  if (nights.length * minimum > totalNights) {
    return stops.map((_, index) => index < totalNights ? 1 : 0);
  }
  // An airport-side last stop exists for the flight: it keeps exactly its nights and the rest go to the trip.
  const fixedLast = finalNights !== undefined && stops.length > 1 &&
    totalNights - (stops.length - 1) * minimum >= finalNights;
  if (fixedLast) nights[stops.length - 1] = finalNights;
  const spare = totalNights - nights.reduce((sum, value) => sum + value, 0);
  // First/last absorb constrained arrival/departure days. Longer inbound drives
  // then earn recovery time; stable index resolves ties.
  const priorities = stops.map((stop, index) => ({
    index,
    weight: (index === 0 && arrivalDayUsableMinutes(brief) === 0 ? 200 : 0) +
      (index === stops.length - 1 && departureDayUsableMinutes(brief) === 0 ? 200 : 0) +
      cityInterestAffinity(stop.name, brief) * 35 + (legs[index - 1]?.durationMinutes ?? 0) + (index === 0 || index === stops.length - 1 ? 30 : 0),
  })).sort((a, b) => b.weight - a.weight || a.index - b.index);
  return spreadNights(nights, spare, priorities.map(item => item.index).filter(index => !fixedLast || index !== stops.length - 1),
    stops.map(stop => typicalMaxNights(stop.name, brief)));
}

/**
 * Hands out spare nights in priority order without passing a stop's typical maximum. Only when every
 * stop is full does a stop go over, starting with the one allowed most nights (usually the beach).
 */
export function spreadNights(nights: number[], spare: number, order: number[], caps: number[]): number[] {
  const result = [...nights];
  let cursor = 0;
  while (spare > 0 && order.length) {
    const open = order.findIndex((_, step) => result[order[(cursor + step) % order.length]] < caps[order[(cursor + step) % order.length]]);
    const index = open >= 0 ? order[(cursor + open) % order.length]
      : [...order].sort((a, b) => (result[a] - caps[a]) - (result[b] - caps[b]) || caps[b] - caps[a])[0];
    result[index] += 1;
    spare -= 1;
    cursor = open >= 0 ? (cursor + open + 1) % order.length : cursor;
  }
  return result;
}

/** Nights beyond what tour operators typically give one base. */
function longStayReasons(brief: TripBriefV1, stops: PlanningDestination[], nights: number[]): RouteReason[] {
  return stops.flatMap((stop, index) => {
    const typical = typicalMaxNights(stop.name, brief);
    return nights[index] > typical ? [{ code: "LONG_STAY" as const, severity: "PENALTY" as const, destinations: [stop.name],
      details: { nights: nights[index], typicalMaximum: typical, excess: nights[index] - typical } }] : [];
  });
}

function routeLegs(order: PlanningDestination[], matrix: TravelMatrix): RoadLeg[] {
  return order.slice(1).map((destination, index) => matrixLeg(matrix, order[index].id, destination.id) ?? {
    fromId: order[index].id, toId: destination.id, status: "UNAVAILABLE",
  });
}

function seasonalReasons(
  order: PlanningDestination[], month?: number, assessments?: Map<string, PlanningSeason>
): RouteReason[] {
  return order.map(destination => assessments?.get(destination.id) ?? assessPlanningSeason(destination.name, month))
    .flatMap(assessment => assessment.status === "SUITABLE" ? [] : [{
      code: assessment.status === "AVOID" ? "SEASON_AVOID" :
        assessment.status === "CAUTION" ? "SEASON_CAUTION" : "SEASON_UNKNOWN",
      severity: assessment.status === "UNKNOWN" ? "UNCERTAIN" : "PENALTY",
      destinations: [assessment.destination],
      details: assessment.rule ? { rule: assessment.rule, region: assessment.region!, month: assessment.month! } : undefined,
    } as RouteReason]);
}

/** Bounded seeds/subsets, no permutations or geodesic stand-ins for road data. */
export function generateRouteCandidates(
  brief: TripBriefV1,
  suppliedDestinations: PlanningDestination[],
  matrix: TravelMatrix,
  seasonAssessments?: Map<string, PlanningSeason>,
  options: { finalNights?: number } = {}
): CandidateRoute[] {
  const requestedNames = new Set(brief.requestedCities.map(name => name.trim().toLowerCase()));
  const destinations = (suppliedDestinations.length ? suppliedDestinations : buildCandidateDestinations(brief))
    .map(destination => ({ ...destination,
      requested: destination.requested || requestedNames.has(destination.name.toLowerCase()) }));
  // A caller cannot accidentally erase an explicitly requested city.
  for (const requested of buildCandidateDestinations(brief, suppliedDestinations)) {
    if (requested.requested && !destinations.some(destination => destination.name.toLowerCase() === requested.name.toLowerCase())) {
      destinations.push(requested);
    }
  }
  if (destinations.length === 0) return [];
  const maxBases = Math.min(MAX_DESTINATIONS, maximumPlanningBases(brief));
  const subsets = subsetsFor(destinations, maxBases, matrix);
  // Keep an explicit rejected full-set witness when it is within the bounded size.
  if (destinations.length > maxBases && destinations.length <= MAX_DESTINATIONS) subsets.push(destinations);
  const candidates: CandidateRoute[] = [];
  const seen = new Set<string>();
  for (const subset of subsets) {
    for (const order of ordersFor(subset, matrix)) {
      const id = `route:${order.map(destination => encodeURIComponent(destination.id)).join(">")}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const legs = routeLegs(order, matrix);
      const nights = allocateNights(brief, order, legs, options.finalNights);
      const omitted = destinations.filter(destination => destination.requested &&
        !order.some(stop => stop.id === destination.id));
      const reasons: RouteReason[] = [
        ...omitted.map(destination => ({ code: "REQUESTED_CITY_OMITTED" as const, severity: "PENALTY" as const,
          destinations: [destination.name], details: { cause: order.length < maxBases ? "FEWER_BASES" : "INSUFFICIENT_DAYS" } })),
        ...(omitted.length ? [{ code: "ROUTE_REDUCED" as const, severity: "INFO" as const,
          details: { maximumBases: maxBases } }] : []),
        ...(order.length > maxBases || nights.includes(0) ? [{ code: "INSUFFICIENT_DAYS" as const,
          severity: "REJECTION" as const, details: { days: brief.durationDays, bases: order.length } }] : []),
        ...order.filter(destination => destination.requested && !destination.coordinates).map(destination => ({
          code: "REQUESTED_CITY_UNAVAILABLE" as const, severity: "UNCERTAIN" as const,
          destinations: [destination.name],
        })),
        ...assessRouteConstraints(brief, order, legs, matrix),
        ...longStayReasons(brief, order, nights),
        ...seasonalReasons(order, planningSeasonMonth(brief), seasonAssessments),
      ];
      const scored = scoreRoute(brief, order, legs, reasons);
      const feasibility = scored.reasons.some(reason => reason.severity === "REJECTION") ? "REJECTED" :
        scored.reasons.some(reason => reason.severity === "UNCERTAIN") ? "UNCERTAIN" : "FEASIBLE";
      candidates.push({ id, routingBasis: "ROAD_DRIVING", destinations: order, nights, legs, reasons: scored.reasons,
        feasibility, score: scored.score,
        firstDayUsableMinutes: arrivalDayUsableMinutes(brief),
        finalDayUsableMinutes: departureDayUsableMinutes(brief) });
    }
  }
  const rank = { FEASIBLE: 0, UNCERTAIN: 1, REJECTED: 2 };
  return candidates.sort((a, b) => rank[a.feasibility] - rank[b.feasibility] ||
    b.score.rankValue - a.score.rankValue || a.id.localeCompare(b.id));
}
