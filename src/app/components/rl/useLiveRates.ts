import { useEffect, useState } from "react";
import { CURRENCY_RATES } from "./data";
import type { Currency } from "./types";

const API_URL = "https://open.er-api.com/v6/latest/USD";
const CACHE_KEY = "wr_live_rates_v1";
const TTL_MS = 60 * 60 * 1000; // 1 hour

type CachePayload = {
  timestamp: number;
  rates: Record<Currency, number>;
};

// The currencies the app actually supports — keys of the hardcoded fallback.
const SUPPORTED = Object.keys(CURRENCY_RATES) as Currency[];

/**
 * Pull only our supported currencies out of the API's full rate table.
 * Any currency missing from the response falls back to the hardcoded rate.
 */
function pickSupportedRates(apiRates: Record<string, number>): Record<Currency, number> {
  const result = {} as Record<Currency, number>;
  for (const code of SUPPORTED) {
    const live = apiRates[code];
    result[code] = typeof live === "number" && live > 0 ? live : CURRENCY_RATES[code];
  }
  return result;
}

function readCache(): Record<Currency, number> | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachePayload;
    if (!parsed?.timestamp || !parsed?.rates) return null;
    if (Date.now() - parsed.timestamp > TTL_MS) return null;
    return parsed.rates;
  } catch {
    return null;
  }
}

function writeCache(rates: Record<Currency, number>) {
  try {
    const payload: CachePayload = { timestamp: Date.now(), rates };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage may be unavailable (private mode / quota) — non-fatal.
  }
}

/**
 * Returns live USD-based exchange rates for the app's supported currencies.
 * Falls back to the hardcoded CURRENCY_RATES on any failure, and caches a
 * successful fetch in localStorage for 1 hour to avoid hammering the API.
 */
export function useLiveRates() {
  const [rates, setRates] = useState<Record<Currency, number>>(() => readCache() ?? CURRENCY_RATES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Fresh cache hit — skip the network entirely.
    const cached = readCache();
    if (cached) {
      setRates(cached);
      setLoading(false);
      return;
    }

    async function fetchRates() {
      try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data?.result !== "success" || !data?.rates) {
          throw new Error("Unexpected API response");
        }
        const picked = pickSupportedRates(data.rates as Record<string, number>);
        if (cancelled) return;
        setRates(picked);
        setError(null);
        writeCache(picked);
      } catch (err) {
        if (cancelled) return;
        // Keep the hardcoded fallback already in state.
        setRates(CURRENCY_RATES);
        setError(err instanceof Error ? err.message : "Failed to fetch live rates");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchRates();
    return () => {
      cancelled = true;
    };
  }, []);

  return { rates, loading, error };
}
