import type { GeneratedItinerary } from "../components/rl/types";

// Supabase is the source of truth. A browser copy is only a retry aid and is
// never evidence that WanderRoute received a request.
const PENDING_KEY = "wanderroute_pending_quote_requests";
const RECEIPTS_KEY = "wanderroute_quote_receipts_v2";

export type QuoteRequestInput = {
  fullName: string;
  email: string;
  whatsapp?: string;
  startDate?: string;
  travellers?: number;
  note?: string;
};

export type QuoteRequestResult =
  | { status: "RECEIVED" | "RECEIVED_NOTIFICATION_FAILED"; requestId: string }
  | { status: "LOCAL_BACKUP_ONLY" | "NOT_RECEIVED" };

type StoreError = { code?: string; message?: string; details?: string };
type QuoteRow = ReturnType<typeof buildRow>;

export type QuoteSubmissionDependencies = {
  insert: (row: QuoteRow) => Promise<{ error: StoreError | null }>;
  notify: (requestId: string) => Promise<boolean>;
  backup: (row: QuoteRow) => boolean;
  deviceId: () => string | null;
};

function buildRow(
  input: QuoteRequestInput,
  itinerary: GeneratedItinerary,
  requestId: string,
  deviceId: string | null,
) {
  return {
    id: requestId,
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
    device_id: deviceId,
    user_agent: typeof navigator === "undefined" ? null : navigator.userAgent.slice(0, 300),
  };
}

function stashLocally(row: QuoteRow): boolean {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(parsed) ? parsed : [];
    list.push({ ...row, stashed_at: new Date().toISOString() });
    localStorage.setItem(PENDING_KEY, JSON.stringify(list.slice(-20)));
    return true;
  } catch {
    return false;
  }
}

async function notify(requestId: string): Promise<boolean> {
  try {
    const response = await fetch("/api/quote-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    if (!response.ok) return false;
    const payload: unknown = await response.json();
    return !!payload && typeof payload === "object" && "emailed" in payload && payload.emailed === true;
  } catch {
    return false;
  }
}

function isExistingRequest(error: StoreError | null): boolean {
  return error?.code === "23505" &&
    /quote_requests_pkey/.test(`${error.message ?? ""} ${error.details ?? ""}`);
}

// Exported with dependencies so failure ordering can be tested without a live
// Supabase project or a real notification endpoint.
export async function submitQuoteRequestWithDependencies(
  input: QuoteRequestInput,
  itinerary: GeneratedItinerary,
  requestId: string,
  deps: QuoteSubmissionDependencies,
): Promise<QuoteRequestResult> {
  let deviceId: string | null = null;
  try { deviceId = deps.deviceId(); } catch { /* Browser storage may be disabled. */ }
  const row = buildRow(input, itinerary, requestId, deviceId);

  let storageError: StoreError | null = null;
  try {
    const result = await deps.insert(row);
    storageError = result.error;
  } catch {
    storageError = { code: "NETWORK_ERROR" };
  }

  if (storageError && !isExistingRequest(storageError)) {
    console.warn("Quote request storage failed", { requestId, category: storageError.code ?? "UNKNOWN" });
    let backedUp = false;
    try { backedUp = deps.backup(row); } catch { /* Browser storage may be disabled. */ }
    return { status: backedUp ? "LOCAL_BACKUP_ONLY" : "NOT_RECEIVED" };
  }

  let emailed = false;
  try { emailed = await deps.notify(requestId); } catch { /* Receipt remains valid. */ }
  if (!emailed) {
    console.warn("Quote request notification failed", { requestId });
    return { status: "RECEIVED_NOTIFICATION_FAILED", requestId };
  }
  return { status: "RECEIVED", requestId };
}

export async function submitQuoteRequest(
  input: QuoteRequestInput,
  itinerary: GeneratedItinerary,
  requestId: string,
): Promise<QuoteRequestResult> {
  const [{ supabase }, { getDeviceId }] = await Promise.all([
    import("./supabase"),
    import("./placesDb"),
  ]);
  return submitQuoteRequestWithDependencies(input, itinerary, requestId, {
    insert: async (row) => supabase
      ? supabase.from("quote_requests").insert(row)
      : { error: { code: "SUPABASE_UNAVAILABLE" } },
    notify,
    backup: stashLocally,
    deviceId: getDeviceId,
  });
}

export function wasQuoteReceived(result: QuoteRequestResult): result is Extract<QuoteRequestResult, { requestId: string }> {
  return result.status === "RECEIVED" || result.status === "RECEIVED_NOTIFICATION_FAILED";
}

// Only the new receipt marker is trusted. Legacy trip-only markers could have
// been written when a request existed solely in localStorage.
export function markRequested(tripId: string, requestId: string): void {
  try {
    const raw = localStorage.getItem(RECEIPTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const receipts: Array<{ tripId: string; requestId: string }> = Array.isArray(parsed) ? parsed : [];
    const next = receipts.filter((receipt) => receipt.tripId !== tripId);
    next.push({ tripId, requestId });
    localStorage.setItem(RECEIPTS_KEY, JSON.stringify(next.slice(-40)));
  } catch {
    // The current panel still shows the confirmed receipt; a future visit may retry.
  }
}

export function hasRequested(tripId: string): boolean {
  try {
    const raw = localStorage.getItem(RECEIPTS_KEY);
    if (!raw) return false;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.some((receipt) =>
      receipt?.tripId === tripId && typeof receipt?.requestId === "string",
    );
  } catch {
    return false;
  }
}
