import { supabase } from "./supabase";
import type { TravelStyle } from "../components/rl/types";

// A sensible default city sequence per starting city for Sri Lanka.
// Used to decide which cities' places to fetch BEFORE the AI runs.
const ROUTE_HINTS: Record<string, string[]> = {
  Colombo:       ["Colombo", "Kandy", "Ella", "Mirissa", "Galle"],
  Kandy:         ["Kandy", "Nuwara Eliya", "Ella", "Sigiriya"],
  Negombo:       ["Negombo", "Sigiriya", "Dambulla", "Trincomalee"],
  Galle:         ["Galle", "Mirissa", "Hikkaduwa", "Unawatuna"],
  Ella:          ["Ella", "Mirissa", "Kandy", "Nuwara Eliya"],
  Sigiriya:      ["Sigiriya", "Dambulla", "Kandy", "Trincomalee"],
  Trincomalee:   ["Trincomalee", "Sigiriya", "Kandy", "Colombo"],
};

// Pick cities to fetch based on start city + trip length
function pickCities(startCity: string, days: number): string[] {
  const hint = ROUTE_HINTS[startCity] ?? ROUTE_HINTS["Colombo"];
  // More days = more cities. ~2 days per city.
  const count = Math.min(hint.length, Math.max(2, Math.ceil(days / 2)));
  // Ensure startCity is first
  const cities = [startCity, ...hint.filter(c => c !== startCity)];
  return cities.slice(0, count);
}

// Fetch a compact real-place list for the AI prompt
export async function fetchPlacesForPrompt(
  startCity: string,
  days: number,
  style: TravelStyle
): Promise<{ cities: string[]; placesText: string }> {
  const cities = pickCities(startCity, days);

  if (!supabase) {
    return { cities, placesText: "" };
  }

  const blocks: string[] = [];

  for (const city of cities) {
    // Hotels matching the travel style (fall back to any if none)
    let { data: hotels } = await supabase
      .from("places")
      .select("name, area, price_usd")
      .eq("city", city)
      .eq("category", "hotel")
      .eq("style", style)
      .order("rating", { ascending: false })
      .limit(5);

    if (!hotels || hotels.length === 0) {
      const res = await supabase
        .from("places")
        .select("name, area, price_usd")
        .eq("city", city)
        .eq("category", "hotel")
        .limit(5);
      hotels = res.data || [];
    }

    // Top attractions + temples + beaches
    const { data: attractions } = await supabase
      .from("places")
      .select("name, category")
      .eq("city", city)
      .in("category", ["attraction", "temple", "beach"])
      .order("rating", { ascending: false })
      .limit(8);

    // Top restaurants
    const { data: restaurants } = await supabase
      .from("places")
      .select("name")
      .eq("city", city)
      .eq("category", "restaurant")
      .order("rating", { ascending: false })
      .limit(5);

    const hotelNames = (hotels || []).map(h =>
      `${h.name}${h.price_usd ? ` (~$${h.price_usd}/night)` : ""}`
    ).join(", ");
    const attractionNames = (attractions || []).map(a => a.name).join(", ");
    const restaurantNames = (restaurants || []).map(r => r.name).join(", ");

    blocks.push(
      `${city}:\n` +
      `  Hotels: ${hotelNames || "none listed"}\n` +
      `  Attractions: ${attractionNames || "none listed"}\n` +
      `  Restaurants: ${restaurantNames || "none listed"}`
    );
  }

  return { cities, placesText: blocks.join("\n\n") };
}
