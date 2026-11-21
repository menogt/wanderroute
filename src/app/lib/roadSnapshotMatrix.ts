import type { MatrixLocation, RoadLeg, TravelMatrix } from "./travelTimeMatrix";
import { ROAD_SNAPSHOT_CHECKED, ROAD_SNAPSHOT_IDS, ROAD_SNAPSHOT_KM, ROAD_SNAPSHOT_MINUTES } from "./roadTimeSnapshot.ts";
import { correctedRoadMinutes } from "./roadTimeCorrection.ts";

const INDEX = new Map(ROAD_SNAPSHOT_IDS.map((id, position) => [id.toLowerCase(), position]));

/** Realistic driving minutes between two planner places (stored OSRM data, hill-road corrected). */
export function snapshotRoadMinutes(fromId: string, toId: string): number | undefined {
  const from = INDEX.get(fromId.toLowerCase()); const to = INDEX.get(toId.toLowerCase());
  if (from === undefined || to === undefined) return undefined;
  const minutes = ROAD_SNAPSHOT_MINUTES[from][to];
  return minutes === null ? undefined : from === to ? 0 : correctedRoadMinutes(fromId, toId, minutes, ROAD_SNAPSHOT_KM[from][to] ?? undefined);
}

/**
 * The same OSRM table data captured on ROAD_SNAPSHOT_CHECKED, for when the live public service fails.
 * Places outside the snapshot stay unavailable rather than estimated.
 */
export function snapshotMatrix(locations: MatrixLocation[]): TravelMatrix | undefined {
  if (locations.filter(location => INDEX.has(location.id.toLowerCase())).length < 2) return undefined;
  const legs: RoadLeg[][] = locations.map(from => locations.map(to => {
    const a = INDEX.get(from.id.toLowerCase()); const b = INDEX.get(to.id.toLowerCase());
    if (a === undefined || b === undefined) {
      return { fromId: from.id, toId: to.id, status: from.coordinates && to.coordinates ? "UNAVAILABLE" : "MISSING_COORDINATES" };
    }
    const minutes = ROAD_SNAPSHOT_MINUTES[a][b]; const km = ROAD_SNAPSHOT_KM[a][b];
    return minutes === null ? { fromId: from.id, toId: to.id, status: "UNROUTABLE", source: "OSRM_TABLE" }
      : { fromId: from.id, toId: to.id, status: "ROUTED", source: "OSRM_TABLE", durationMinutes: minutes,
        ...(km !== null ? { distanceKm: km } : {}) };
  }));
  return { locations, legs, source: "OSRM_TABLE", generatedAt: `${ROAD_SNAPSHOT_CHECKED}T00:00:00.000Z`, snapshot: ROAD_SNAPSHOT_CHECKED };
}
