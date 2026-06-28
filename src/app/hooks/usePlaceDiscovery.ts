import { useState, useEffect, useRef } from "react";
import {
  discoverPlacesNearCity,
  type DiscoveredPlace,
  type DiscoveryCategory,
} from "../components/rl/foursquareDiscovery";

// Hook that discovers places (hotels/restaurants/attractions) near a set of
// cities via Foursquare. Renders progressively — results appear city by city.
// `enabled` lets the caller defer fetching until the user actually wants to see
// pins (e.g. only after they tap "Show hotels"), so we don't burn API quota
// for people who never open the discovery layer.
export function usePlaceDiscovery(
  cities: string[],
  category: DiscoveryCategory,
  enabled: boolean,
  limitPerCity = 6
): {
  places: DiscoveredPlace[];
  loading: boolean;
  resolvedCities: number;
  totalCities: number;
} {
  const [places, setPlaces] = useState<DiscoveredPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolvedCities, setResolvedCities] = useState(0);
  const fetchedRef = useRef<string>("");

  const depKey = `${cities.join(",")}|${category}|${enabled}|${limitPerCity}`;

  useEffect(() => {
    if (!enabled || cities.length === 0) {
      setPlaces([]);
      setResolvedCities(0);
      setLoading(false);
      return;
    }

    if (fetchedRef.current === depKey) return;
    fetchedRef.current = depKey;

    setLoading(true);
    setResolvedCities(0);
    let cancelled = false;

    (async () => {
      const collected: DiscoveredPlace[] = [];
      for (let i = 0; i < cities.length; i++) {
        if (cancelled) break;
        const found = await discoverPlacesNearCity(cities[i], category, limitPerCity);
        collected.push(...found);
        if (!cancelled) {
          setPlaces([...collected]);
          setResolvedCities(i + 1);
        }
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey]);

  return { places, loading, resolvedCities, totalCities: cities.length };
}