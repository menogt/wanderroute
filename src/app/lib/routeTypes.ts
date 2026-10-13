import type { MatrixLocation, RoadLeg } from "./travelTimeMatrix";

export type PlanningDestination = MatrixLocation & { requested: boolean };
export type RouteReasonSeverity = "INFO" | "PENALTY" | "UNCERTAIN" | "REJECTION";
export type RouteReasonCode =
  | "REQUESTED_CITY_UNAVAILABLE" | "REQUESTED_CITY_OMITTED" | "INSUFFICIENT_DAYS"
  | "EXCESSIVE_DRIVING" | "PREFERRED_DRIVING_EXCEEDED" | "UNROUTABLE"
  | "ROUTING_UNKNOWN" | "SEASON_AVOID" | "SEASON_CAUTION" | "SEASON_UNKNOWN"
  | "ARRIVAL_CONFLICT" | "DEPARTURE_CONFLICT" | "ARRIVAL_TIME_UNKNOWN"
  | "DEPARTURE_TIME_UNKNOWN" | "ENDPOINT_UNKNOWN" | "BACKTRACKING"
  | "DESTINATION_SWITCHING" | "ROUTE_REDUCED";
export type RouteReason = {
  code: RouteReasonCode;
  severity: RouteReasonSeverity;
  destinations?: string[];
  details?: Record<string, string | number | boolean>;
};
export type CandidateRoute = {
  id: string;
  destinations: PlanningDestination[];
  nights: number[];
  legs: RoadLeg[];
  reasons: RouteReason[];
  feasibility: "FEASIBLE" | "UNCERTAIN" | "REJECTED";
  score: RouteScore;
  firstDayUsableMinutes?: number;
  finalDayUsableMinutes?: number;
};
export type RouteScore = {
  rankValue: number;
  components: {
    requestedCoverage: number;
    driving: number;
    preferredDriving: number;
    longestLeg: number;
    season: number;
    backtracking: number;
    switching: number;
    uncertainty: number;
  };
  /** Internal ordering only; never display as a percentage. */
  rankable: boolean;
};
