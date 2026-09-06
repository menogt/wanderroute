import { supabase } from "./supabase";
import { getDeviceId } from "./placesDb";
import type { GeneratedItinerary } from "../components/rl/types";

// A traveller asking for a real, fixed, all-in price from a verified local
// driver for the route they just generated. This is the only conversion event
// in the product that indicates commercial intent, so it is stored twice:
// once in Supabase (source of truth) and once in localStorage (so a request is
// never silently lost if Supabase is unreachable).

const PENDING_KEY = "wanderroute_pending_quote_requests";

export type QuoteRequestInput = {
  fullName: string;
  email: string;
  whatsapp?: string;
  startDate?: string;
  travellers?: number;
  note?: string;
};

export type QuoteRequestResult = {
  ok: boolean;
  storedRemotely: boolean;
};

function buildRow(input: QuoteRequestInput, itinerary: GeneratedItinerary) {
  return {
    full_name: input.fullName.trim(),
    email: input.email.trim().toLowerCase(),
    whatsapp: input.whatsapp?.trim() || null,
    start_date: input.startDate || null,
    travellers: input.travellers ?? itinerary.totalPeople ?? null,
    note: input.note?.trim() || null,

    trip_id: itinerary.id,
    route_name: itinerary.routeName,
    cities: itinerary.cities ?? [],
    total_days: itinerary.totalDays,
    travel_style: itinerary.travelStyle,
    estimated_total: itinerary.estimatedTotalCost,
    currency: itinerary.currency,
    itinerary_json: itinerary as unknown as object,

    device_id: getDeviceId(),
    user_agent:
      typeof navigator === "undefined" ? null : navigator.userAgent.slice(0, 300),
  };
}

function stashLocally(row: ReturnType<typeof buildRow>) {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    const list = raw ? (JSON.parse(raw) as unknown[]) : [];
    list.push({ ...row, stashed_at: new Date().toISOString() });
    localStorage.setItem(PENDING_KEY, JSON.stringify(list.slice(-20)));
  } catch {
    // localStorage full or unavailable — nothing more we can do client-side.
  }
}

// Fire-and-forget notification so you learn about a request in minutes rather
// than whenever you next open the Supabase dashboard. Never blocks the user.
function notify(row: ReturnType<typeof buildRow>) {
  try {
    void fetch("/api/quote-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: row.full_name,
        email: row.email,
        whatsapp: row.whatsapp,
        startDate: row.start_date,
        travellers: row.travellers,
        note: row.note,
        routeName: row.route_name,
        cities: row.cities,
        totalDays: row.total_days,
        travelStyle: row.travel_style,
        estimatedTotal: row.estimated_total,
        currency: row.currency,
      }),
    }).catch(() => undefined);
  } catch {
    // Ignore — notification is a convenience, not part of the contract.
  }
}

export async function submitQuoteRequest(
  input: QuoteRequestInput,
  itinerary: GeneratedItinerary,
): Promise<QuoteRequestResult> {
  const row = buildRow(input, itinerary);

  notify(row);

  if (!supabase) {
    stashLocally(row);
    return { ok: true, storedRemotely: false };
  }

  const { error } = await supabase.from("quote_requests").insert(row);

  if (error) {
    console.warn("Quote request not synced (kept locally):", error.message);
    stashLocally(row);
    return { ok: true, storedRemotely: false };
  }

  return { ok: true, storedRemotely: true };
}

// Remembers that this device already asked, so the panel can show a calmer
// "we're on it" state instead of inviting a duplicate submission.
const REQUESTED_KEY = "wanderroute_quote_requested_trips";

export function markRequested(tripId: string) {
  try {
    const raw = localStorage.getItem(REQUESTED_KEY);
    const ids = raw ? (JSON.parse(raw) as string[]) : [];
    if (!ids.includes(tripId)) ids.push(tripId);
    localStorage.setItem(REQUESTED_KEY, JSON.stringify(ids.slice(-40)));
  } catch {
    // Non-critical.
  }
}

export function hasRequested(tripId: string): boolean {
  try {
    const raw = localStorage.getItem(REQUESTED_KEY);
    if (!raw) return false;
    return (JSON.parse(raw) as string[]).includes(tripId);
  } catch {
    return false;
  }
}
