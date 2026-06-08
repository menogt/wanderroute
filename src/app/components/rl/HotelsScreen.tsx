import { useState } from "react";
import { Star, MapPin, Wifi, Waves, Utensils, Dumbbell } from "lucide-react";
import { HOTELS_BY_CITY, CURRENCY_SYMBOLS } from "./data";
import type { Screen, TravelStyle } from "./types";

const NAVY = "#0B1340";
const GOLD = "#C9A227";
const TEAL = "#0D9488";

const CITIES = ["Colombo", "Kandy", "Ella", "Mirissa", "Galle", "Sigiriya"];
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

export function HotelsScreen({ navigate }: { navigate: (s: Screen) => void }) {
  const [city, setCity] = useState("Colombo");
  const [style, setStyle] = useState<TravelStyle>("comfort");

  const hotels = (HOTELS_BY_CITY[city] || []).filter((h) => h.type === style);

  return (
    <div style={{ background: "#EEF2FA", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(160deg, ${NAVY} 0%, #1D2E6B 100%)`, padding: "52px 24px 32px" }}>
        <p style={{ color: GOLD, fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.1em", marginBottom: 8 }}>ACCOMMODATIONS</p>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "2rem", fontWeight: 900, color: "#fff", lineHeight: 1.15 }}>
          Where to Stay
        </h1>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.85rem", lineHeight: 1.6, marginTop: 8 }}>
          Curated picks across all budgets, with honest price ranges and local tips.
        </p>
      </div>

      <div style={{ padding: "24px" }}>
        {/* Style filter */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {STYLES.map((s) => (
            <button
              key={s}
              onClick={() => setStyle(s)}
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
              onClick={() => setCity(c)}
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

        {/* Hotel cards */}
        {hotels.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#9CA3AF" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🔍</div>
            <p style={{ fontWeight: 600 }}>No {STYLE_LABELS[style]} hotels listed for {city} yet.</p>
            <p style={{ fontSize: "0.82rem", marginTop: 6 }}>Try a different city or style.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {hotels.map((hotel, i) => (
              <div
                key={i}
                style={{
                  background: "#fff", borderRadius: 20,
                  boxShadow: "0 4px 20px rgba(11,19,64,0.07)",
                  border: "1px solid rgba(11,19,64,0.05)",
                  overflow: "hidden",
                }}
              >
                {/* Color band by style */}
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
                      <div style={{ color: NAVY, fontWeight: 800, fontSize: "1.1rem", fontFamily: "'Playfair Display', serif" }}>
                        ${hotel.priceUSD}
                      </div>
                      <div style={{ color: "#9CA3AF", fontSize: "0.7rem" }}>per night</div>
                    </div>
                  </div>

                  {/* Stars */}
                  <div style={{ display: "flex", gap: 3, marginBottom: 12 }}>
                    {Array.from({ length: hotel.stars }).map((_, si) => (
                      <Star key={si} size={12} fill={GOLD} color={GOLD} />
                    ))}
                    {Array.from({ length: 5 - hotel.stars }).map((_, si) => (
                      <Star key={si} size={12} fill="none" color="#E5E7EB" />
                    ))}
                  </div>

                  {/* Amenities */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: hotel.tip ? 12 : 0 }}>
                    {hotel.amenities.map((a) => (
                      <span
                        key={a}
                        style={{
                          display: "flex", alignItems: "center", gap: 4,
                          background: "rgba(11,19,64,0.04)", color: "#4B5563",
                          borderRadius: 100, padding: "4px 10px",
                          fontSize: "0.72rem", fontWeight: 600,
                        }}
                      >
                        {AMENITY_ICONS[a] || null}
                        {a}
                      </span>
                    ))}
                  </div>

                  {/* Local tip */}
                  {hotel.tip && (
                    <div style={{
                      background: "rgba(201,162,39,0.08)", borderRadius: 10,
                      padding: "10px 12px",
                      display: "flex", alignItems: "flex-start", gap: 8,
                    }}>
                      <span style={{ fontSize: "0.85rem" }}>💡</span>
                      <p style={{ color: "#92400E", fontSize: "0.76rem", lineHeight: 1.5, margin: 0 }}>
                        <strong>Tip:</strong> {hotel.tip}
                      </p>
                    </div>
                  )}

                  {/* Book button */}
                  <button
                    style={{
                      width: "100%", marginTop: 14,
                      background: `linear-gradient(135deg, ${GOLD}, #E8C547)`,
                      color: NAVY, border: "none", borderRadius: 12,
                      padding: "12px", fontWeight: 700, fontSize: "0.85rem",
                      cursor: "pointer",
                    }}
                  >
                    Check Availability →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Budget note */}
        <div style={{
          background: `linear-gradient(135deg, ${NAVY}08, ${TEAL}08)`,
          border: `1px solid ${TEAL}20`,
          borderRadius: 16, padding: "16px 18px", marginTop: 24,
        }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: "1.2rem" }}>🧭</span>
            <div>
              <p style={{ color: NAVY, fontWeight: 700, fontSize: "0.85rem", marginBottom: 4 }}>RouteLanka Booking Tip</p>
              <p style={{ color: "#4B5563", fontSize: "0.78rem", lineHeight: 1.6, margin: 0 }}>
                Always book directly with small guesthouses for better rates. For chain hotels, Booking.com usually beats the hotel's own website in Sri Lanka.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
