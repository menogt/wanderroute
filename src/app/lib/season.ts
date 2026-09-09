// Client-side seasonal check. Runs after generation on the cities the trip
// already has; never feeds into the prompt or the serverless functions.

// Explicit .ts extension so Node's built-in test runner can resolve it too.
import { CITY_REGIONS, MONTH_NAMES, REGION_SEASONS, type SeasonRegion } from "./seasonData.ts";

export type SeasonSeverity = "avoid" | "caution";

export type SeasonWarning = {
  city: string;
  region: SeasonRegion;
  severity: SeasonSeverity;
  message: string;
  alternative: string;
};

function isValidMonth(month: unknown): month is number {
  return typeof month === "number" && Number.isInteger(month) && month >= 1 && month <= 12;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
}

/**
 * Returns one warning per known city whose region is out of season in the
 * given month. Returns [] when the month is missing or invalid, when no city
 * is recognised, or when everything is in season. Matching is case-insensitive.
 */
export function checkSeason(cities: string[], month: number | null): SeasonWarning[] {
  if (!isValidMonth(month) || !Array.isArray(cities)) return [];

  const monthName = MONTH_NAMES[month - 1];
  const warnings: SeasonWarning[] = [];
  const seen = new Set<string>();

  for (const rawCity of cities) {
    if (typeof rawCity !== "string") continue;
    const city = rawCity.trim();
    const key = city.toLowerCase();
    if (!key || seen.has(key)) continue;

    const region = CITY_REGIONS[key];
    if (!region) continue;

    const season = REGION_SEASONS[region];
    const severity: SeasonSeverity | null = season.avoid.includes(month)
      ? "avoid"
      : season.caution.includes(month)
      ? "caution"
      : null;
    if (!severity) continue;

    seen.add(key);

    const message =
      severity === "avoid"
        ? `${city} is in ${season.weather} in ${monthName}. Expect heavy rain and rough seas.`
        : `${city} can see ${season.weather} in ${monthName}. Pack for showers and plan indoor options.`;

    const alternative = `Consider ${joinNames(season.alternatives)}, where ${monthName} is a better time to visit.`;

    warnings.push({ city, region, severity, message, alternative });
  }

  return warnings;
}
