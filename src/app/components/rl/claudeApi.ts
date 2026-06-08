import type { TripInputs, GeneratedItinerary } from "./types";
import { CURRENCY_SYMBOLS } from "./data";

// ─── Prompt Builder ───────────────────────────────────────────────────────────
function buildPrompt(inputs: TripInputs): string {
  const { budget, currency, days, people, startCity, interests, travelStyle } = inputs;
  const sym = CURRENCY_SYMBOLS[currency];

  return `You are RouteLanka, an expert Sri Lanka travel planner. Generate a detailed, realistic trip itinerary.

TRIP DETAILS:
- Budget: ${sym}${budget} ${currency} total (for ALL ${people} people, ALL ${days} days)
- Duration: ${days} days
- Travellers: ${people} person(s)
- Starting city: ${startCity}
- Interests: ${interests.join(", ")}
- Travel style: ${travelStyle} (budget=hostels/buses/street food, comfort=boutique hotels/mix dining, luxury=resorts/private transfers)

IMPORTANT RULES:
1. Costs must be realistic Sri Lanka 2024/2025 prices in ${currency}
2. Budget style: ~$30-55/person/day USD. Comfort: ~$85-170/person/day. Luxury: ~$250-500/person/day
3. Every day must include accommodation, meals, transport, and activities
4. Include hidden costs tourists often miss (entry fees, tuk-tuk tips, etc.)
5. Route must start from ${startCity} and flow logically across Sri Lanka
6. Interests (${interests.join(", ")}) must shape which destinations and activities are included

Respond ONLY with a valid JSON object. No markdown, no explanation, just the JSON.

JSON structure:
{
  "routeName": "string (creative route name)",
  "routeSlogan": "string (one inspiring line about this route)",
  "cities": ["array", "of", "city", "names", "in", "order"],
  "estimatedCostPerPerson": number (in ${currency}),
  "estimatedTotalCost": number (in ${currency}, = per person x ${people}),
  "budgetStatus": "great" | "ok" | "tight" | "over",
  "days": [
    {
      "day": 1,
      "city": "City Name",
      "flag": "emoji for this city vibe",
      "heroGradient": "linear-gradient(135deg, #hex1, #hex2)",
      "accommodation": "Specific hotel/hostel name or type",
      "accommodationCostPerNight": number,
      "dailyCostPerPerson": number,
      "localTip": "One genuine local insider tip for this city",
      "items": [
        {
          "time": "9:00 AM",
          "icon": "emoji",
          "label": "Short activity name",
          "detail": "1-2 sentence description with practical info",
          "cost": number (per person in ${currency}),
          "category": "transport" | "activity" | "meal" | "accommodation",
          "tip": "Optional money-saving tip",
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
  "globalTips": ["5 practical Sri Lanka travel tips for this trip"],
  "warnings": ["2-3 genuine warnings about this budget/route"],
  "highlights": ["3 must-not-miss highlights of this route"]
}`;
}

// ─── Gemini API Call ──────────────────────────────────────────────────────────
export async function generateItineraryWithAI(
  inputs: TripInputs
): Promise<GeneratedItinerary> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: buildPrompt(inputs) }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4000,
        responseMimeType: "application/json", // Forces Gemini to return pure JSON
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const data = await response.json();

  // Extract text from Gemini response structure
  const rawText: string =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  if (!rawText) throw new Error("Empty response from Gemini");

  // Strip any accidental markdown fences just in case
  const cleaned = rawText.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned);

  // Compute budget fields locally
  const remaining = inputs.budget - parsed.estimatedTotalCost;
  const budgetStatus: GeneratedItinerary["budgetStatus"] =
    remaining > inputs.budget * 0.2
      ? "great"
      : remaining > 0
      ? "ok"
      : remaining > -inputs.budget * 0.1
      ? "tight"
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
    budgetStatus,
    travelStyle: inputs.travelStyle,
    days: parsed.days,
    costBreakdown: parsed.costBreakdown,
    globalTips: parsed.globalTips,
    warnings: parsed.warnings,
    highlights: parsed.highlights,
  };
}
