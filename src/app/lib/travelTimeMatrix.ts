import type { Coordinates } from "./planningTypes";

export type MatrixLocation = { id: string; name: string; coordinates?: Coordinates };
export type RoadLegStatus = "ROUTED" | "PARTIAL" | "UNROUTABLE" | "MISSING_COORDINATES" | "UNAVAILABLE";
export type RoadLeg = {
  fromId: string;
  toId: string;
  status: RoadLegStatus;
  source?: "OSRM_TABLE";
  durationMinutes?: number;
  distanceKm?: number;
};
export type TravelMatrix = {
  locations: MatrixLocation[];
  legs: RoadLeg[][];
  source: "OSRM_TABLE" | "UNAVAILABLE";
  generatedAt: string;
  failure?: "NO_COORDINATES" | "HTTP_ERROR" | "TIMEOUT" | "NETWORK_ERROR" | "INVALID_RESPONSE";
};

type TableResponse = {
  code?: string;
  durations?: (number | null)[][];
  distances?: (number | null)[][];
};
type Fetcher = (url: string, init: RequestInit) => Promise<Pick<Response, "ok" | "json">>;
export type MatrixOptions = {
  fetcher?: Fetcher;
  cache?: Map<string, TravelMatrix>;
  now?: () => string;
  timeoutMs?: number;
  baseUrl?: string;
};

const DEFAULT_BASE = "https://router.project-osrm.org";
const DEFAULT_TIMEOUT_MS = 8000;
const inMemoryCache = new Map<string, TravelMatrix>();

function hasCoordinates(location: MatrixLocation): boolean {
  const { latitude, longitude } = location.coordinates ?? {};
  return typeof latitude === "number" && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
    typeof longitude === "number" && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

/** Order-independent key; source/profile and coordinates are included for server-cache reuse. */
export function travelMatrixKey(locations: MatrixLocation[], baseUrl = DEFAULT_BASE): string {
  const sorted = [...locations].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return `osrm-table-v1:driving:${baseUrl}:${JSON.stringify(sorted.map(location => [
    location.id,
    location.name,
    hasCoordinates(location) ? location.coordinates!.latitude.toFixed(5) : null,
    hasCoordinates(location) ? location.coordinates!.longitude.toFixed(5) : null,
  ]))}`;
}

function emptyLeg(from: MatrixLocation, to: MatrixLocation): RoadLeg {
  return {
    fromId: from.id, toId: to.id,
    status: hasCoordinates(from) && hasCoordinates(to) ? "UNAVAILABLE" : "MISSING_COORDINATES",
  };
}

function validValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function matrixLeg(matrix: TravelMatrix, fromId: string, toId: string): RoadLeg | undefined {
  const from = matrix.locations.findIndex(location => location.id === fromId);
  const to = matrix.locations.findIndex(location => location.id === toId);
  return from < 0 || to < 0 ? undefined : matrix.legs[from]?.[to];
}

/**
 * OSRM Table returns fastest-route seconds and metres with annotations=duration,distance.
 * No fallback_speed is sent: null means unroutable, never straight-line estimated.
 * Failed requests are not cached. A custom fetcher without a cache is isolated for tests.
 */
export async function fetchTravelMatrix(
  input: MatrixLocation[], options: MatrixOptions = {}
): Promise<TravelMatrix> {
  const locations = [...input].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  if (new Set(locations.map(location => location.id)).size !== locations.length) {
    throw new Error("Travel matrix location IDs must be unique");
  }
  const key = travelMatrixKey(locations, options.baseUrl ?? DEFAULT_BASE);
  const cache = options.cache ?? (options.fetcher ? undefined : inMemoryCache);
  const cached = cache?.get(key);
  if (cached) return cached;

  const legs = locations.map(from => locations.map(to => emptyLeg(from, to)));
  const result: TravelMatrix = {
    locations, legs, source: "UNAVAILABLE", generatedAt: options.now?.() ?? new Date().toISOString(),
  };
  const valid = locations.filter(hasCoordinates);
  if (valid.length === 0) return { ...result, failure: "NO_COORDINATES" };
  if (valid.length === 1) {
    const index = locations.findIndex(location => location.id === valid[0].id);
    legs[index][index] = { fromId: valid[0].id, toId: valid[0].id, status: "ROUTED", durationMinutes: 0, distanceKm: 0 };
    return result;
  }

  const path = valid.map(location => `${location.coordinates!.longitude},${location.coordinates!.latitude}`).join(";");
  const url = `${options.baseUrl ?? DEFAULT_BASE}/table/v1/driving/${path}?annotations=duration,distance`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const response = await (options.fetcher ?? fetch)(url, { signal: controller.signal });
    if (!response.ok) return { ...result, failure: "HTTP_ERROR" };
    let body: TableResponse;
    try {
      body = await response.json() as TableResponse;
    } catch {
      return { ...result, failure: "INVALID_RESPONSE" };
    }
    const n = valid.length;
    if (body.code === "NoTable") {
      for (const fromLocation of valid) {
        for (const toLocation of valid) {
          const from = locations.findIndex(location => location.id === fromLocation.id);
          const to = locations.findIndex(location => location.id === toLocation.id);
          legs[from][to] = from === to
            ? { fromId: fromLocation.id, toId: toLocation.id, status: "ROUTED", source: "OSRM_TABLE", durationMinutes: 0, distanceKm: 0 }
            : { fromId: fromLocation.id, toId: toLocation.id, status: "UNROUTABLE", source: "OSRM_TABLE" };
        }
      }
      result.source = "OSRM_TABLE";
      cache?.set(key, result);
      return result;
    }
    if (body.code !== "Ok" || !Array.isArray(body.durations) || !Array.isArray(body.distances) ||
        body.durations.length !== n || body.distances.length !== n ||
        body.durations.some(row => !Array.isArray(row) || row.length !== n) ||
        body.distances.some(row => !Array.isArray(row) || row.length !== n) ||
        body.durations.some(row => row.some(value => value !== null && !validValue(value))) ||
        body.distances.some(row => row.some(value => value !== null && !validValue(value)))) {
      return { ...result, failure: "INVALID_RESPONSE" };
    }
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        const from = locations.findIndex(location => location.id === valid[i].id);
        const to = locations.findIndex(location => location.id === valid[j].id);
        const seconds = body.durations[i][j];
        const metres = body.distances[i][j];
        const durationKnown = validValue(seconds);
        const distanceKnown = validValue(metres);
        legs[from][to] = {
          fromId: valid[i].id, toId: valid[j].id, source: "OSRM_TABLE",
          status: durationKnown && distanceKnown ? "ROUTED" :
            durationKnown || distanceKnown ? "PARTIAL" : "UNROUTABLE",
          ...(durationKnown ? { durationMinutes: seconds / 60 } : {}),
          ...(distanceKnown ? { distanceKm: metres / 1000 } : {}),
        };
      }
    }
    result.source = "OSRM_TABLE";
    cache?.set(key, result);
    return result;
  } catch (error) {
    return { ...result, failure: controller.signal.aborted ? "TIMEOUT" : "NETWORK_ERROR" };
  } finally {
    clearTimeout(timeout);
  }
}
