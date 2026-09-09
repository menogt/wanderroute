// Direct Groq API integration — calls Groq from the browser using
// VITE_GROQ_API_KEY so AI generation works in local dev and on Netlify
// without requiring the /api/generate-itinerary Netlify function.

import type { GeneratedItinerary, TripInputs } from "./types";
import { fetchPlacesForPrompt } from "../../lib/itineraryPlaces";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "openai/gpt-oss-120b";
const TIMEOUT_MS = 30000;

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", AUD: "A$", LKR: "LKR",
};

function buildPrompt(inputs: TripInputs, placesText = ""): string {
  const { budget, currency, days, people, cities, interests, travelStyle } = inputs;
  const sym = CURRENCY_SYMBOLS[currency] ?? currency;

  // Inject the real Supabase places so the AI builds the trip around hotels /
  // attractions that actually exist (and whose names match our map pins).
  const realPlacesBlock = placesText && placesText.trim()
    ? `\n\nAVAILABLE REAL PLACES (use these EXACT names — they are verified real places in our database):\n${placesText}\n\nCRITICAL: For accommodation, dining and activities, you MUST use places from the list above wherever one fits. Keep their exact names so they match our map pins. Only invent a place if the list has nothing suitable for a given need.`
    : "";

  return `You are WanderRoute, an expert Sri Lanka travel planner. Generate a detailed, realistic trip itinerary.

TRIP DETAILS:
- Budget: ${sym}${budget} ${currency} total (for ALL ${people} people, ALL ${days} days)
- Duration: ${days} days
- Travellers: ${people} person(s)
- Cities to visit, in this exact order: ${cities.join(" → ")}
- Interests: ${interests.join(", ")}
- Travel style: ${travelStyle} (budget=hostels/buses/street food, comfort=boutique hotels/mix dining, luxury=resorts/private transfers)${realPlacesBlock}

IMPORTANT RULES:
1. Costs must be realistic Sri Lanka 2024/2025 prices in ${currency}
2. Budget style: ~$30-55/person/day USD. Comfort: ~$85-170/person/day. Luxury: ~$250-500/person/day
3. Every day must include accommodation, meals, transport, and activities, with at least 4 entries in its "items" array
4. Include hidden costs tourists often miss (entry fees, tuk-tuk tips, etc.)
5. Visit the listed cities in the given order, allocating days proportionally across them; the trip starts and ends near Bandaranaike airport
6. Interests (${interests.join(", ")}) must shape which destinations and activities are included
7. Keep each item's "detail" and "tip" fields concise (one short sentence each) — this keeps the response compact enough to complete for longer trips
8. The "days" array MUST contain exactly ${days} entries, numbered "day": 1 through ${days}. Never merge, skip, or drop a day
9. Every item's "category" MUST be exactly one of "transport", "activity", "meal", "accommodation". Use "meal" for any food, "accommodation" for check-in or stays, "transport" for any travel, and "activity" for everything else

Respond ONLY with a valid JSON object. No markdown, no explanation, just raw JSON.

{
  "routeName": "string",
  "routeSlogan": "string",
  "cities": ["city1", "city2"],
  "estimatedCostPerPerson": number,
  "estimatedTotalCost": number,
  "budgetStatus": "great" | "ok" | "tight" | "over",
  "days": [
    {
      "day": 1,
      "city": "string",
      "flag": "emoji",
      "heroGradient": "linear-gradient(135deg, #hex1, #hex2)",
      "accommodation": "string",
      "accommodationCostPerNight": number,
      "dailyCostPerPerson": number,
      "localTip": "string",
      "items": [
        {
          "time": "9:00 AM",
          "icon": "emoji",
          "label": "string",
          "detail": "string",
          "cost": number,
          "category": "transport" | "activity" | "meal" | "accommodation",
          "tip": "string",
          "isHidden": false
        }
      ]
    }
  ],
  "costBreakdown": {
    "hotels": number,
    "food": number,
    "transport": number,
    "activities": number,
    "entryFees": number,
    "misc": number
  },
  "globalTips": ["tip1", "tip2", "tip3", "tip4", "tip5"],
  "warnings": ["warning1", "warning2"],
  "highlights": ["highlight1", "highlight2", "highlight3"]
}`;
}

function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

const VALID_CATEGORIES = new Set(["transport", "activity", "meal", "accommodation"]);

// The UI looks up icon/colour by category with no fallback, so an unexpected
// value from the model would crash the itinerary screen. Map synonyms onto the
// four supported categories and default anything else to "activity".
function normalizeCategory(value: unknown): GeneratedItinerary["days"][number]["items"][number]["category"] {
  const raw = String(value ?? "").trim().toLowerCase();
  if (VALID_CATEGORIES.has(raw)) return raw as "transport" | "activity" | "meal" | "accommodation";
  if (/(meal|food|dining|restaurant|breakfast|lunch|dinner|snack|cafe|drink)/.test(raw)) return "meal";
  if (/(accommodation|hotel|stay|lodg|check-?in|check-?out|resort|guesthouse|hostel|villa)/.test(raw)) return "accommodation";
  if (/(transport|transfer|travel|train|bus|taxi|tuk|flight|drive|car|ferry|boat ride|commute)/.test(raw)) return "transport";
  return "activity";
}

export async function generateItineraryWithAI(
  inputs: TripInputs
): Promise<GeneratedItinerary> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error("VITE_GROQ_API_KEY is not set.");

  // Fetch real places from Supabase BEFORE building the prompt. Non-fatal: if it
  // fails (offline, no creds), we ground on general knowledge instead.
  let placesText = "";
  try {
    const result = await fetchPlacesForPrompt(inputs.cities, inputs.travelStyle);
    placesText = result.placesText;
  } catch (err) {
    console.warn("Could not fetch real places, AI will use general knowledge:", err);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let responseText: string;
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are WanderRoute, an expert Sri Lanka travel planner. Always respond with one valid JSON object only. No markdown, no explanation, no code blocks.",
          },
          { role: "user", content: buildPrompt(inputs, placesText) },
        ],
        // Lower temperature keeps the model closer to the required schema.
        temperature: 0.4,
        // Raised from 4000 — longer trips (7-10+ days) need more room to finish
        // the full JSON object. At 4000 the model was getting cut off mid-object
        // on longer itineraries, producing truncated (and therefore unparsable) JSON.
        max_tokens: 8000,
        reasoning_effort: "low",
        // Groq validates the output is a single JSON object, so we never get
        // markdown fences, prose, or syntax slips from the model.
        response_format: { type: "json_object" },
      }),
    });

    responseText = await res.text();
    if (!res.ok) throw new Error(`Groq error ${res.status}: ${responseText.slice(0, 120)}`);
  } catch (err: any) {
    if (err?.name === "AbortError") throw new Error("Groq request timed out after 30 s.");
    throw err;
  } finally {
    clearTimeout(timer);
  }

  let data: any;
  try { data = JSON.parse(responseText); } catch { throw new Error("Groq returned invalid JSON."); }

  const content: string = data?.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("Groq returned an empty response.");

  const finishReason = data?.choices?.[0]?.finish_reason;
  if (finishReason === "length") {
    console.warn(
      "Groq response was cut off by the token limit (finish_reason: 'length'). " +
      "The itinerary is likely truncated. Consider raising max_tokens further or " +
      "reducing trip length/detail."
    );
  }

  let parsed: any;
  try {
    parsed = JSON.parse(stripFences(content));
  } catch (err) {
    // Log the raw content so a failure is diagnosable immediately instead of
    // silently falling back to the static itinerary with no visibility into why.
    console.error("AI content that failed to parse as JSON:", content);
    console.error("Parse error:", err);
    throw new Error("AI returned malformed JSON.");
  }

  if (!Array.isArray(parsed.days) || parsed.days.length !== inputs.days) {
    throw new Error(`AI returned ${Array.isArray(parsed.days) ? parsed.days.length : 0} days for a ${inputs.days}-day trip.`);
  }

  const remaining = inputs.budget - (parsed.estimatedTotalCost ?? 0);
  const budgetStatus: GeneratedItinerary["budgetStatus"] =
    remaining > inputs.budget * 0.2 ? "great"
    : remaining > 0 ? "ok"
    : remaining > -inputs.budget * 0.1 ? "tight"
    : "over";

  return {
    id: `rl-${Date.now()}`,
    routeName: parsed.routeName,
    routeSlogan: parsed.routeSlogan,
    routeKey: "ai-generated",
    cities: parsed.cities,
    totalDays: inputs.days,
    totalPeople: inputs.people,
    currency: inputs.currency,
    estimatedCostPerPerson: parsed.estimatedCostPerPerson,
    estimatedTotalCost: parsed.estimatedTotalCost,
    inputBudget: inputs.budget,
    remainingBudget: remaining,
    budgetStatus: parsed.budgetStatus ?? budgetStatus,
    travelStyle: inputs.travelStyle,
    days: parsed.days.map((day: any) => ({
      ...day,
      items: (Array.isArray(day.items) ? day.items : []).map((item: any) => ({
        ...item,
        category: normalizeCategory(item.category),
      })),
    })),
    costBreakdown: parsed.costBreakdown,
    globalTips: parsed.globalTips ?? [],
    warnings: parsed.warnings ?? [],
    highlights: parsed.highlights ?? [],
  };
}