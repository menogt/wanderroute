const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "openai/gpt-oss-120b";
const TIMEOUT_MS = 20_000;
const MAX_BODY_BYTES = 100_000;
const MAX_PLACES = 15;

function json(statusCode, payload) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
}

const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const shortText = (value, max = 160) => typeof value === "string" && value.length > 0 && value.length <= max;

function validateRequest(body) {
  if (!object(body) || body.schemaVersion !== 2 || !shortText(body.routeConceptId, 160) ||
      !Array.isArray(body.days) || body.days.length < 2 || body.days.length > 21 ||
      !Array.isArray(body.interests) || body.interests.length > 8 ||
      body.interests.some(value => !shortText(value, 40)) ||
      !["SLOW_TRAVEL", "RELAXED", "BALANCED", "PACKED", undefined].includes(body.pace)) return false;
  return body.days.every((day, index) => object(day) && day.day === index + 1 && shortText(day.city, 80) &&
    Array.isArray(day.places) && day.places.length <= MAX_PLACES &&
    day.places.every(place => object(place) && shortText(place.id, 160) && shortText(place.name, 160) &&
      ["attraction", "beach", "temple"].includes(place.category)) &&
    new Set(day.places.map(place => place.id)).size === day.places.length);
}

function validateModel(value, request) {
  if (!object(value) || value.schemaVersion !== 2 || value.routeConceptId !== request.routeConceptId ||
      !Array.isArray(value.days) || value.days.length !== request.days.length) return false;
  const paceLimit = { SLOW_TRAVEL: 1, RELAXED: 2, BALANCED: 2, PACKED: 3 }[request.pace ?? "BALANCED"];
  return value.days.every((day, index) => {
    const allowed = new Set(request.days[index].places.map(place => place.id));
    return object(day) && day.day === index + 1 && Array.isArray(day.placeIds) && day.placeIds.length <= paceLimit &&
      day.placeIds.every(id => typeof id === "string" && allowed.has(id)) &&
      new Set(day.placeIds).size === day.placeIds.length &&
      (day.note === undefined || typeof day.note === "string" && day.note.length <= 240) &&
      (day.descriptions === undefined || Array.isArray(day.descriptions) && day.descriptions.length <= 3 &&
        day.descriptions.every(description => object(description) && day.placeIds.includes(description.placeId) &&
          typeof description.text === "string" && description.text.length <= 240));
  });
}

function prompt(request) {
  return `Select activities for a Sri Lanka trip. You must use only place IDs listed for each day. The fixed route and days must not change. Do not invent opening hours, transport times, prices, bookings or availability. Do not schedule times. Keep notes and descriptions concise. Interests: ${request.interests.join(", ")}. Pace: ${request.pace ?? "BALANCED"}.\n` +
    JSON.stringify({ routeConceptId: request.routeConceptId, days: request.days }) +
    '\nReturn JSON only: {"schemaVersion":2,"routeConceptId":"same ID","days":[{"day":1,"placeIds":["allowed ID"],"note":"short note","descriptions":[{"placeId":"allowed ID","text":"why it fits"}]}]}. Include every day exactly once. Select zero to three IDs per day.';
}

export const handler = async event => {
  if (event.httpMethod !== "POST") return json(405, { code: "INVALID_INPUT", error: "POST required." });
  if (typeof event.body !== "string" || event.body.length > MAX_BODY_BYTES) {
    return json(400, { code: "INVALID_INPUT", error: "Request is missing or too large." });
  }
  let request;
  try { request = JSON.parse(event.body); }
  catch { return json(400, { code: "INVALID_INPUT", error: "Invalid JSON request." }); }
  if (!validateRequest(request)) return json(400, { code: "INVALID_INPUT", error: "Invalid route or candidate places." });
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) return json(500, { code: "SERVER_CONFIGURATION", error: "Itinerary service is not configured." });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response;
  try {
    response = await fetch(GROQ_URL, { method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: MODEL, temperature: 0.2, max_tokens: 3000, reasoning_effort: "low",
        response_format: { type: "json_object" }, messages: [
          { role: "system", content: "Return one valid JSON object using only supplied place IDs." },
          { role: "user", content: prompt(request) },
        ] }) });
  } catch (error) {
    return json(error?.name === "AbortError" ? 504 : 502,
      { code: error?.name === "AbortError" ? "GROQ_TIMEOUT" : "GROQ_API_ERROR", error: "Itinerary suggestions are unavailable." });
  } finally { clearTimeout(timeout); }
  if (!response.ok) return json(502, { code: "GROQ_API_ERROR", error: "Itinerary suggestions are unavailable." });
  let payload;
  try { payload = await response.json(); }
  catch { return json(502, { code: "MODEL_OUTPUT_INVALID", error: "The itinerary response was malformed." }); }
  let model;
  try { model = JSON.parse(payload?.choices?.[0]?.message?.content ?? ""); }
  catch { return json(502, { code: "MODEL_OUTPUT_INVALID", error: "The itinerary response was malformed." }); }
  if (!validateModel(model, request)) return json(502,
    { code: "MODEL_OUTPUT_INVALID", error: "The itinerary response used invalid days or places." });
  return json(200, { plan: model });
};
