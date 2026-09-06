// Netlify Function — notifies you the moment a traveller asks for a real quote.
//
// The request itself is already stored in Supabase by the browser. This exists
// only so you find out in minutes rather than whenever you next open the
// dashboard, because the promise on the page is a reply within 24 hours.
//
// Optional environment variables (Netlify → Site settings → Environment):
//   RESEND_API_KEY   — from resend.com, free tier is enough
//   QUOTE_ALERT_TO   — the address that should receive the alert
//   QUOTE_ALERT_FROM — a verified sender, e.g. "WanderRoute <onboarding@resend.dev>"
//
// With no key set the function still returns 200 and logs the request, so the
// traveller-facing flow never breaks. Check Netlify → Functions → Logs.

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const {
    fullName = "",
    email = "",
    whatsapp = "",
    startDate = "",
    travellers = "",
    note = "",
    routeName = "",
    cities = [],
    totalDays = "",
    travelStyle = "",
    estimatedTotal = "",
    currency = "",
  } = payload;

  const route = Array.isArray(cities) && cities.length ? cities.join(" → ") : routeName;

  const lines = [
    `Name:       ${fullName}`,
    `Email:      ${email}`,
    `WhatsApp:   ${whatsapp || "—"}`,
    `Arrival:    ${startDate || "—"}`,
    `Travellers: ${travellers || "—"}`,
    "",
    `Route:      ${route}`,
    `Days:       ${totalDays}`,
    `Style:      ${travelStyle}`,
    `Est. total: ${estimatedTotal} ${currency}`,
    "",
    `Note:       ${note || "—"}`,
    "",
    "Next: send the route to a partner driver, get an all-in price,",
    "reply within 24h with the price, inclusions, exclusions and licence number.",
  ].join("\n");

  console.log("[quote-request]\n" + lines);

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.QUOTE_ALERT_TO;
  const from = process.env.QUOTE_ALERT_FROM || "WanderRoute <onboarding@resend.dev>";

  if (!apiKey || !to) {
    // Logged above; nothing further to do without mail credentials.
    return { statusCode: 200, body: JSON.stringify({ ok: true, emailed: false }) };
  }

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email || undefined,
        subject: `Quote request — ${fullName || "traveller"} · ${totalDays} days · ${route}`,
        text: lines,
      }),
    });

    if (!resp.ok) {
      console.warn("[quote-request] Resend responded", resp.status, await resp.text());
      return { statusCode: 200, body: JSON.stringify({ ok: true, emailed: false }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, emailed: true }) };
  } catch (error) {
    console.warn("[quote-request] Email failed:", String(error));
    return { statusCode: 200, body: JSON.stringify({ ok: true, emailed: false }) };
  }
};
