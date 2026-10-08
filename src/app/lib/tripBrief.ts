import type { TripInputs } from "../components/rl/types";
import type { TripBriefV1 } from "./planningTypes";

/** Copy only fields the current form actually supplies. Empty cities means auto-select later. */
export function tripInputsToBrief(inputs: TripInputs): TripBriefV1 {
  return {
    schemaVersion: 1,
    durationDays: inputs.days,
    travellerCount: inputs.people,
    budget: { amount: inputs.budget, currency: inputs.currency },
    interests: [...inputs.interests],
    requestedCities: [...inputs.cities],
    comfortTier: inputs.travelStyle,
  };
}
