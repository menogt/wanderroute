import type { GeneratedItinerary, TripInputs } from "./types";
import { fetchPlacesForPrompt } from "../../lib/itineraryPlaces";

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isGeneratedItinerary(value: unknown): value is GeneratedItinerary {
  if (!isObject(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.routeName === "string" &&
    typeof value.routeSlogan === "string" &&
    typeof value.routeKey === "string" &&
    Array.isArray(value.cities) &&
    typeof value.totalDays === "number" &&
    typeof value.totalPeople === "number" &&
    typeof value.currency === "string" &&
    typeof value.estimatedCostPerPerson === "number" &&
    typeof value.estimatedTotalCost === "number" &&
    typeof value.inputBudget === "number" &&
    typeof value.remainingBudget === "number" &&
    typeof value.budgetStatus === "string" &&
    typeof value.travelStyle === "string" &&
    Array.isArray(value.days) &&
    isObject(value.costBreakdown) &&
    Array.isArray(value.globalTips) &&
    Array.isArray(value.warnings) &&
    Array.isArray(value.highlights)
  );
}

function getErrorMessage(payload: unknown, status: number): string {
  if (isObject(payload) && typeof payload.error === "string") {
    return payload.error;
  }

  return `AI itinerary endpoint failed with status ${status}.`;
}

export async function generateItineraryWithAI(
  inputs: TripInputs
): Promise<GeneratedItinerary> {
  // Fetch real places from Supabase BEFORE calling the AI, then send them along
  // (the server-side function can't reach Supabase with the browser client).
  let placesText = "";
  try {
    const result = await fetchPlacesForPrompt(
      inputs.startCity,
      inputs.days,
      inputs.travelStyle
    );
    placesText = result.placesText;
  } catch (err) {
    console.warn("Could not fetch real places, AI will use general knowledge:", err);
  }

  const response = await fetch("/api/generate-itinerary", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...inputs, realPlaces: placesText }),
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, response.status));
  }

  const itinerary = isObject(payload) ? payload.itinerary : null;
  if (!isGeneratedItinerary(itinerary)) {
    throw new Error("AI itinerary endpoint returned an invalid itinerary.");
  }

  return itinerary;
}
