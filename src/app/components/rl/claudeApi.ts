// Direct Groq API integration — calls Groq from the browser using
// VITE_GROQ_API_KEY so AI generation works in local dev and on Netlify
// without requiring the /api/generate-itinerary Netlify function.

import type { GeneratedItinerary, TripInputs } from "./types";
import { fetchPlacesForPrompt } from "../../lib/itineraryPlaces";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";
const TIMEOUT_MS = 30000;

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", AUD: "A$", LKR: "LKR",
};

function buildPrompt(inputs: TripInputs, placesText = ""): string {
  const { budget, currency, days, people, startCity, interests, travelStyle } = inputs;
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
- Starting city: ${startCity}
- Interests: ${interests.join(", ")}
- Travel style: ${travelStyle} (budget=hostels/buses/street food, comfort=boutique hotels/mix dining, luxury=resorts/private transfers)${realPlacesBlock}

IMPORTANT RULES:
1. Costs must be realistic Sri Lanka 2024/2025 prices in ${currency}
2. Budget style: ~$30-55/person/day USD. Comfort: ~$85-170/person/day. Luxury: ~$250-500/person/day
3. Every day must include accommodation, meals, transport, and activities
4. Include hidden costs tourists often miss (entry fees, tuk-tuk tips, etc.)
5. Route must start from ${startCity} and flow logically across Sri Lanka
6. Interests (${interests.join(", ")}) must shape which destinations and activities are included

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

export async function generateItineraryWithAI(
  inputs: TripInputs
): Promise<GeneratedItinerary> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error("VITE_GROQ_API_KEY is not set.");

  // Fetch real places from Supabase BEFORE building the prompt. Non-fatal: if it
  // fails (offline, no creds), we ground on general knowledge instead.
  let placesText = "";
  try {
    const result = await fetchPlacesForPrompt(inputs.startCity, inputs.days, inputs.travelStyle);
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
        temperature: 0.7,
        max_tokens: 4000,
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

  let parsed: any;
  try { parsed = JSON.parse(stripFences(content)); } catch { throw new Error("AI returned malformed JSON."); }

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
    days: parsed.days,
    costBreakdown: parsed.costBreakdown,
    globalTips: parsed.globalTips ?? [],
    warnings: parsed.warnings ?? [],
    highlights: parsed.highlights ?? [],
  };
}
