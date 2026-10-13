import { CANONICAL_CITY_ORDER } from "./cityPlan.ts";
import type { TripBriefV1 } from "./planningTypes";
import { drivingLimits } from "./routeConstraints.ts";
import type { PlanningDestination, RouteReason, RouteScore } from "./routeTypes";
import type { RoadLeg } from "./travelTimeMatrix";

function backtrackCount(destinations: PlanningDestination[]): number {
  const ranks = destinations.map(destination => CANONICAL_CITY_ORDER.findIndex(
    city => city.toLowerCase() === destination.name.toLowerCase()
  )).filter(rank => rank >= 0);
  let previousDirection = 0;
  let reversals = 0;
  for (let i = 1; i < ranks.length; i += 1) {
    const direction = Math.sign(ranks[i] - ranks[i - 1]);
    if (direction && previousDirection && direction !== previousDirection) reversals += 1;
    if (direction) previousDirection = direction;
  }
  return reversals;
}

/** Signed, inspectable components for internal ranking only. */
export function scoreRoute(
  brief: TripBriefV1, destinations: PlanningDestination[], legs: RoadLeg[], reasons: RouteReason[]
): { score: RouteScore; reasons: RouteReason[] } {
  const requested = destinations.filter(destination => destination.requested).length;
  const driveTimes = legs.map(leg => leg.durationMinutes).filter((time): time is number => time !== undefined);
  const totalDrive = driveTimes.reduce((sum, time) => sum + time, 0);
  const longest = Math.max(0, ...driveTimes);
  const reversals = backtrackCount(destinations);
  const limits = drivingLimits(brief);
  const pace = limits.pace;
  const switchingWeight = pace === "SLOW_TRAVEL" ? 18 : pace === "RELAXED" ? 12 : pace === "PACKED" ? 3 : 7;
  const scoredReasons = [...reasons];
  if (reversals > 0) scoredReasons.push({ code: "BACKTRACKING", severity: "PENALTY", details: { reversals } });
  if (destinations.length > 1) scoredReasons.push({ code: "DESTINATION_SWITCHING", severity: "PENALTY", details: { switches: destinations.length - 1 } });
  const components = {
    requestedCoverage: requested * 50 - reasons.filter(reason => reason.code === "REQUESTED_CITY_OMITTED").length * 60,
    driving: -totalDrive / 30,
    preferredDriving: -driveTimes.reduce((sum, time) => sum + Math.max(0, time - limits.preferredMinutes), 0) / 10,
    longestLeg: -longest / 40,
    season: -reasons.filter(reason => reason.code === "SEASON_AVOID").length * 35 -
      reasons.filter(reason => reason.code === "SEASON_CAUTION").length * 12,
    backtracking: -reversals * 30,
    switching: -Math.max(0, destinations.length - 1) * switchingWeight,
    uncertainty: -reasons.filter(reason => reason.severity === "UNCERTAIN").length * 20,
  };
  const rejected = scoredReasons.some(reason => reason.severity === "REJECTION");
  return {
    score: { rankValue: Object.values(components).reduce((sum, value) => sum + value, 0), components, rankable: !rejected },
    reasons: scoredReasons,
  };
}
