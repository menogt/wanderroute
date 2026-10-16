import type {
  Currency, DayItem, DayPlan, GeneratedItinerary, Interest, TravelStyle,
} from "../components/rl/types";
import type { TransportPreference } from "./transportTypes";

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
  /** V1 supplies this; the V2 brief may leave it unspecified. */
  comfortTier?: TravelStyle;
  /** Not collected by the V1 form; absence means no transport choice was made. */
  transportPreference?: TransportPreference;
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
export type PlaceEvidence = { status: "VERIFIED" | "KNOWN" | "UNKNOWN"; source?: string; checkedAt?: string };

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
  /** Only a sourced basis can turn a place price into a ledger charge. */
  priceBasis?: "PER_PERSON" | "PER_ROOM_NIGHT" | "PER_GROUP";
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

export type PlanningItemV2 = Omit<DayItem, "id" | "cost"> & {
  id: string;
  /** Present only when a ledger-backed exact line exists. */
  cost?: number;
  city: string;
  placeId?: string;
  placeEvidence?: PlaceEvidence;
  coordinates?: Coordinates;
  plannedStart?: string;
  plannedEnd?: string;
  durationMinutes?: number;
  durationEvidence?: "ESTIMATED" | "KNOWN";
  /** Stable fromId>toId key for a scheduled intercity transport item. */
  transportLegId?: string;
  priceEvidence?: PriceEvidence;
};
export type PlanningDayV2 = Omit<DayPlan, "items" | "accommodationCostPerNight" | "dailyCostPerPerson"> & {
  items: PlanningItemV2[];
  date?: string;
  overnightCity?: string;
  accommodationPlaceId?: string;
  accommodationCostPerNight?: number;
  dailyCostPerPerson?: number;
  warnings?: string[];
};
/** V2 keeps unknown prices absent; its display uses the accompanying cost ledger. */
export type PlanningItineraryV2 = Omit<GeneratedItinerary, "days" | "estimatedCostPerPerson" |
  "estimatedTotalCost" | "remainingBudget" | "budgetStatus" | "costBreakdown" | "travelStyle"> & {
  schemaVersion: 2;
  routeConceptId?: string;
  days: PlanningDayV2[];
  estimatedCostPerPerson?: number;
  estimatedTotalCost?: number;
  remainingBudget?: number;
  budgetStatus?: GeneratedItinerary["budgetStatus"];
  costBreakdown?: GeneratedItinerary["costBreakdown"];
  travelStyle?: TravelStyle;
};
