import { useState } from "react";
import { Star, MapPin, Wifi, Waves, Utensils, Dumbbell } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useHotels } from "./useHotels";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { getCityCoords, MARKER_COLORS, CITY_CATEGORIES } from "./mapConfig";
import { createColorMarker } from "./leafletSetup";
import { useFoursquareGeocoding } from "../../hooks/useFoursquareGeocoding";
import type { Screen, TravelStyle } from "./types";

const NAVY = "#0B1340";
const GOLD = "#C9A227";
const TEAL = "#0D9488";
const AGODA_RED = "#E63946";

const CITIES = [
  "Colombo", "Kandy", "Ella", "Mirissa", "Galle", "Sigiriya",
  "Nuwara Eliya", "Trincomalee", "Negombo", "Dambulla",
];
const STYLES: TravelStyle[] = ["budget", "comfort", "luxury"];
const STYLE_LABELS: Record<TravelStyle, string> = { budget: "🎒 Budget", comfort: "✨ Comfort", luxury: "👑 Luxury" };
const STYLE_COLORS: Record<TravelStyle, string> = { budget: TEAL, comfort: GOLD, luxury: "#8B5CF6" };

const AMENITY_ICONS: Record<string, React.ReactNode> = {
  WiFi: <Wifi size={11} />,
  Pool: <Waves size={11} />,
  Breakfast: <Utensils size={11} />,
  Gym: <Dumbbell size={11} />,
  Spa: <Star size={11} />,
};

function todayStr() {
  return new Date().toISOString().split("T")[0];
}
function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

export function HotelsScreen({ navigate }: { navigate: (s: Screen) => void }) {
  const [city, setCity] = useState("Colombo");
  const [style, setStyle] = useState<TravelStyle>("comfort");
  const [checkIn, setCheckIn] = useState(todayStr());
  const [checkOut, setCheckOut] = useState(tomorrowStr());
  const [selectedHotelIndex, setSelectedHotelIndex] = useState<number | null>(null);

  const { hotels } = useHotels();
  const bp = useBreakpoint();
  const isDesktop = bp === "desktop";
  const isTabletPlus = bp === "tablet" || bp === "desktop";

  const cityHotels = (hotels[city] || []).filter((h) => h.type === style);

  // Reset map selection whenever the filters change so stale indices don't highlight.
  const selectCity = (c: string) => { setCity(c); setSelectedHotelIndex(null); };
  const selectStyle = (s: TravelStyle) => { setStyle(s); setSelectedHotelIndex(null); };

  const handleSelectHotel = (i: number) => {
    setSelectedHotelIndex(i);
    setTimeout(() => {
      document.getElementById(`hotel-${i}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  };

  const buildBookingUrl = (name: string, bookingUrl?: string) => {
    if (bookingUrl) {
      const url = new URL(bookingUrl);
      if (checkIn) url.searchParams.set("checkin", checkIn);
      if (checkOut) url.searchParams.set("checkout", checkOut);
      return url.toString();
    }
    return `https://www.booking.com/search.html?ss=${encodeURIComponent(name)}+${encodeURIComponent(city)}+Sri+Lanka&checkin=${checkIn}&checkout=${checkOut}`;
  };

  // ── Filters (reused in sidebar and inline) ──
  const filterPanel = (
    <>
      {/* Style filter */}
      <div style={{ marginBottom: 20 }}>
        {isDesktop && <p style={{ color: NAVY, fontWeight: 700, fontSize: "0.78rem", marginBottom: 10 }}>Travel Style</p>}
        <div style={{ display: "flex", gap: 8, flexDirection: isDesktop ? "column" : "row" }}>
          {STYLES.map((s) => (
            <button
              key={s}
              onClick={() => selectStyle(s)}
              style={{
                flex: isDesktop ? undefined : 1,
                padding: isDesktop ? "10px 14px" : "10px 0",
                borderRadius: 12, border: "none", cursor: "pointer",
                fontWeight: 700, fontSize: "0.78rem",
                textAlign: isDesktop ? "left" : "center",
                background: style === s ? STYLE_COLORS[s] : "#fff",
                color: style === s ? (s === "comfort" ? NAVY : "#fff") : "#6B7280",
                boxShadow: style === s ? `0 4px 16px ${STYLE_COLORS[s]}40` : "0 1px 4px rgba(11,19,64,0.06)",
                transition: "all 0.2s",
              }}
            >
              {STYLE_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* City filter */}
      {isDesktop ? (
        <div>
          <p style={{ color: NAVY, fontWeight: 700, fontSize: "0.78rem", marginBottom: 10 }}>City</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {CITIES.map((c) => (
              <button
                key={c}
                onClick={() => selectCity(c)}
                style={{
                  padding: "9px 14px", borderRadius: 10, border: "none", cursor: "pointer",
                  fontWeight: 600, fontSize: "0.78rem", textAlign: "left",
                  background: city === c ? NAVY : "#fff",
                  color: city === c ? "#fff" : "#6B7280",
                  boxShadow: "0 1px 4px rgba(11,19,64,0.05)",
                  transition: "all 0.15s",
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
          {CITIES.map((c) => (
            <button
              key={c}
              onClick={() => selectCity(c)}
              style={{
                whiteSpace: "nowrap", padding: "7px 14px", borderRadius: 100, border: "none", cursor: "pointer",
                fontWeight: 600, fontSize: "0.78rem", flexShrink: 0,
                background: city === c ? NAVY : "#fff",
                color: city === c ? "#fff" : "#6B7280",
              }}
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </>
  );

  return (
    <div style={{ background: "#EEF2FA", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(160deg, ${NAVY} 0%, #1D2E6B 100%)`, padding: isTabletPlus ? "40px 32px 32px" : "52px 24px 32px" }}>
        <p style={{ color: GOLD, fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.1em", marginBottom: 8 }}>ACCOMMODATIONS</p>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: isDesktop ? "2.8rem" : "2rem", fontWeight: 900, color: "#fff", lineHeight: 1.15 }}>
          Where to Stay
        </h1>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: isDesktop ? "1rem" : "0.85rem", lineHeight: 1.6, marginTop: 8 }}>
          Curated picks across all budgets, with honest price ranges and local tips.
        </p>

        {/* Date pickers */}
        <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
          <div style={{ flex: 1 }}>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.7rem", fontWeight: 600, marginBottom: 6 }}>CHECK IN</p>
            <input
              type="date"
              value={checkIn}
              min={todayStr()}
              onChange={(e) => setCheckIn(e.target.value)}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.1)", color: "#fff",
                fontSize: "0.85rem", fontWeight: 600, outline: "none",
                colorScheme: "dark",
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.7rem", fontWeight: 600, marginBottom: 6 }}>CHECK OUT</p>
            <input
              type="date"
              value={checkOut}
              min={checkIn || todayStr()}
              onChange={(e) => setCheckOut(e.target.value)}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.1)", color: "#fff",
                fontSize: "0.85rem", fontWeight: 600, outline: "none",
                colorScheme: "dark",
              }}
            />
          </div>
        </div>
      </div>

      {/* Body */}
      {isDesktop ? (
        /* Desktop: sidebar + grid */
        <div style={{ display: "flex", gap: 28, padding: "32px 40px", alignItems: "flex-start" }}>
          {/* Filter sidebar */}
          <div style={{ width: 220, flexShrink: 0, position: "sticky", top: 92 }}>
            <div style={{ background: "#fff", borderRadius: 20, padding: "20px", boxShadow: "0 4px 20px rgba(11,19,64,0.07)" }}>
              {filterPanel}
            </div>
          </div>

          {/* Hotel cards grid */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {cityHotels.length > 0 && (
              <HotelMap hotels={cityHotels} city={city} selectedIndex={selectedHotelIndex} onSelect={handleSelectHotel} />
            )}
            {cityHotels.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#9CA3AF" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🔍</div>
                <p style={{ fontWeight: 600 }}>No {STYLE_LABELS[style]} hotels listed for {city} yet.</p>
                <p style={{ fontSize: "0.82rem", marginTop: 6 }}>Try a different city or style.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
                {cityHotels.map((hotel, i) => (
                  <HotelCard key={i} index={i} selected={selectedHotelIndex === i} hotel={hotel} style={style} city={city} bookingUrl={buildBookingUrl(hotel.name, hotel.bookingUrl)} />
                ))}
              </div>
            )}
            <TipCard />
          </div>
        </div>
      ) : (
        /* Mobile/Tablet: stacked filters + grid */
        <div style={{ padding: isTabletPlus ? "24px 32px" : "24px" }}>
          {/* Style filter */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {STYLES.map((s) => (
              <button
                key={s}
                onClick={() => selectStyle(s)}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 12, border: "none", cursor: "pointer",
                  fontWeight: 700, fontSize: "0.78rem",
                  background: style === s ? STYLE_COLORS[s] : "#fff",
                  color: style === s ? (s === "comfort" ? NAVY : "#fff") : "#6B7280",
                  boxShadow: style === s ? `0 4px 16px ${STYLE_COLORS[s]}40` : "0 1px 4px rgba(11,19,64,0.06)",
                  transition: "all 0.2s",
                }}
              >
                {STYLE_LABELS[s]}
              </button>
            ))}
          </div>

          {/* City filter */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 24, paddingBottom: 4, scrollbarWidth: "none" }}>
            {CITIES.map((c) => (
              <button
                key={c}
                onClick={() => selectCity(c)}
                style={{
                  whiteSpace: "nowrap", padding: "7px 14px", borderRadius: 100, border: "none", cursor: "pointer",
                  fontWeight: 600, fontSize: "0.78rem", flexShrink: 0,
                  background: city === c ? NAVY : "#fff",
                  color: city === c ? "#fff" : "#6B7280",
                }}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Hotel location map */}
          {cityHotels.length > 0 && (
            <HotelMap hotels={cityHotels} city={city} selectedIndex={selectedHotelIndex} onSelect={handleSelectHotel} />
          )}

          {/* Hotel cards */}
          {cityHotels.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#9CA3AF" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🔍</div>
              <p style={{ fontWeight: 600 }}>No {STYLE_LABELS[style]} hotels listed for {city} yet.</p>
              <p style={{ fontSize: "0.82rem", marginTop: 6 }}>Try a different city or style.</p>
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: isTabletPlus ? "repeat(2, 1fr)" : "1fr",
              gap: 16,
            }}>
              {cityHotels.map((hotel, i) => (
                <HotelCard key={i} index={i} selected={selectedHotelIndex === i} hotel={hotel} style={style} city={city} bookingUrl={buildBookingUrl(hotel.name, hotel.bookingUrl)} />
              ))}
            </div>
          )}
          <TipCard />
        </div>
      )}
    </div>
  );
}

function HotelMap({ hotels, city, selectedIndex, onSelect }: {
  hotels: Array<{ name: string; priceUSD: number; area?: string; location?: [number, number] }>;
  city: string;
  selectedIndex: number | null;
  onSelect: (i: number) => void;
}) {
  // Geocode only the hotels that don't already carry static coords (e.g. user-added),
  // using Foursquare for accurate hotel positions, biased toward the selected city.
  const queries = hotels
    .map((hotel, i) => ({ hotel, i }))
    .filter(x => !x.hotel.location)
    .map(x => ({ key: `hotel-${x.i}`, placeName: x.hotel.name, city }));

  const { coords: geocodedCoords, loading } = useFoursquareGeocoding(queries);

  // Merge static coords + geocoded coords, preserving hotel order.
  const hotelCoords = hotels.map((hotel, i) =>
    hotel.location || geocodedCoords[`hotel-${i}`] || null
  );

  const cityCoords = getCityCoords(city);
  if (!cityCoords) return null;

  const category = CITY_CATEGORIES[city] ?? "city";
  const baseColor = MARKER_COLORS[category];

  return (
    <div style={{
      borderRadius: 16, overflow: "hidden", marginBottom: 20,
      boxShadow: "0 4px 20px rgba(11,19,64,0.1)",
      border: "1px solid rgba(11,19,64,0.06)",
    }}>
      {loading && (
        <div style={{
          background: "#C9A227", color: "#0B1340",
          padding: "6px 14px", fontSize: "0.72rem", fontWeight: 700,
          textAlign: "center",
        }}>
          📍 Locating hotels on map...
        </div>
      )}
      <MapContainer
        center={cityCoords}
        zoom={13}
        style={{ height: 200, width: "100%" }}
        zoomControl={false}
        scrollWheelZoom={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
        {hotels.map((hotel, i) => {
          const coords = hotelCoords[i];
          if (!coords) return null;
          const isSelected = selectedIndex === i;
          return (
            <Marker
              key={i}
              position={coords}
              icon={createColorMarker(isSelected ? "#C9A227" : baseColor, isSelected ? 16 : 12)}
              eventHandlers={{ click: () => onSelect(i) }}
            >
              <Popup>
                <div style={{ fontFamily: "sans-serif" }}>
                  <strong style={{ color: "#0B1340", fontSize: 13 }}>{hotel.name}</strong>
                  {hotel.area && (
                    <p style={{ color: "#9CA3AF", fontSize: 11, margin: "2px 0 0" }}>{hotel.area}</p>
                  )}
                  <p style={{ color: "#0D9488", fontWeight: 700, fontSize: 12, margin: "4px 0 0" }}>
                    ${hotel.priceUSD}/night
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

function HotelCard({
  hotel,
  style,
  index,
  selected,
  bookingUrl,
}: {
  hotel: { name: string; stars: number; priceUSD: number; type: TravelStyle; amenities: string[]; area: string; tip?: string; agodaUrl?: string };
  style: TravelStyle;
  index: number;
  selected: boolean;
  city: string;
  bookingUrl: string;
}) {
  return (
    <div id={`hotel-${index}`} style={{
      background: "#fff", borderRadius: 20,
      boxShadow: selected ? "0 6px 24px rgba(201,162,39,0.25)" : "0 4px 20px rgba(11,19,64,0.07)",
      border: selected ? "2px solid #C9A227" : "1px solid rgba(11,19,64,0.05)",
      overflow: "hidden",
      transition: "border 0.2s, box-shadow 0.2s",
    }}>
      <div style={{ height: 4, background: `linear-gradient(90deg, ${STYLE_COLORS[style]}, ${STYLE_COLORS[style]}80)` }} />
      <div style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div style={{ flex: 1, paddingRight: 12 }}>
            <h3 style={{ color: NAVY, fontWeight: 800, fontSize: "1rem", marginBottom: 4, lineHeight: 1.3 }}>{hotel.name}</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <MapPin size={11} color="#9CA3AF" />
              <span style={{ color: "#9CA3AF", fontSize: "0.75rem" }}>{hotel.area}</span>
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ color: NAVY, fontWeight: 800, fontSize: "1.1rem", fontFamily: "'Playfair Display', serif" }}>${hotel.priceUSD}</div>
            <div style={{ color: "#9CA3AF", fontSize: "0.7rem" }}>per night</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 3, marginBottom: 12 }}>
          {Array.from({ length: hotel.stars }).map((_, si) => (
            <Star key={si} size={12} fill={GOLD} color={GOLD} />
          ))}
          {Array.from({ length: 5 - hotel.stars }).map((_, si) => (
            <Star key={si} size={12} fill="none" color="#E5E7EB" />
          ))}
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: hotel.tip ? 12 : 0 }}>
          {hotel.amenities.map((a) => (
            <span key={a} style={{
              display: "flex", alignItems: "center", gap: 4,
              background: "rgba(11,19,64,0.04)", color: "#4B5563",
              borderRadius: 100, padding: "4px 10px",
              fontSize: "0.72rem", fontWeight: 600,
            }}>
              {AMENITY_ICONS[a] || null}
              {a}
            </span>
          ))}
        </div>

        {hotel.tip && (
          <div style={{ background: "rgba(201,162,39,0.08)", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: "0.85rem" }}>💡</span>
            <p style={{ color: "#92400E", fontSize: "0.76rem", lineHeight: 1.5, margin: 0 }}>
              <strong>Tip:</strong> {hotel.tip}
            </p>
          </div>
        )}

        {/* Booking.com button */}
        <a
          href={bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "block", textAlign: "center", textDecoration: "none",
            width: "100%", marginTop: 14, boxSizing: "border-box",
            background: `linear-gradient(135deg, ${GOLD}, #E8C547)`,
            color: NAVY, border: "none", borderRadius: 12,
            padding: "11px", fontWeight: 700, fontSize: "0.85rem",
            cursor: "pointer",
          }}
        >
          Check Availability →
        </a>

        {/* Agoda button (only if agodaUrl is set) */}
        {hotel.agodaUrl && (
          <a
            href={hotel.agodaUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block", textAlign: "center", textDecoration: "none",
              width: "100%", marginTop: 8, boxSizing: "border-box",
              background: AGODA_RED,
              color: "#fff", border: "none", borderRadius: 12,
              padding: "11px", fontWeight: 700, fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            Check Agoda
          </a>
        )}
      </div>
    </div>
  );
}

function TipCard() {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${NAVY}08, ${TEAL}08)`,
      border: `1px solid ${TEAL}20`,
      borderRadius: 16, padding: "16px 18px", marginTop: 24,
    }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span style={{ fontSize: "1.2rem" }}>🧭</span>
        <div>
          <p style={{ color: NAVY, fontWeight: 700, fontSize: "0.85rem", marginBottom: 4 }}>WanderRoute Booking Tip</p>
          <p style={{ color: "#4B5563", fontSize: "0.78rem", lineHeight: 1.6, margin: 0 }}>
            Always book directly with small guesthouses for better rates. For chain hotels, Booking.com usually beats the hotel's own website in Sri Lanka.
          </p>
        </div>
      </div>
    </div>
  );
}
