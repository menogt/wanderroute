const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";
const REQUEST_TIMEOUT_MS = 30000;

const CURRENCY_SYMBOLS = {
  USD: "$",
  EUR: "EUR",
  GBP: "GBP",
  AUD: "A$",
  LKR: "LKR",
};

const VALID_CURRENCIES = new Set(["USD", "EUR", "GBP", "AUD", "LKR"]);
const VALID_INTERESTS = new Set([
  "beaches",
  "culture",
  "wildlife",
  "hiking",
  "food",
  "temples",
  "adventure",
  "photography",
]);
const VALID_TRAVEL_STYLES = new Set(["budget", "comfort", "luxury"]);
const VALID_BUDGET_STATUS = new Set(["great", "ok", "tight", "over"]);
const VALID_CATEGORIES = new Set(["transport", "activity", "meal", "accommodation"]);

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function validateInputs(body) {
  if (!isObject(body)) return ["Request body must be a JSON object."];

  const required = [
    "budget",
    "currency",
    "days",
    "people",
    "startCity",
    "interests",
    "travelStyle",
  ];
  const errors = required
    .filter((field) => body[field] === undefined || body[field] === null)
    .map((field) => `${field} is required.`);

  if (body.budget !== undefined && (!isFiniteNumber(body.budget) || body.budget <= 0)) {
    errors.push("budget must be a positive number.");
  }
  if (body.currency !== undefined && !VALID_CURRENCIES.has(body.currency)) {
    errors.push("currency must be one of USD, EUR, GBP, AUD, or LKR.");
  }
  if (body.days !== undefined && (!Number.isInteger(body.days) || body.days < 1 || body.days > 30)) {
    errors.push("days must be an integer between 1 and 30.");
  }
  if (body.people !== undefined && (!Number.isInteger(body.people) || body.people < 1 || body.people > 30)) {
    errors.push("people must be an integer between 1 and 30.");
  }
  if (body.startCity !== undefined && (!isNonEmptyString(body.startCity) || body.startCity.length > 80)) {
    errors.push("startCity must be a non-empty string under 80 characters.");
  }
  if (body.interests !== undefined) {
    if (!Array.isArray(body.interests) || body.interests.length === 0) {
      errors.push("interests must be a non-empty array.");
    } else if (
      body.interests.some((interest) => !isNonEmptyString(interest) || !VALID_INTERESTS.has(interest))
    ) {
      errors.push("interests contains an unsupported value.");
    }
  }
  if (body.travelStyle !== undefined && !VALID_TRAVEL_STYLES.has(body.travelStyle)) {
    errors.push("travelStyle must be budget, comfort, or luxury.");
  }
  // realPlaces is optional — only validate type if present
  if (body.realPlaces !== undefined && typeof body.realPlaces !== "string") {
    errors.push("realPlaces must be a string.");
  }

  return errors;
}

function sanitizeInputs(body) {
  return {
    budget: body.budget,
    currency: body.currency,
    days: body.days,
    people: body.people,
    startCity: body.startCity.trim(),
    interests: body.interests.map((interest) => interest.trim()),
    travelStyle: body.travelStyle,
    realPlaces: typeof body.realPlaces === "string" ? body.realPlaces : "",
  };
}

function buildPrompt(inputs) {
  const { budget, currency, days, people, startCity, interests, travelStyle } = inputs;
  const sym = CURRENCY_SYMBOLS[currency];

  const realPlacesBlock = inputs.realPlaces && inputs.realPlaces.trim()
    ? `\n\nAVAILABLE REAL PLACES (use these EXACT names — they are verified real places in our database):\n${inputs.realPlaces}\n\nCRITICAL: For accommodation, dining and activities, you MUST use places from the list above wherever one fits. Keep their exact names so they match our map pins. Only invent a place if the list has nothing suitable for a given need.`
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

function stripMarkdownFences(text) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseAiJson(rawText) {
  if (!isNonEmptyString(rawText)) {
    throw new Error("AI returned an empty response.");
  }

  try {
    return JSON.parse(stripMarkdownFences(rawText));
  } catch {
    throw new Error("AI returned malformed JSON.");
  }
}

function validateDayItem(item, path) {
  const errors = [];
  if (!isObject(item)) return [`${path} must be an object.`];
  if (!isNonEmptyString(item.time)) errors.push(`${path}.time must be a non-empty string.`);
  if (!isNonEmptyString(item.icon)) errors.push(`${path}.icon must be a non-empty string.`);
  if (!isNonEmptyString(item.label)) errors.push(`${path}.label must be a non-empty string.`);
  if (!isNonEmptyString(item.detail)) errors.push(`${path}.detail must be a non-empty string.`);
  if (!isFiniteNumber(item.cost)) errors.push(`${path}.cost must be a number.`);
  if (!VALID_CATEGORIES.has(item.category)) errors.push(`${path}.category is invalid.`);
  return errors;
}

function validateDay(day, index) {
  const path = `days[${index}]`;
  const errors = [];
  if (!isObject(day)) return [`${path} must be an object.`];
  if (!Number.isInteger(day.day)) errors.push(`${path}.day must be an integer.`);
  if (!isNonEmptyString(day.city)) errors.push(`${path}.city must be a non-empty string.`);
  if (!isNonEmptyString(day.flag)) errors.push(`${path}.flag must be a non-empty string.`);
  if (!isNonEmptyString(day.heroGradient)) errors.push(`${path}.heroGradient must be a non-empty string.`);
  if (!isNonEmptyString(day.accommodation)) errors.push(`${path}.accommodation must be a non-empty string.`);
  if (!isFiniteNumber(day.accommodationCostPerNight)) {
    errors.push(`${path}.accommodationCostPerNight must be a number.`);
  }
  if (!isFiniteNumber(day.dailyCostPerPerson)) errors.push(`${path}.dailyCostPerPerson must be a number.`);
  if (!isNonEmptyString(day.localTip)) errors.push(`${path}.localTip must be a non-empty string.`);
  if (!Array.isArray(day.items) || day.items.length === 0) {
    errors.push(`${path}.items must be a non-empty array.`);
  } else {
    day.items.forEach((item, itemIndex) => {
      errors.push(...validateDayItem(item, `${path}.items[${itemIndex}]`));
    });
  }
  return errors;
}

function validateCostBreakdown(costBreakdown) {
  const errors = [];
  const fields = ["hotels", "food", "transport", "activities", "entryFees", "misc"];
  if (!isObject(costBreakdown)) return ["costBreakdown must be an object."];
  fields.forEach((field) => {
    if (!isFiniteNumber(costBreakdown[field])) errors.push(`costBreakdown.${field} must be a number.`);
  });
  return errors;
}

function validateAiItinerary(parsed) {
  const errors = [];
  if (!isObject(parsed)) return ["AI response must be a JSON object."];
  if (!isNonEmptyString(parsed.routeName)) errors.push("routeName must be a non-empty string.");
  if (!isNonEmptyString(parsed.routeSlogan)) errors.push("routeSlogan must be a non-empty string.");
  if (!Array.isArray(parsed.cities) || parsed.cities.length === 0 || parsed.cities.some((city) => !isNonEmptyString(city))) {
    errors.push("cities must be a non-empty string array.");
  }
  if (!isFiniteNumber(parsed.estimatedCostPerPerson)) {
    errors.push("estimatedCostPerPerson must be a number.");
  }
  if (!isFiniteNumber(parsed.estimatedTotalCost)) {
    errors.push("estimatedTotalCost must be a number.");
  }
  if (parsed.budgetStatus !== undefined && !VALID_BUDGET_STATUS.has(parsed.budgetStatus)) {
    errors.push("budgetStatus is invalid.");
  }
  if (!Array.isArray(parsed.days) || parsed.days.length === 0) {
    errors.push("days must be a non-empty array.");
  } else {
    parsed.days.forEach((day, index) => errors.push(...validateDay(day, index)));
  }
  errors.push(...validateCostBreakdown(parsed.costBreakdown));
  ["globalTips", "warnings", "highlights"].forEach((field) => {
    if (!Array.isArray(parsed[field]) || parsed[field].some((value) => !isNonEmptyString(value))) {
      errors.push(`${field} must be an array of strings.`);
    }
  });
  return errors;
}

function buildGeneratedItinerary(parsed, inputs) {
  const remaining = inputs.budget - parsed.estimatedTotalCost;
  const budgetStatus =
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

function validateGeneratedItinerary(itinerary) {
  const errors = validateAiItinerary(itinerary);
  if (!isNonEmptyString(itinerary.id)) errors.push("id must be a non-empty string.");
  if (!isNonEmptyString(itinerary.routeKey)) errors.push("routeKey must be a non-empty string.");
  if (!Number.isInteger(itinerary.totalDays)) errors.push("totalDays must be an integer.");
  if (!Number.isInteger(itinerary.totalPeople)) errors.push("totalPeople must be an integer.");
  if (!VALID_CURRENCIES.has(itinerary.currency)) errors.push("currency is invalid.");
  if (!isFiniteNumber(itinerary.inputBudget)) errors.push("inputBudget must be a number.");
  if (!isFiniteNumber(itinerary.remainingBudget)) errors.push("remainingBudget must be a number.");
  if (!VALID_TRAVEL_STYLES.has(itinerary.travelStyle)) errors.push("travelStyle is invalid.");
  return errors;
}

async function callGroq(apiKey, inputs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are WanderRoute, an expert Sri Lanka travel planner. Always respond with one valid JSON object only. No markdown, no explanation, no code blocks.",
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

    const responseText = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: `Groq request failed with status ${response.status}.`,
      };
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error("Groq returned an invalid API response.");
    }

    return {
      ok: true,
      content: data?.choices?.[0]?.message?.content ?? "",
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      return { ok: false, status: 504, message: "Groq request timed out." };
    }
    return { ok: false, status: 502, message: "Groq request failed." };
  } finally {
    clearTimeout(timeout);
  }
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed. Use POST." });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON request body." });
  }

  const inputErrors = validateInputs(body);
  if (inputErrors.length > 0) {
    return json(400, { error: "Invalid trip input.", details: inputErrors });
  }

  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    return json(500, { error: "Groq API key is not configured." });
  }

  const inputs = sanitizeInputs(body);
  const groqResult = await callGroq(apiKey, inputs);
  if (!groqResult.ok) {
    return json(groqResult.status || 502, { error: groqResult.message });
  }

  let parsed;
  try {
    parsed = parseAiJson(groqResult.content);
  } catch (error) {
    return json(502, { error: error.message });
  }

  const aiErrors = validateAiItinerary(parsed);
  if (aiErrors.length > 0) {
    return json(502, { error: "AI itinerary response was incomplete.", details: aiErrors });
  }

  const itinerary = buildGeneratedItinerary(parsed, inputs);
  const itineraryErrors = validateGeneratedItinerary(itinerary);
  if (itineraryErrors.length > 0) {
    return json(502, { error: "Generated itinerary failed validation.", details: itineraryErrors });
  }

  return json(200, { itinerary });
};
