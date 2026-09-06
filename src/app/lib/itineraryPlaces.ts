import { supabase } from "./supabase";
import type { TravelStyle } from "../components/rl/types";
import { MUST_SEE } from "./curatedPlaces";

// Fetch a compact real-place list for the AI prompt
export async function fetchPlacesForPrompt(
  cities: string[],
  style: TravelStyle
): Promise<{ cities: string[]; placesText: string }> {
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
      .order("importance_score", { ascending: false })
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
      .order("importance_score", { ascending: false })
      .order("rating", { ascending: false })
      .limit(8);

    // Top restaurants
    const { data: restaurants } = await supabase
      .from("places")
      .select("name")
      .eq("city", city)
      .eq("category", "restaurant")
      .order("importance_score", { ascending: false })
      .order("rating", { ascending: false })
      .limit(5);

    const hotelNames = (hotels || []).map(h =>
      `${h.name}${h.price_usd ? ` (~$${h.price_usd}/night)` : ""}`
    ).join(", ");

    // Must-see landmarks go first, then DB attractions ranked by importance_score,
    // deduplicated case-insensitively so nothing shows up twice.
    const seen = new Set<string>();
    const combinedAttractions: string[] = [];
    for (const name of [...(MUST_SEE[city] || []), ...(attractions || []).map(a => a.name)]) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      combinedAttractions.push(name);
    }
    const attractionNames = combinedAttractions.slice(0, 10).join(", ");
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
