import { useState, useEffect, useRef } from "react";
import { geocodeWithFoursquare } from "../components/rl/foursquareGeocoder";

// A geocoding request: a stable `key` (so callers can map results back to their
// items), the place name to search, and an optional city to bias toward.
export type GeoQuery = { key: string; placeName: string; city?: string };

type GeoResult = Record<string, [number, number] | null>;

// Hook that geocodes a list of places via Foursquare (with Nominatim fallback).
// Handles loading state, progress, caching and rate limiting automatically, and
// renders progressively — coords appear one by one as each lookup resolves.
export function useFoursquareGeocoding(queries: GeoQuery[]): {
  coords: GeoResult;
  loading: boolean;
  resolved: number;
  total: number;
} {
  const [coords, setCoords] = useState<GeoResult>({});
  const [loading, setLoading] = useState(false);
  const [resolved, setResolved] = useState(0);
  const fetchedRef = useRef<string>("");

  // Stable dependency: only re-run when the actual set of queries changes.
  const depKey = queries.map(q => `${q.key}=${q.placeName}|${q.city ?? ""}`).join("§");

  useEffect(() => {
    if (queries.length === 0) {
      setCoords({});
      setResolved(0);
      setLoading(false);
      return;
    }

    // Don't re-fetch the same set of queries.
    if (fetchedRef.current === depKey) return;
    fetchedRef.current = depKey;

    setLoading(true);
    setResolved(0);

    let cancelled = false;

    (async () => {
      const results: GeoResult = {};
      for (let i = 0; i < queries.length; i++) {
        if (cancelled) break;
        const q = queries[i];
        results[q.key] = await geocodeWithFoursquare(q.placeName, q.city);
        if (!cancelled) {
          setCoords({ ...results });
          setResolved(i + 1);
        }
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey]);

  return { coords, loading, resolved, total: queries.length };
}
