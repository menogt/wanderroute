/** Currencies offered in the planner's converter. Rates are units per one US dollar. */
export const CONVERTER_CURRENCIES = ["LKR", "USD", "EUR", "GBP", "AUD", "INR", "CAD", "SGD", "AED", "CHF", "JPY", "CNY"] as const;
export type ConverterCurrency = typeof CONVERTER_CURRENCIES[number];
export type RateTable = { rates: Record<string, number>; updated: string; live: boolean };

/** Offline fallback: only the sourced rate the budget itself uses (Central Cultural Fund, 14 Oct 2026). */
export const FALLBACK_RATES: RateTable = { rates: { USD: 1, LKR: 336 }, updated: "2026-10-14", live: false };

const KEY = "wanderroute_fx_rates";
const MAX_AGE_MS = 12 * 60 * 60 * 1000;
const RATES_URL = "https://open.er-api.com/v6/latest/USD";

/** Converts between two currencies through the dollar; undefined when either rate is missing or the amount is unusable. */
export function convertAmount(amount: number, from: string, to: string, table: RateTable): number | undefined {
  const a = table.rates[from], b = table.rates[to];
  if (!Number.isFinite(amount) || amount < 0 || !(a > 0) || !(b > 0)) return undefined;
  return amount / a * b;
}

/** Whole numbers for large or decimal-free amounts, two decimals otherwise. */
export function formatConverted(value: number, currency: string): string {
  const whole = value >= 1000 || currency === "LKR" || currency === "JPY";
  return value.toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 });
}

/** Keeps only the currencies the converter offers, and only positive finite rates. */
export function parseRates(payload: unknown): RateTable | undefined {
  const data = payload as { result?: string; rates?: Record<string, unknown>; time_last_update_unix?: number };
  if (!data || data.result !== "success" || !data.rates || typeof data.rates !== "object") return undefined;
  const rates: Record<string, number> = {};
  for (const code of CONVERTER_CURRENCIES) {
    const rate = data.rates[code];
    if (typeof rate === "number" && Number.isFinite(rate) && rate > 0) rates[code] = rate;
  }
  if (!(rates.USD > 0) || !(rates.LKR > 0)) return undefined;
  const time = typeof data.time_last_update_unix === "number" ? new Date(data.time_last_update_unix * 1000) : new Date();
  return { rates, updated: time.toISOString().slice(0, 10), live: true };
}

/** Daily mid-market rates, cached for 12 hours in this browser. Sends no trip or traveller data. Falls back to the built-in rate. */
export async function loadRates(): Promise<RateTable> {
  try {
    const cached = JSON.parse(localStorage.getItem(KEY) ?? "null") as { at: number; table: RateTable } | null;
    if (cached && Date.now() - cached.at < MAX_AGE_MS && cached.table?.rates?.LKR > 0) return cached.table;
  } catch { /* unreadable cache: fetch again */ }
  try {
    const response = await fetch(RATES_URL, { signal: AbortSignal.timeout(8000) });
    const table = response.ok ? parseRates(await response.json()) : undefined;
    if (table) {
      try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), table })); } catch { /* storage full: still usable */ }
      return table;
    }
  } catch { /* offline or blocked */ }
  return FALLBACK_RATES;
}
