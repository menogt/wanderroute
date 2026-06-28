import { useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { Search, Hotel, Utensils, Landmark } from "lucide-react";
import {
  CITY_COORDS, SRI_LANKA_CENTER, SRI_LANKA_ZOOM,
  CITY_CATEGORIES, MARKER_COLORS
} from "./mapConfig";
import { createColorMarker, createHotelMarker } from "./leafletSetup";
import { HOTELS_BY_CITY } from "./data";
import { usePlaceDiscovery } from "../../hooks/usePlaceDiscovery";
import type { DiscoveryCategory } from "./foursquareDiscovery";
import type { Screen } from "./types";

const NAVY = "#0B1340";
const GOLD = "#C9A227";

type Category = "all" | "city" | "beach" | "hill" | "ancient" | "wildlife";

const FILTER_LABELS: Record<Category, string> = {
  all:     "🗺️ All",
  city:    "🏙️ Cities",
  beach:   "🏖️ Beaches",
  hill:    "🌿 Hill Country",
  ancient: "🏰 Ancient Sites",
  wildlife:"🐘 Wildlife",
};

// Budget hints per city (nightly estimate, budget tier)
const CITY_BUDGET_HINT: Record<string, string> = {
  Colombo:       "From $12/night",
  Kandy:         "From $11/night",
  Ella:          "From $15/night",
  Mirissa:       "From $10/night",
  Galle:         "From $12/night",
  Sigiriya:      "From $18/night",
  Negombo:       "From $13/night",
  "Nuwara Eliya":"From $14/night",
  Dambulla:      "From $11/night",
  Trincomalee:   "From $12/night",
  Unawatuna:     "From $14/night",
  Hikkaduwa:     "From $12/night",
  "Arugam Bay":  "From $13/night",
  Jaffna:        "From $15/night",
  Anuradhapura:  "From $12/night",
  Yala:          "From $20/night",
  Minneriya:     "From $18/night",
  Kalpitiya:     "From $16/night",
};

// Discovery category metadata — drives the toggle pills, marker colour, and labels
const DISCOVERY_META: Record<DiscoveryCategory, { label: string; icon: typeof Hotel; color: string }> = {
  hotel:      { label: "Hotels",      icon: Hotel,    color: "#0D9488" },
  restaurant: { label: "Restaurants", icon: Utensils, color: "#DC2626" },
  attraction: { label: "Attractions", icon: Landmark, color: "#7C3AED" },
};

export function MapScreen({
  navigate,
  onCitySelect,
}: {
  navigate: (s: Screen) => void;
  onCitySelect: (city: string) => void;
}) {
  const [filter, setFilter] = useState<Category>("all");
  const [search, setSearch] = useState("");
  const [showHotels, setShowHotels] = useState(false);
  const [discoveryCategory, setDiscoveryCategory] = useState<DiscoveryCategory | null>(null);

  // Only discover near the currently visible cities — keeps API usage low
  const visibleCityNames = useMemo(() => Object.keys(CITY_COORDS).filter(city => {
    const cat = CITY_CATEGORIES[city] ?? "city";
    const matchesFilter = filter === "all" || cat === filter;
    const matchesSearch = city.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  }), [filter, search]);

  const { places: discoveredPlaces, loading: discoveringPlaces, resolvedCities, totalCities } =
    usePlaceDiscovery(visibleCityNames, discoveryCategory ?? "hotel", discoveryCategory !== null, 5);

  // Flatten all hotels with their city + coordinates, skipping any without location data
  const allHotelPins = useMemo(() => {
    const pins: Array<{
      city: string; name: string; priceUSD: number; type: string;
      stars: number; bookingUrl?: string; location: [number, number];
    }> = [];
    Object.entries(HOTELS_BY_CITY).forEach(([city, hotels]) => {
      hotels.forEach(h => {
        if (h.location) {
          pins.push({ city, name: h.name, priceUSD: h.priceUSD, type: h.type, stars: h.stars, bookingUrl: h.bookingUrl, location: h.location });
        }
      });
    });
    return pins;
  }, []);

  const visibleCities = useMemo(() => {
    return Object.entries(CITY_COORDS).filter(([city]) => {
      const cat = CITY_CATEGORIES[city] ?? "city";
      const matchesFilter = filter === "all" || cat === filter;
      const matchesSearch = city.toLowerCase().includes(search.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [filter, search]);

  return (
    <div style={{ background: "#EEF2FA", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(160deg, ${NAVY} 0%, #1D2E6B 100%)`,
        padding: "52px 24px 24px",
      }}>
        <p style={{ color: GOLD, fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.1em", marginBottom: 8 }}>EXPLORE</p>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "2rem", fontWeight: 900, color: "#fff", lineHeight: 1.15, marginBottom: 10 }}>
          Sri Lanka<br />Interactive Map
        </h1>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.85rem", lineHeight: 1.6, margin: 0 }}>
          Tap any location to plan a trip there instantly.
        </p>
      </div>

      <div style={{ padding: "20px 24px 0" }}>
        {/* Search bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          background: "#fff", borderRadius: 12, padding: "10px 14px",
          marginBottom: 14, boxShadow: "0 2px 10px rgba(11,19,64,0.06)",
        }}>
          <Search size={16} color="#9CA3AF" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search cities..."
            style={{
              border: "none", outline: "none", flex: 1,
              fontSize: "0.88rem", color: NAVY, background: "transparent",
            }}
          />
        </div>

        {/* Category filter pills */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 10, paddingBottom: 4, scrollbarWidth: "none" }}>
          {(Object.keys(FILTER_LABELS) as Category[]).map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              style={{
                whiteSpace: "nowrap", padding: "7px 14px",
                borderRadius: 100, border: "none", cursor: "pointer",
                fontWeight: 600, fontSize: "0.78rem", flexShrink: 0,
                background: filter === cat ? NAVY : "#fff",
                color: filter === cat ? "#fff" : "#6B7280",
                boxShadow: filter === cat ? "0 2px 8px rgba(11,19,64,0.2)" : "0 1px 4px rgba(11,19,64,0.06)",
              }}
            >
              {FILTER_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Hotel pins toggle */}
        <button
          onClick={() => setShowHotels(v => !v)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            width: "100%", padding: "10px 14px", marginBottom: 10,
            borderRadius: 12, border: "none", cursor: "pointer",
            background: showHotels ? GOLD : "#fff",
            color: showHotels ? NAVY : "#6B7280",
            fontWeight: 700, fontSize: "0.82rem",
            boxShadow: showHotels ? "0 2px 10px rgba(201,162,39,0.35)" : "0 1px 4px rgba(11,19,64,0.06)",
            transition: "all 0.2s",
          }}
        >
          <Hotel size={15} />
          {showHotels ? `Showing ${allHotelPins.length} curated hotels` : "Show curated hotels on map"}
        </button>

        {/* Foursquare discovery — pick a category to auto-find nearby places, no manual entry */}
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: "0.72rem", color: "#9CA3AF", fontWeight: 700, marginBottom: 8, letterSpacing: "0.04em" }}>
            DISCOVER NEARBY (AUTO)
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            {(Object.keys(DISCOVERY_META) as DiscoveryCategory[]).map(cat => {
              const meta = DISCOVERY_META[cat];
              const Icon = meta.icon;
              const active = discoveryCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setDiscoveryCategory(active ? null : cat)}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: "10px 8px", borderRadius: 12, border: "none", cursor: "pointer",
                    background: active ? meta.color : "#fff",
                    color: active ? "#fff" : "#6B7280",
                    fontWeight: 700, fontSize: "0.76rem",
                    boxShadow: active ? `0 2px 10px ${meta.color}55` : "0 1px 4px rgba(11,19,64,0.06)",
                    transition: "all 0.2s",
                  }}
                >
                  <Icon size={14} />
                  {meta.label}
                </button>
              );
            })}
          </div>
          {discoveryCategory && (
            <p style={{ fontSize: "0.74rem", color: DISCOVERY_META[discoveryCategory].color, fontWeight: 600, marginTop: 8 }}>
              {discoveringPlaces
                ? `Discovering ${DISCOVERY_META[discoveryCategory].label.toLowerCase()}... (${resolvedCities}/${totalCities} cities)`
                : `Found ${discoveredPlaces.length} ${DISCOVERY_META[discoveryCategory].label.toLowerCase()} nearby`}
            </p>
          )}
        </div>

        {/* Map */}
        <div style={{ borderRadius: 20, overflow: "hidden", boxShadow: "0 4px 24px rgba(11,19,64,0.12)", marginBottom: 16 }}>
          <MapContainer
            center={SRI_LANKA_CENTER}
            zoom={SRI_LANKA_ZOOM}
            style={{ height: 420, width: "100%" }}
            scrollWheelZoom={true}
            attributionControl={false}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {visibleCities.map(([city, coords]) => {
              const cat = CITY_CATEGORIES[city] ?? "city";
              const color = MARKER_COLORS[cat];
              const hotelCount = (HOTELS_BY_CITY[city] || []).length;
              return (
                <Marker key={city} position={coords} icon={createColorMarker(color, 14)}>
                  <Popup>
                    <div style={{ fontFamily: "sans-serif", minWidth: 140 }}>
                      <strong style={{ color: NAVY, fontSize: 14 }}>{city}</strong>
                      <div style={{
                        display: "inline-block", marginLeft: 6,
                        background: color + "20", color: color,
                        borderRadius: 4, padding: "1px 6px",
                        fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                      }}>
                        {cat}
                      </div>
                      {CITY_BUDGET_HINT[city] && (
                        <p style={{ margin: "4px 0 2px", color: "#6B7280", fontSize: 12 }}>
                          {CITY_BUDGET_HINT[city]}
                        </p>
                      )}
                      {hotelCount > 0 && (
                        <p style={{ margin: "0 0 8px", color: "#6B7280", fontSize: 11 }}>
                          🏨 {hotelCount} hotel{hotelCount !== 1 ? "s" : ""} listed
                        </p>
                      )}
                      <button
                        onClick={() => {
                          onCitySelect(city);
                          navigate("planner");
                        }}
                        style={{
                          width: "100%", background: GOLD, color: NAVY,
                          border: "none", borderRadius: 8,
                          padding: "7px 10px", fontSize: 12, fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Plan a trip here →
                      </button>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Individual hotel pins — only rendered when toggled on */}
            {showHotels && allHotelPins.map((hotel, i) => (
              <Marker
                key={`${hotel.city}-${hotel.name}-${i}`}
                position={hotel.location}
                icon={createHotelMarker(hotel.type as "budget" | "comfort" | "luxury")}
              >
                <Popup>
                  <div style={{ fontFamily: "sans-serif", minWidth: 160 }}>
                    <strong style={{ color: NAVY, fontSize: 13 }}>{hotel.name}</strong>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, margin: "4px 0" }}>
                      {Array.from({ length: hotel.stars }).map((_, s) => (
                        <span key={s} style={{ color: GOLD, fontSize: 11 }}>★</span>
                      ))}
                      <span style={{ color: "#9CA3AF", fontSize: 11, marginLeft: 4 }}>{hotel.city}</span>
                    </div>
                    <p style={{ margin: "2px 0 8px", color: NAVY, fontSize: 14, fontWeight: 800 }}>
                      ${hotel.priceUSD}<span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 400 }}>/night</span>
                    </p>
                    {hotel.bookingUrl && (
                      <a
                        href={hotel.bookingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "block", textAlign: "center",
                          background: NAVY, color: "#fff",
                          borderRadius: 8, padding: "7px 10px",
                          fontSize: 12, fontWeight: 700, textDecoration: "none",
                        }}
                      >
                        View on Booking.com →
                      </a>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Foursquare-discovered places — colour-coded dots by category, distinct from curated bed icons */}
            {discoveryCategory && discoveredPlaces.map((place) => (
              <Marker
                key={place.fsqId}
                position={place.location}
                icon={createColorMarker(DISCOVERY_META[discoveryCategory].color, 10)}
              >
                <Popup>
                  <div style={{ fontFamily: "sans-serif", minWidth: 150 }}>
                    <strong style={{ color: NAVY, fontSize: 13 }}>{place.name}</strong>
                    <p style={{ margin: "4px 0 6px", color: "#9CA3AF", fontSize: 11 }}>
                      {place.address || place.city}
                    </p>
                    {place.rating && (
                      <p style={{ margin: "0 0 6px", color: GOLD, fontSize: 12, fontWeight: 700 }}>
                        ★ {place.rating.toFixed(1)}
                      </p>
                    )}
                    <p style={{ margin: 0, color: DISCOVERY_META[discoveryCategory].color, fontSize: 10, fontWeight: 600 }}>
                      Discovered via Foursquare
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* City count */}
        <p style={{ color: "#9CA3AF", fontSize: "0.78rem", textAlign: "center", marginBottom: 6 }}>
          Showing {visibleCities.length} of {Object.keys(CITY_COORDS).length} destinations
        </p>
        {discoveryCategory && !discoveringPlaces && discoveredPlaces.length > 0 && (
          <p style={{ color: DISCOVERY_META[discoveryCategory].color, fontSize: "0.72rem", textAlign: "center", marginBottom: 24, fontWeight: 600 }}>
            🟢 {discoveredPlaces.length} additional {DISCOVERY_META[discoveryCategory].label.toLowerCase()} found automatically — no manual entry needed
          </p>
        )}
        {(!discoveryCategory || discoveringPlaces || discoveredPlaces.length === 0) && (
          <div style={{ marginBottom: 24 }} />
        )}
      </div>
    </div>
  );
}
