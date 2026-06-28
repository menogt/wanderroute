import { supabase, type DbPlace } from "./supabase";
import { HOTELS_BY_CITY } from "../components/rl/data";
import type { TravelStyle } from "../components/rl/types";

// Generate a unique device ID so trips are tied to this browser
export function getDeviceId(): string {
  let id = localStorage.getItem("wanderroute_device_id");
  if (!id) {
    id = "dev_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("wanderroute_device_id", id);
  }
  return id;
}

// Fetch places from Supabase for a city and category
export async function fetchPlaces(
  city: string,
  category: DbPlace["category"],
  style?: TravelStyle
): Promise<DbPlace[]> {
  if (!supabase) return [];

  let query = supabase
    .from("places")
    .select("*")
    .eq("city", city)
    .eq("category", category)
    .order("rating", { ascending: false })
    .limit(30);

  if (style) query = query.eq("style", style);

  const { data, error } = await query;
  if (error) {
    console.warn("Supabase fetch error:", error.message);
    return [];
  }
  return data || [];
}

// Representative values used when a derived (style-less) hotel has no price,
// stars, or amenities — keeps the cards coherent with the bucket it lands in.
const STYLE_PRICE: Record<TravelStyle, number> = { budget: 18, comfort: 50, luxury: 130 };
const STYLE_STARS: Record<TravelStyle, number> = { budget: 2, comfort: 3, luxury: 4 };
const STYLE_AMENITIES: Record<TravelStyle, string[]> = {
  budget: ["WiFi"],
  comfort: ["WiFi", "Breakfast"],
  luxury: ["WiFi", "Pool", "Breakfast"],
};

const LUXURY_NAME = /resort|grand|luxury|villa|spa/;
const BUDGET_NAME = /hostel|guest|inn|lodge|rest/;

// Many OSM-imported hotels have no style and no price, which made the
// budget/comfort/luxury filters very uneven. Derive a stable style: by price
// when present, otherwise inferred from the hotel name.
function deriveHotelStyle(p: DbPlace): TravelStyle {
  const price = p.price_usd;
  if (price != null) {
    if (price < 25) return "budget";
    if (price <= 80) return "comfort";
    return "luxury";
  }
  const name = (p.name || "").toLowerCase();
  if (LUXURY_NAME.test(name)) return "luxury";
  if (BUDGET_NAME.test(name)) return "budget";
  return "comfort";
}

// Fetch hotels — merges Supabase results with hardcoded data.ts hotels
export async function fetchHotels(city: string, style?: TravelStyle) {
  const dbHotels = await fetchPlaces(city, "hotel", style);

  const mapped = dbHotels.map(p => {
    // Use the stored style only when both style and price exist; otherwise
    // derive a balanced one so all three tiers get hotels.
    const resolvedStyle: TravelStyle =
      p.style && p.price_usd != null ? (p.style as TravelStyle) : deriveHotelStyle(p);
    return {
      name: p.name,
      city: p.city,
      stars: p.stars ?? STYLE_STARS[resolvedStyle],
      priceUSD: p.price_usd ?? STYLE_PRICE[resolvedStyle],
      type: resolvedStyle,
      amenities: p.amenities && p.amenities.length ? p.amenities : STYLE_AMENITIES[resolvedStyle],
      area: p.area ?? city,
      tip: p.tip,
      bookingUrl: p.booking_url,
      agodaUrl: p.agoda_url,
      location: (p.lat != null && p.lng != null) ? [p.lat, p.lng] as [number, number] : undefined,
      rating: p.rating,
    };
  });

  // Merge with curated hardcoded hotels — deduplicate by name
  const hardcoded = (HOTELS_BY_CITY as Record<string, any[]>)[city] ?? [];
  const names = new Set(mapped.map(h => h.name.toLowerCase()));
  const unique = hardcoded.filter((h: any) => !names.has(h.name.toLowerCase()));

  return [...mapped, ...unique];
}

// Insert a place into Supabase (used by seed + admin form)
export async function upsertPlace(place: DbPlace): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("places")
    .upsert(place, { onConflict: "name,city" });
  if (error) {
    console.warn("Upsert error:", error.message);
    return false;
  }
  return true;
}
