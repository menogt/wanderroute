import type { PlanningPresentation } from "./planningPresentation";
import type { TripBriefV1 } from "./planningTypes";
import type { QuoteTrip } from "./quoteRequests";
import { PRICES_CHECKED } from "./indicativePrices.ts";

export type DriverService = "WHOLE_TRIP" | "AIRPORT_TRANSFERS" | "NOT_SURE";
export type VehicleChoice = "CAR" | "VAN" | "NOT_SURE";

export const SERVICE_LABELS: Record<DriverService, string> = {
  WHOLE_TRIP: "Car with driver-guide for the whole trip",
  AIRPORT_TRANSFERS: "Airport transfers only",
  NOT_SURE: "Not sure yet; please advise",
};
export const VEHICLE_LABELS: Record<VehicleChoice, string> = {
  CAR: "Car (up to 3 travellers)",
  VAN: "Van (up to 6 travellers)",
  NOT_SURE: "Not sure; please advise",
};

/** Same split as the cost estimate: a car takes up to 3 travellers, a van up to 6. */
export function suggestedVehicle(travellers: number): VehicleChoice {
  return travellers <= 3 ? "CAR" : travellers <= 6 ? "VAN" : "NOT_SURE";
}

/** Receipts are per plan version, so an edited plan can be sent again. */
export const planningQuoteId = (plan: PlanningPresentation) => `planning-v2:${plan.reference}`;

/**
 * The exact route a driver needs to quote: stops and nights, flights, transfers with road times,
 * daily places and the published-price estimate. No prices are presented as quotes.
 */
export function planningQuoteTrip(plan: PlanningPresentation, brief: TripBriefV1,
  request: { service: DriverService; vehicle: VehicleChoice }): QuoteTrip {
  const min = Math.floor(plan.budget.supported);
  const max = Math.ceil(plan.budget.supportedMaximum);
  const priced = plan.budget.supported > 0;
  const dated = plan.days.filter(day => day.date);
  return {
    id: planningQuoteId(plan),
    routeName: plan.title,
    cities: plan.route.map(stop => stop.name),
    totalDays: brief.durationDays,
    travellers: brief.travellerCount,
    travelStyle: brief.comfortTier ?? "not chosen",
    estimatedTotal: priced ? Math.round((min + max) / 2) : null,
    currency: brief.budget.currency,
    snapshot: {
      kind: "planning-v2",
      reference: plan.reference,
      request,
      dates: dated.length ? { start: dated[0].date, end: dated[dated.length - 1].date } : null,
      arrival: brief.arrival ?? null,
      departure: brief.departure ?? null,
      stops: plan.route.map(stop => ({ name: stop.name, nights: stop.nights })),
      days: plan.days.map(day => ({ day: day.day, date: day.date ?? null, city: day.city, visitCity: day.visitCity ?? null,
        activities: day.items.filter(item => item.category === "activity" && !item.isFreeTime).map(item => item.label) })),
      transfers: plan.transfers.map(leg => ({ from: leg.from, to: leg.to, mode: leg.mode, timing: leg.timing })),
      estimate: priced ? { min, max, currency: brief.budget.currency, checked: PRICES_CHECKED,
        stillToPrice: plan.budget.uncovered } : null,
      comfort: brief.comfortTier ?? null,
      pace: brief.pace ?? null,
      interests: brief.interests,
      budget: brief.budget,
    },
  };
}
