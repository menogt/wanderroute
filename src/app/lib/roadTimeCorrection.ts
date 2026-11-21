import type { RoadLeg, TravelMatrix } from "./travelTimeMatrix";

/*
 * OSRM assumes free-flowing roads (about 48 km/h on Sri Lanka's hill roads). Realistic door-to-door
 * car averages, checked 21 Nov 2026 against transfer operators (Kiwitaxi, Daytrip), a Sri Lankan
 * driver company (GoTourRide) and a 2026 driving guide (LankanStays):
 *   hill legs Kandy / Nuwara Eliya / Ella ........ 25–35 km/h (Kandy–Nuwara Eliya 2.5–3 h, Nuwara Eliya–Ella 2–2.5 h)
 *   hill to lowland (e.g. Ella–Mirissa, CMB–Ella) . about 40–45 km/h
 *   Kandy to lowland (e.g. CMB–Kandy, Sigiriya) ... about 36–40 km/h (town traffic)
 *   lowland A-roads (e.g. CMB–Sigiriya) ........... about 45–50 km/h
 *   expressway legs (CMB–Galle/Mirissa) ........... OSRM is close; 57–75 km/h door to door
 * A leg is never made faster than OSRM's own time.
 */
export const ROAD_SPEEDS_KMH = { hill: 27, hillToLowland: 42, kandyToLowland: 38, lowland: 45 } as const;
/** OSRM averages above this are expressway-dominated; they keep OSRM time plus a small margin. */
const EXPRESSWAY_KMH = 65;
const EXPRESSWAY_MARGIN = 1.05;
export const ROAD_TIMES_ADJUSTED = "Sri Lanka road speeds, checked 2026-11-21";

const HIGH_HILLS = new Set(["nuwara eliya", "ella", "haputale", "hatton", "bandarawela"]);
const MID_HILLS = new Set(["kandy"]);
const terrain = (place: string) => {
  const key = place.trim().toLowerCase();
  return HIGH_HILLS.has(key) ? "high" : MID_HILLS.has(key) ? "mid" : "low";
};

/** Realistic car minutes for one leg from OSRM minutes and kilometres. */
export function correctedRoadMinutes(from: string, to: string, minutes: number, km?: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0 || km === undefined || !Number.isFinite(km) || km <= 0) return minutes;
  const a = terrain(from); const b = terrain(to);
  const hills = [a, b].filter(kind => kind !== "low");
  const speed = hills.length === 2 && hills.includes("high") ? ROAD_SPEEDS_KMH.hill
    : hills.includes("high") ? ROAD_SPEEDS_KMH.hillToLowland
    : hills.includes("mid") ? ROAD_SPEEDS_KMH.kandyToLowland : undefined;
  if (speed === undefined && km / (minutes / 60) >= EXPRESSWAY_KMH) return Math.round(minutes * EXPRESSWAY_MARGIN * 10) / 10;
  const realistic = km / (speed ?? ROAD_SPEEDS_KMH.lowland) * 60;
  return Math.round(Math.max(minutes, realistic) * 10) / 10;
}

/** The same matrix with every routed leg converted to realistic Sri Lankan car times. */
export function withSriLankaRoadTimes(matrix: TravelMatrix): TravelMatrix {
  if (matrix.source !== "OSRM_TABLE" || matrix.roadTimes) return matrix;
  const names = new Map(matrix.locations.map(location => [location.id, location.name]));
  const legs: RoadLeg[][] = matrix.legs.map(row => row.map(leg => leg.status === "ROUTED" && leg.durationMinutes !== undefined && leg.fromId !== leg.toId
    ? { ...leg, durationMinutes: correctedRoadMinutes(names.get(leg.fromId) ?? leg.fromId, names.get(leg.toId) ?? leg.toId, leg.durationMinutes, leg.distanceKm) }
    : leg));
  return { ...matrix, legs, roadTimes: ROAD_TIMES_ADJUSTED };
}
