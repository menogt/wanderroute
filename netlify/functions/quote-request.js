// Notification is secondary to the quote_requests row. Look up the receipt
// with a server-only key so an arbitrary browser payload cannot trigger an
// operator email for a request that was never stored.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const QUOTE_COLUMNS = [
  "id", "full_name", "email", "whatsapp", "start_date", "travellers", "note",
  "route_name", "cities", "total_days", "travel_style", "estimated_total", "currency",
].join(",");

function json(statusCode, payload) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { emailed: false, code: "METHOD_NOT_ALLOWED" });

  let payload;
  try { payload = JSON.parse(event.body || "{}"); }
  catch { return json(400, { emailed: false, code: "INVALID_INPUT" }); }
  const requestId = payload?.requestId;
  if (typeof requestId !== "string" || !UUID_RE.test(requestId)) {
    return json(400, { emailed: false, code: "INVALID_INPUT" });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serverKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serverKey) {
    console.warn("[quote-request] notification unavailable", { requestId, category: "STORAGE_LOOKUP_CONFIG" });
    return json(503, { emailed: false, code: "STORAGE_LOOKUP_CONFIG" });
  }

  let quote;
  try {
    const url = new URL(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/quote_requests`);
    url.searchParams.set("id", `eq.${requestId}`);
    url.searchParams.set("select", QUOTE_COLUMNS);
    const headers = { apikey: serverKey };
    // Legacy service-role keys are JWTs; new sb_secret_ keys are not.
    if (!serverKey.startsWith("sb_secret_")) headers.Authorization = `Bearer ${serverKey}`;
    const response = await fetch(url, {
      headers,
    });
    if (!response.ok) {
      console.warn("[quote-request] storage lookup failed", { requestId, status: response.status });
      return json(502, { emailed: false, code: "STORAGE_LOOKUP_FAILED" });
    }
    const rows = await response.json();
    quote = Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
  } catch {
    console.warn("[quote-request] storage lookup failed", { requestId, category: "NETWORK_OR_RESPONSE" });
    return json(502, { emailed: false, code: "STORAGE_LOOKUP_FAILED" });
  }
  if (quote?.id !== requestId) {
    console.warn("[quote-request] receipt not found", { requestId });
    return json(404, { emailed: false, code: "REQUEST_NOT_FOUND" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.QUOTE_ALERT_TO;
  const from = process.env.QUOTE_ALERT_FROM || "WanderRoute <onboarding@resend.dev>";
  if (!apiKey || !to) {
    console.warn("[quote-request] notification unavailable", { requestId, category: "EMAIL_CONFIG" });
    return json(200, { emailed: false, code: "EMAIL_CONFIG" });
  }

  const route = Array.isArray(quote.cities) && quote.cities.length
    ? quote.cities.join(" → ") : quote.route_name;
  const lines = [
    `Receipt:    ${requestId}`,
    `Name:       ${quote.full_name}`,
    `Email:      ${quote.email}`,
    `WhatsApp:   ${quote.whatsapp || "—"}`,
    `Arrival:    ${quote.start_date || "—"}`,
    `Travellers: ${quote.travellers || "—"}`,
    "",
    `Route:      ${route}`,
    `Days:       ${quote.total_days}`,
    `Style:      ${quote.travel_style}`,
    `Est. total: ${quote.estimated_total} ${quote.currency}`,
    "",
    `Note:       ${quote.note || "—"}`,
  ].join("\n");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from, to: [to], reply_to: quote.email || undefined,
        subject: `Quote request ${requestId} · ${quote.total_days} days`,
        text: lines,
      }),
    });
    if (!response.ok) {
      console.warn("[quote-request] email failed", { requestId, status: response.status });
      return json(200, { emailed: false, code: "EMAIL_FAILED" });
    }
    console.info("[quote-request] email sent", { requestId });
    return json(200, { emailed: true });
  } catch {
    console.warn("[quote-request] email failed", { requestId, category: "NETWORK_ERROR" });
    return json(200, { emailed: false, code: "EMAIL_FAILED" });
  }
};
