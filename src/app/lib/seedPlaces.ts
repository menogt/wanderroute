import { upsertPlace } from "./placesDb";
import type { DbPlace } from "./supabase";

// Sri Lanka cities with coordinates
const SL_CITIES: Record<string, { lat: number; lng: number }> = {
  Colombo:       { lat: 6.9271, lng: 79.8612 },
  Kandy:         { lat: 7.2906, lng: 80.6337 },
  Ella:          { lat: 6.8667, lng: 81.0466 },
  Galle:         { lat: 6.0535, lng: 80.2210 },
  Mirissa:       { lat: 5.9483, lng: 80.4716 },
  Sigiriya:      { lat: 7.9570, lng: 80.7603 },
  Negombo:       { lat: 7.2084, lng: 79.8358 },
  "Nuwara Eliya":{ lat: 6.9497, lng: 80.7891 },
  Dambulla:      { lat: 7.8675, lng: 80.6517 },
  Trincomalee:   { lat: 8.5874, lng: 81.2152 },
  Hikkaduwa:     { lat: 6.1395, lng: 80.1055 },
  "Arugam Bay":  { lat: 6.8406, lng: 81.8360 },
};

// Foursquare category IDs
const FSQ_CATEGORIES: Record<DbPlace["category"], string> = {
  hotel:       "19014",
  restaurant:  "13065",
  attraction:  "16000",
  beach:       "16032",
  temple:      "12076",
};

// Call the existing Foursquare proxy (no CORS issues — goes through Netlify in
// production and through the Vite dev proxy locally). Both target the 2025-06-17
// Foursquare Places API, which returns lat/lng directly on each result.
async function fetchFromFoursquare(
  lat: number,
  lng: number,
  categoryId: string,
  limit = 15
): Promise<any[]> {
  try {
    const params = new URLSearchParams({
      ll: `${lat},${lng}`,
      radius: "8000",
      categories: categoryId,
      limit: limit.toString(),
      sort: "POPULARITY",
    });

    const res = await fetch(`/api/foursquare?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      console.warn(`Foursquare proxy error: ${res.status}`);
      return [];
    }
    const data = await res.json();
    return data.results || [];
  } catch (err) {
    console.warn("Foursquare fetch failed:", err);
    return [];
  }
}

// Main seed function — call this from AdminScreen
export async function seedPlacesFromFoursquare(
  onProgress?: (msg: string) => void
): Promise<{ inserted: number; skipped: number; errors: number }> {
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const [city, coords] of Object.entries(SL_CITIES)) {
    for (const [category, categoryId] of Object.entries(FSQ_CATEGORIES)) {
      onProgress?.(`📍 Fetching ${category}s near ${city}...`);

      const places = await fetchFromFoursquare(
        coords.lat,
        coords.lng,
        categoryId
      );

      if (places.length === 0) {
        onProgress?.(`  ⚠️ No results for ${category}s in ${city}`);
        continue;
      }

      for (const p of places) {
        if (!p.name?.trim()) { skipped++; continue; }

        // 2025 Foursquare Places API returns lat/lng directly; fall back to the
        // legacy geocodes.main shape just in case the proxy ever returns it.
        const lat = p.latitude ?? p.geocodes?.main?.latitude;
        const lng = p.longitude ?? p.geocodes?.main?.longitude;

        const place: DbPlace = {
          name: p.name,
          city,
          category: category as DbPlace["category"],
          lat,
          lng,
          rating: p.rating ?? undefined,
          description: p.description ?? undefined,
          area:
            p.location?.neighborhood ??
            p.location?.locality ??
            p.location?.region ??
            city,
          source: "foursquare",
          // Set style based on price tier if available
          style: p.price
            ? p.price <= 1 ? "budget"
            : p.price <= 2 ? "comfort"
            : "luxury"
            : undefined,
          price_usd: p.price
            ? p.price === 1 ? 15
            : p.price === 2 ? 50
            : p.price === 3 ? 120
            : 200
            : undefined,
        };

        const ok = await upsertPlace(place);
        if (ok) {
          inserted++;
          onProgress?.(`  ✅ ${p.name}`);
        } else {
          errors++;
        }

        // Small delay to avoid hammering the proxy
        await new Promise(r => setTimeout(r, 150));
      }

      // Pause between categories
      await new Promise(r => setTimeout(r, 500));
    }

    onProgress?.(`✓ Done with ${city}`);
  }

  onProgress?.(`\n🎉 Complete! ${inserted} inserted · ${skipped} skipped · ${errors} errors`);
  return { inserted, skipped, errors };
}
