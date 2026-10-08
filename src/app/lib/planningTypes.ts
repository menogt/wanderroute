import type {
  Currency, DayItem, DayPlan, GeneratedItinerary, Interest, TravelStyle,
} from "../components/rl/types";

export type Coordinates = { latitude: number; longitude: number };
export type TravelPace = "RELAXED" | "BALANCED" | "PACKED" | "SLOW_TRAVEL";
export type TimeWindow = { earliest?: string; latest?: string };
export type JourneyEndpoint = {
  location?: string;
  dateTime?: string;
  window?: TimeWindow;
};

/** V1 describes traveller intent, before route selection or generation. */
export type TripBriefV1 = {
  schemaVersion: 1;
  durationDays: number;
  travellerCount: number;
  budget: { amount: number; currency: Currency };
  interests: Interest[];
  requestedCities: string[];
  comfortTier: TravelStyle;
  pace?: TravelPace;
  travelMonth?: number;
  travelDates?: { start?: string; end?: string };
  arrival?: JourneyEndpoint;
  departure?: JourneyEndpoint;
  maxPreferredDailyDrivingMinutes?: number;
  travellerNotes?: string;
};

export type PriceEvidenceStatus = "KNOWN" | "ESTIMATED" | "VERIFIED";
type PriceEvidenceBase = {
  amount: number;
  currency: Currency;
  confidence?: number;
  note?: string;
};
export type PriceEvidence = PriceEvidenceBase & (
  | { status: Exclude<PriceEvidenceStatus, "VERIFIED">; source?: string; checkedAt?: string }
  | { status: "VERIFIED"; source: string; checkedAt: string }
);

export type CandidatePlace = {
  databaseId?: string;
  providerPlaceId?: string;
  sourceProvider?: string;
  name: string;
  city: string;
  category: string;
  coordinates?: Coordinates;
  openingHours?: unknown;
  /** The raw database amount is not evidence of verification. */
  recordedPrice?: { amount: number; currency: Currency };
  priceEvidence?: PriceEvidence;
  sourceUpdatedAt?: string;
};

export type RouteStop = {
  id: string;
  destinationName: string;
  placeId?: string;
  nights: number;
};
export type RouteLeg = {
  fromStopId: string;
  toStopId: string;
  drivingDurationMinutes?: number;
  drivingDistanceKm?: number;
};
export type RouteConceptV1 = {
  schemaVersion: 1;
  id: string;
  tripBriefVersion: 1;
  stops: RouteStop[];
  roadLegs: RouteLeg[];
  estimatedBudgetRange?: { minimum: number; maximum: number; currency: Currency };
  seasonalAssessment?: { status: "SUITABLE" | "CAUTION" | "UNSUITABLE" | "UNKNOWN"; reasons: string[] };
  interestMatch?: { matched: Interest[]; unmatched: Interest[]; explanation?: string };
  tradeoffs: string[];
  constraintResults: { constraint: string; satisfied: boolean | null; explanation?: string }[];
  explanation: string;
  generatedAt: string;
  generatorVersion: string;
};

export type PlanningItemV2 = Omit<DayItem, "id"> & {
  id: string;
  city: string;
  placeId?: string;
  coordinates?: Coordinates;
  plannedStart?: string;
  plannedEnd?: string;
  durationMinutes?: number;
  priceEvidence?: PriceEvidence;
};
export type PlanningDayV2 = Omit<DayPlan, "items"> & { items: PlanningItemV2[] };
/** Additive to the display model; legacy screens can consume it unchanged. */
export type PlanningItineraryV2 = Omit<GeneratedItinerary, "days"> & {
  schemaVersion: 2;
  routeConceptId?: string;
  days: PlanningDayV2[];
};
