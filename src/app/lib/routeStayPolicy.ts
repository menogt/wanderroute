import type { TripBriefV1 } from "./planningTypes";

/*
 * Stay lengths and airport drives as Sri Lankan tour operators plan them. Benchmarked on 21 Nov 2026
 * against 24 published airport-to-airport itineraries (Aitken Spence, Walkers, Blue Lanka, Red Dot,
 * Sri Lanka In Style, Akura, TravelBug, JK Travels and others): 153 stays, none of 4+ nights; 3 nights
 * only at a Sigiriya hub or the beach; Kandy, Ella, Nuwara Eliya and Yala never above 2; no operator
 * drives from the airport to Ella, and most finish 2–3.5 hours from the airport.
 */
const BEACH = new Set(["mirissa", "galle", "unawatuna", "hikkaduwa", "bentota", "arugam bay", "trincomalee", "kalpitiya"]);
const AIRPORT_SIDE = new Set(["negombo", "colombo"]);
const HUB = new Set(["sigiriya", "dambulla", "habarana"]);

/** A longest first or last airport drive operators plan, in OSRM road minutes. */
export const AIRPORT_DRIVE_MAX_MINUTES = 210;

export const isCoastalEnd = (name: string) => BEACH.has(name.trim().toLowerCase()) || AIRPORT_SIDE.has(name.trim().toLowerCase());

/** The most nights operators typically give one base; slower paces get one more. */
export function typicalMaxNights(name: string, brief: Pick<TripBriefV1, "durationDays" | "pace">): number {
  const key = name.trim().toLowerCase();
  const slower = brief.pace === "SLOW_TRAVEL" || brief.pace === "RELAXED" ? 1 : 0;
  const base = BEACH.has(key) ? (brief.durationDays >= 13 ? 4 : 3) : HUB.has(key) ? 3 : 2;
  return base + slower;
}
