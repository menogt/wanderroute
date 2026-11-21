import { autoSelectCities, CANONICAL_CITY_ORDER, SELECTABLE_CITIES } from "./cityPlan.ts";
import { drivingLimits } from "./routeConstraints.ts";
import { cityInterestAffinity } from "./planningActivityChoices.ts";
import type { TripBriefV1 } from "./planningTypes";
import { snapshotRoadMinutes } from "./roadSnapshotMatrix.ts";
import { AIRPORT_DRIVE_MAX_MINUTES, isCoastalEnd, typicalMaxNights } from "./routeStayPolicy.ts";
import type { PlanningDestination } from "./routeTypes";
import type { MatrixLocation } from "./travelTimeMatrix";

const COAST_ENDS = ["Mirissa", "Galle", "Hikkaduwa", "Unawatuna", "Negombo"];
/**
 * How often the 24 benchmarked operator itineraries stay overnight in each area (Nov 2026). Negombo is
 * common only as a one-night arrival stop, so it ranks below the places travellers come to see.
 */
const OPERATOR_FREQUENCY: Record<string, number> = { sigiriya: 20, "nuwara eliya": 18, mirissa: 11, galle: 11, ella: 11,
  negombo: 8, anuradhapura: 4, hikkaduwa: 4, trincomalee: 3, dambulla: 2, colombo: 2 };
const loopWeight = (name: string, brief: TripBriefV1) =>
  (OPERATOR_FREQUENCY[name.toLowerCase()] ?? 0) + cityInterestAffinity(name, brief) * 2;

/**
 * Chosen cities are must-sees, not the whole trip. When they cannot fill the nights without
 * stays longer than operators plan, add classic-loop stops (requested: false): first a coastal
 * finish within reach of the airport, then the stops operators use most (interests break ties).
 * Unchosen trips and trips the chosen cities already fill are returned unchanged.
 */
export function fillAroundRequested(brief: TripBriefV1, destinations: PlanningDestination[],
  available: MatrixLocation[], maxBases: number): PlanningDestination[] {
  if (!brief.requestedCities.length || !destinations.length) return destinations;
  const nights = Math.max(0, brief.durationDays - 1);
  const result = [...destinations];
  const capacity = () => result.reduce((sum, stop) => sum + typicalMaxNights(stop.name, brief), 0);
  if (capacity() >= nights || result.length >= maxBases) return result;
  const byName = (name: string) => available.find(place => place.name.toLowerCase() === name.toLowerCase());
  const absent = (place: MatrixLocation) => !result.some(stop => stop.id === place.id || stop.name.toLowerCase() === place.name.toLowerCase());
  const drive = (from: string, to: string) => snapshotRoadMinutes(from, to) ?? Number.POSITIVE_INFINITY;
  const add = (place: MatrixLocation) => result.push({ ...place, requested: false });
  const pool = autoSelectCities(brief.durationDays).map(byName).filter((place): place is MatrixLocation => !!place);

  const reachable = (place: MatrixLocation) => drive(place.id, "CMB_AIRPORT") <= AIRPORT_DRIVE_MAX_MINUTES;
  if (!result.some(stop => isCoastalEnd(stop.name) && reachable(stop))) {
    const options = [...new Map([...pool, ...COAST_ENDS.map(byName)].filter((place): place is MatrixLocation => !!place)
      .filter(place => absent(place) && isCoastalEnd(place.name) && reachable(place)).map(place => [place.id, place])).values()];
    // Finish next to whichever chosen city is furthest from the airport, as the loop ends there.
    const farthest = [...result].sort((a, b) => drive(b.id, "CMB_AIRPORT") - drive(a.id, "CMB_AIRPORT"))[0];
    const end = options.sort((a, b) => drive(farthest.id, a.id) - drive(farthest.id, b.id) || a.name.localeCompare(b.name))[0];
    if (end) add(end);
  }
  while (capacity() < nights && result.length < maxBases) {
    const detour = (place: MatrixLocation) => Math.min(...result.map(stop => drive(stop.id, place.id)));
    const next = pool.filter(absent).sort((a, b) => loopWeight(b.name, brief) - loopWeight(a.name, brief) ||
      detour(a) - detour(b) || a.name.localeCompare(b.name))[0];
    if (!next) break;
    add(next);
  }
  return result;
}

const loopRank = (name: string) => CANONICAL_CITY_ORDER.findIndex(city => city.toLowerCase() === name.toLowerCase());

/**
 * Operators break a drive longer than the traveller's preferred day with a night on the way
 * (Kandy → Nuwara Eliya → Ella rather than 5 hours in one go). Adds such an in-between loop stop
 * when days and bases allow and both halves fit the preferred drive. Only towns with place data qualify.
 */
export function splitLongLegs(brief: TripBriefV1, destinations: PlanningDestination[],
  available: MatrixLocation[], maxBases: number): PlanningDestination[] {
  const nights = Math.max(0, brief.durationDays - 1);
  const limit = drivingLimits(brief).preferredMinutes;
  const result = [...destinations];
  const drive = (from: string, to: string) => snapshotRoadMinutes(from, to) ?? Number.POSITIVE_INFINITY;
  const towns = SELECTABLE_CITIES.map(name => available.find(place => place.name === name)).filter((place): place is MatrixLocation => !!place);
  let changed = true;
  while (changed && result.length < maxBases && result.length < nights) {
    changed = false;
    const ordered = result.filter(stop => loopRank(stop.name) >= 0).sort((a, b) => loopRank(a.name) - loopRank(b.name));
    for (let index = 1; index < ordered.length && !changed; index++) {
      const [from, to] = [ordered[index - 1], ordered[index]];
      if (drive(from.id, to.id) <= limit) continue;
      const between = towns.filter(town => !result.some(stop => stop.id === town.id) &&
        loopRank(town.name) > loopRank(from.name) && loopRank(town.name) < loopRank(to.name) &&
        drive(from.id, town.id) <= limit && drive(town.id, to.id) <= limit)
        .sort((a, b) => drive(from.id, a.id) + drive(a.id, to.id) - drive(from.id, b.id) - drive(b.id, to.id))[0];
      if (between) { result.push({ ...between, requested: false }); changed = true; }
    }
  }
  return result;
}
