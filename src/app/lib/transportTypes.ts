/** A traveller's choice is independent of budget, comfort, group size and pace. */
export type TransportPreference =
  | "PRIVATE_DRIVER" | "PUBLIC_TRANSPORT" | "MIXED" | "TUK_TUK_SELF_DRIVE" | "RECOMMEND";
export type TransportMode =
  | "PRIVATE_DRIVER" | "TUK_TUK_SELF_DRIVE" | "TRAIN" | "BUS"
  | "PUBLIC_TRANSPORT_UNSPECIFIED" | "UNASSIGNED";
export type TransportValueEvidence = "VERIFIED" | "ESTIMATED" | "UNKNOWN";
export type TransportLegStatus = "ROAD_ESTIMATE" | "PARTIAL_ROAD_ESTIMATE" | "UNROUTABLE" | "UNKNOWN";
export type TransportLeg = {
  id: string;
  fromId: string;
  toId: string;
  mode: TransportMode;
  status: TransportLegStatus;
  durationMinutes?: number;
  distanceKm?: number;
  /** A car-road reference for slower/different vehicles, not that mode's journey distance. */
  roadReferenceDistanceKm?: number;
  routingSource?: "OSRM_TABLE";
  durationEvidence: TransportValueEvidence;
  distanceEvidence: TransportValueEvidence;
  evidenceSource?: string;
  checkedAt?: string;
};
export type TransportCapability = {
  mode: TransportMode;
  roadRoutingAvailable: boolean;
  scheduledTimeAvailable: boolean;
  fareAvailable: boolean;
  timingSupport: "ROAD_ESTIMATE" | "UNKNOWN";
  priceSupport: "UNKNOWN";
};
export type TransportReadiness = {
  status: "SUPPORTED" | "PARTIALLY_SUPPORTED" | "UNSUPPORTED_WITH_CURRENT_DATA";
  reasons: ("ROAD_ROUTING_UNAVAILABLE" | "MODE_TIME_UNKNOWN" | "PUBLIC_SCHEDULE_UNAVAILABLE" |
    "MODE_UNASSIGNED" | "MODE_PRICE_UNKNOWN")[];
};
export type TransportPlan = {
  routeId: string;
  preference?: TransportPreference;
  legs: TransportLeg[];
  arrivalTransfer?: TransportLeg;
  departureTransfer?: TransportLeg;
  readiness: TransportReadiness;
};
