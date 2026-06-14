import { useState, useEffect, useRef } from "react";
import { geocodePlace } from "../components/rl/geocoder";

type GeoResult = Record<string, [number, number] | null>;

// Hook that takes a list of place names and returns their coordinates.
// Handles loading state, caching, and rate limiting automatically.
export function useGeocoding(placeNames: string[]): {
  coords: GeoResult;
  loading: boolean;
  resolved: number;
  total: number;
} {
  const [coords, setCoords] = useState<GeoResult>({});
  const [loading, setLoading] = useState(false);
  const [resolved, setResolved] = useState(0);
  const fetchedRef = useRef<string>("");

  // Stable dependency: only re-run when the actual set of names changes.
  const depKey = placeNames.join("|");

  useEffect(() => {
    if (!placeNames || placeNames.length === 0) return;

    // Deduplicate
    const unique = [...new Set(placeNames.filter(Boolean))];
    const key = [...unique].sort().join("|");

    // Don't re-fetch if the same set of places
    if (fetchedRef.current === key) return;
    fetchedRef.current = key;

    setLoading(true);
    setResolved(0);

    let cancelled = false;

    // Geocode one by one so we can update progress
    (async () => {
      const results: GeoResult = {};
      for (let i = 0; i < unique.length; i++) {
        if (cancelled) break;
        const name = unique[i];
        results[name] = await geocodePlace(name);
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

  return { coords, loading, resolved, total: placeNames.length };
}
