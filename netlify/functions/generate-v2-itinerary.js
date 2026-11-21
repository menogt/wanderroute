const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openai/gpt-oss-120b";
const FALLBACK_MODEL = "openai/gpt-oss-20b";
// The browser gives up after 25 s; finish every provider attempt inside that.
const DEADLINE_MS = 22_000;
const FIRST_PROVIDER_TIMEOUT_MS = 14_000;
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
  const used = new Set();
  return value.days.every((day, index) => {
    const allowed = new Set(request.days[index].places.map(place => place.id));
    const valid = object(day) && day.day === index + 1 && Array.isArray(day.placeIds) && day.placeIds.length <= paceLimit &&
      day.placeIds.every(id => typeof id === "string" && allowed.has(id) && !used.has(id)) &&
      new Set(day.placeIds).size === day.placeIds.length &&
      (day.note === undefined || typeof day.note === "string" && day.note.length <= 240) &&
      (day.descriptions === undefined || Array.isArray(day.descriptions) && day.descriptions.length <= 3 &&
        day.descriptions.every(description => object(description) && day.placeIds.includes(description.placeId) &&
          typeof description.text === "string" && description.text.length <= 240));
    if (valid) day.placeIds.forEach(id => used.add(id));
    return valid;
  });
}

const clip = (text, max = 240) => text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

/**
 * Keeps the usable part of a model reply instead of discarding it for one slip: drops unknown,
 * repeated or surplus place IDs, clips long text and fills missing days with open time.
 * Returns null when too little is left to be worth showing, so the next provider can try.
 */
function repairModel(value, request) {
  if (!object(value) || !Array.isArray(value.days)) return null;
  const perDay = { SLOW_TRAVEL: 1, RELAXED: 2, BALANCED: 2, PACKED: 3 }[request.pace ?? "BALANCED"];
  const sameLength = value.days.length === request.days.length;
  const used = new Set();
  let repairs = 0, missing = 0, kept = 0;
  const days = request.days.map((requested, index) => {
    const found = value.days.find(day => object(day) && day.day === index + 1) ?? (sameLength && object(value.days[index]) ? value.days[index] : undefined);
    if (!found) { missing++; repairs++; return { day: index + 1, placeIds: [] }; }
    const allowed = new Set(requested.places.map(place => place.id));
    const raw = Array.isArray(found.placeIds) ? found.placeIds : [];
    const placeIds = [];
    for (const id of raw) {
      if (typeof id === "string" && allowed.has(id) && !used.has(id) && placeIds.length < perDay) { placeIds.push(id); used.add(id); }
    }
    repairs += raw.length - placeIds.length; kept += placeIds.length;
    const day = { day: index + 1, placeIds };
    if (typeof found.note === "string" && found.note.trim()) { day.note = clip(found.note.trim()); if (day.note !== found.note.trim()) repairs++; }
    if (Array.isArray(found.descriptions)) {
      const described = new Set();
      day.descriptions = found.descriptions.filter(item => object(item) && typeof item.text === "string" && item.text.trim() &&
        placeIds.includes(item.placeId) && !described.has(item.placeId) && described.add(item.placeId))
        .slice(0, 3).map(item => ({ placeId: item.placeId, text: clip(item.text.trim()) }));
      repairs += found.descriptions.length - day.descriptions.length;
    }
    return day;
  });
  const offered = request.days.some(day => day.places.length);
  if (missing * 2 > request.days.length || (offered && kept === 0)) return null;
  return { plan: { schemaVersion: 2, routeConceptId: request.routeConceptId, days }, repairs };
}

function prompt(request) {
  // Must match the per-day limit enforced by validateModel and the client.
  const perDay = { SLOW_TRAVEL: 1, RELAXED: 2, BALANCED: 2, PACKED: 3 }[request.pace ?? "BALANCED"];
  return `Select activities for a Sri Lanka trip. You must use only place IDs listed for each day. The fixed route and days must not change. Do not invent opening hours, transport times, prices, bookings or availability. Do not schedule times. Keep notes and descriptions concise. Interests: ${request.interests.join(", ")}. Pace: ${request.pace ?? "BALANCED"}.\n` +
    JSON.stringify({ routeConceptId: request.routeConceptId, days: request.days }) +
    `\nReturn JSON only: {"schemaVersion":2,"routeConceptId":"same ID","days":[{"day":1,"placeIds":["allowed ID"],"note":"short note","descriptions":[{"placeId":"allowed ID","text":"why it fits"}]}]}. Include every day exactly once. Never repeat a place on another day; leave open time when unique options run out. Select zero to ${perDay} IDs per day, never more.`;
}

/**
 * Groq first (free tier). Groq rate limits are per model, so a second Groq model absorbs bursts
 * (several people generating in the same minute) at no cost. Set GROQ_FALLBACK_MODEL=none to disable.
 * OpenRouter is an optional paid fallback, used only when OPENROUTER_API_KEY is set.
 */
function providers() {
  const list = [];
  const groq = process.env.GROQ_API_KEY?.trim();
  if (groq) list.push({ name: "groq", url: GROQ_URL, key: groq,
    extra: { model: MODEL, reasoning_effort: "low" }, errorCode: "GROQ_API_ERROR", timeoutCode: "GROQ_TIMEOUT" });
  const backup = process.env.GROQ_FALLBACK_MODEL?.trim() || FALLBACK_MODEL;
  if (groq && backup !== "none" && backup !== MODEL) list.push({ name: `groq:${backup}`, url: GROQ_URL, key: groq,
    extra: { model: backup, reasoning_effort: "low" }, errorCode: "GROQ_API_ERROR", timeoutCode: "GROQ_TIMEOUT" });
  const openrouter = process.env.OPENROUTER_API_KEY?.trim();
  if (openrouter) list.push({ name: "openrouter", url: OPENROUTER_URL, key: openrouter,
    extra: { model: process.env.OPENROUTER_MODEL?.trim() || MODEL, reasoning: { effort: "low" },
      provider: { sort: "throughput", require_parameters: true } },
    headers: { "X-Title": "WanderRoute" }, errorCode: "AI_PROVIDER_ERROR", timeoutCode: "AI_PROVIDER_TIMEOUT" });
  return list;
}

const unavailable = { error: "Itinerary suggestions are unavailable." };

async function attempt(provider, request, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(provider.url, { method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.key}`, ...(provider.headers ?? {}) },
      body: JSON.stringify({ ...provider.extra, temperature: 0.2, max_tokens: 3000,
        response_format: { type: "json_object" }, messages: [
          { role: "system", content: "Return one valid JSON object using only supplied place IDs." },
          { role: "user", content: prompt(request) },
        ] }) });
  } catch (error) {
    return error?.name === "AbortError"
      ? { status: 504, payload: { code: provider.timeoutCode, ...unavailable } }
      : { status: 502, payload: { code: provider.errorCode, ...unavailable } };
  } finally { clearTimeout(timeout); }
  if (!response.ok) return { status: 502, payload: { code: provider.errorCode, ...unavailable }, upstream: response.status };
  let payload;
  try { payload = await response.json(); }
  catch { return { status: 502, payload: { code: "MODEL_OUTPUT_INVALID", error: "The itinerary response was malformed." } }; }
  let model;
  try { model = JSON.parse(payload?.choices?.[0]?.message?.content ?? ""); }
  catch { return { status: 502, payload: { code: "MODEL_OUTPUT_INVALID", error: "The itinerary response was malformed." } }; }
  const repaired = repairModel(model, request);
  if (!repaired || !validateModel(repaired.plan, request)) return { status: 502,
    payload: { code: "MODEL_OUTPUT_INVALID", error: "The itinerary response used invalid days or places." } };
  if (repaired.repairs) console.info("[generate-v2] repaired model reply", { provider: provider.name, repairs: repaired.repairs });
  return { status: 200, payload: { plan: repaired.plan } };
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
  const list = providers();
  if (!list.length) return json(500, { code: "SERVER_CONFIGURATION", error: "Itinerary service is not configured." });
  const started = Date.now();
  let result;
  for (const [index, provider] of list.entries()) {
    const remaining = DEADLINE_MS - (Date.now() - started);
    if (remaining < 3_000) break;
    const isLast = index === list.length - 1;
    result = await attempt(provider, request, isLast ? remaining : Math.min(FIRST_PROVIDER_TIMEOUT_MS, remaining));
    if (result.status === 200) {
      if (index > 0) console.info("[generate-v2] served by fallback", { provider: provider.name });
      break;
    }
    console.warn("[generate-v2] provider failed", { provider: provider.name, code: result.payload.code,
      ...(result.upstream ? { upstream: result.upstream } : {}) });
  }
  return json(result?.status ?? 504, result?.payload ?? { code: "GROQ_TIMEOUT", ...unavailable });
};
