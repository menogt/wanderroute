import type { TripInputs, GeneratedItinerary } from "./types";
import { CURRENCY_SYMBOLS } from "./data";

function buildPrompt(inputs: TripInputs): string {
  const { budget, currency, days, people, startCity, interests, travelStyle } = inputs;
  const sym = CURRENCY_SYMBOLS[currency];

  return `You are WanderRoute, an expert Sri Lanka travel planner. Generate a detailed, realistic trip itinerary.

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

export async function generateItineraryWithAI(
  inputs: TripInputs
): Promise<GeneratedItinerary> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY?.trim();

  if (!apiKey) throw new Error("VITE_GROQ_API_KEY is missing from your .env file");

  console.log("🔑 Groq key starts with:", apiKey.slice(0, 10));
  console.log("🤖 Calling Groq llama-3.3-70b...");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are WanderRoute, an expert Sri Lanka travel planner. Always respond with valid JSON only. No markdown, no explanation, no code blocks.",
        },
        {
          role: "user",
          content: buildPrompt(inputs),
        },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq error ${response.status}: ${err}`);
  }

  const data = await response.json();
  let rawText = data?.choices?.[0]?.message?.content ?? "";

  if (!rawText) throw new Error("Empty response from Groq");

  console.log("✅ Groq responded!");

  // Strip markdown fences if present
  rawText = rawText.replace(/```json|```/g, "").trim();

  const parsed = JSON.parse(rawText);
  const remaining = inputs.budget - parsed.estimatedTotalCost;
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
    budgetStatus,
    travelStyle: inputs.travelStyle,
    days: parsed.days,
    costBreakdown: parsed.costBreakdown,
    globalTips: parsed.globalTips,
    warnings: parsed.warnings,
    highlights: parsed.highlights,
  };
}