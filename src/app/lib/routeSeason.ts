import { CITY_REGIONS, REGION_SEASONS, type SeasonRegion } from "./seasonData.ts";
import type { TripBriefV1 } from "./planningTypes";

export type PlanningSeason = {
  destination: string;
  status: "SUITABLE" | "CAUTION" | "AVOID" | "UNKNOWN";
  region?: SeasonRegion;
  rule?: string;
  month?: number;
};

/** Cross-month or incomplete date ranges remain unknown rather than choosing a misleading month. */
export function planningSeasonMonth(brief: TripBriefV1): number | undefined {
  if (Number.isInteger(brief.travelMonth) && brief.travelMonth! >= 1 && brief.travelMonth! <= 12) {
    return brief.travelMonth;
  }
  const start = brief.travelDates?.start?.match(/^(\d{4})-(\d{2})-\d{2}$/);
  const end = brief.travelDates?.end?.match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (!start || !end || start[1] !== end[1] || start[2] !== end[2]) return undefined;
  const month = Number(start[2]);
  return month >= 1 && month <= 12 ? month : undefined;
}

/** Uses the same region rules as the existing warning banner; weather alone is not a hard veto. */
export function assessPlanningSeason(destination: string, month?: number): PlanningSeason {
  const region = CITY_REGIONS[destination.trim().toLowerCase()];
  if (!region || !Number.isInteger(month) || month! < 1 || month! > 12) {
    return { destination, status: "UNKNOWN" };
  }
  const rule = REGION_SEASONS[region];
  // Island-wide October-November inter-monsoon context, not a live forecast.
  // Sri Lanka Tourism climate guide, checked 2026-10-24: https://www.srilanka.travel/weather
  const interMonsoon = month === 10 || month === 11;
  const status = rule.avoid.includes(month!) ? "AVOID" : rule.caution.includes(month!) || interMonsoon ? "CAUTION" : "SUITABLE";
  return { destination, status, region, rule: interMonsoon ? "October-November inter-monsoon rain; keep outdoor plans flexible and check current conditions" : rule.weather, month };
}
