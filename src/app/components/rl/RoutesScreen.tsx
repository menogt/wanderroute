import { ArrowRight, Clock, Star } from "lucide-react";
import { MapContainer, TileLayer, Marker, Polyline } from "react-leaflet";
import { POPULAR_ROUTES } from "./data";
import { getCityCoords, MARKER_COLORS } from "./mapConfig";
import { createColorMarker } from "./leafletSetup";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import type { Screen } from "./types";

const NAVY = "#0B1340";
const GOLD = "#C9A227";
const TEAL = "#0D9488";

function MiniRouteMap({ cities }: { cities: string[] }) {
  const positions = cities.map(getCityCoords).filter(Boolean) as [number, number][];
  if (positions.length < 2) return null;

  // Calculate center as midpoint of all positions
  const centerLat = positions.reduce((s, p) => s + p[0], 0) / positions.length;
  const centerLng = positions.reduce((s, p) => s + p[1], 0) / positions.length;

  return (
    <div style={{
      height: 130, borderRadius: 12, overflow: "hidden",
      margin: "14px 20px 0",
      border: "1px solid rgba(11,19,64,0.08)",
    }}>
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={6}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        touchZoom={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Polyline
          positions={positions}
          pathOptions={{ color: "#C9A227", weight: 2, dashArray: "5 4", opacity: 0.9 }}
        />
        {cities.map((city, i) => {
          const coords = getCityCoords(city);
          if (!coords) return null;
          const color = i === 0 ? MARKER_COLORS.ancient : i === cities.length - 1 ? MARKER_COLORS.beach : MARKER_COLORS.city;
          return <Marker key={city} position={coords} icon={createColorMarker(color, 10)} />;
        })}
      </MapContainer>
    </div>
  );
}

const typeColors: Record<string, string> = {
  "Culture + Beach": TEAL,
  "History + Beach": "#6366F1",
  "Mountains + Tea": "#10B981",
  "Colonial + Beach": "#8B5CF6",
  "Wildlife + History": "#D97706",
  "City + Beach": "#0EA5E9",
  "Ancient History": "#9333EA",
  "Surf + Beach": "#14B8A6",
};

export function RoutesScreen({ navigate }: { navigate: (s: Screen) => void }) {
  const bp = useBreakpoint();
  const isDesktop = bp === "desktop";
  const isTabletPlus = bp === "tablet" || bp === "desktop";

  const cols = isDesktop ? 3 : isTabletPlus ? 2 : 1;

  return (
    <div style={{ background: "#EEF2FA", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(160deg, ${NAVY} 0%, #1D2E6B 100%)`, padding: isTabletPlus ? "40px 32px 32px" : "52px 24px 32px" }}>
        <p style={{ color: GOLD, fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.1em", marginBottom: 8 }}>DISCOVER</p>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: isDesktop ? "2.8rem" : "2rem", fontWeight: 900, color: "#fff", lineHeight: 1.15, marginBottom: 10 }}>
          Sri Lanka<br />Travel Routes
        </h1>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: isDesktop ? "1rem" : "0.85rem", lineHeight: 1.6 }}>
          8 iconic circuits covering the best of the island. Each route is optimised for budget efficiency.
        </p>
      </div>

      <div style={{
        padding: isTabletPlus ? "32px" : "24px",
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 20,
      }}>
        {POPULAR_ROUTES.map((route) => (
          <div
            key={route.key}
            style={{
              background: "#fff", borderRadius: 20,
              boxShadow: "0 4px 24px rgba(11,19,64,0.08)",
              overflow: "hidden",
              border: "1px solid rgba(11,19,64,0.05)",
            }}
          >
            {/* Gradient header */}
            <div style={{ background: route.gradient, padding: "24px 20px 20px", position: "relative" }}>
              <div style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
              <div style={{ fontSize: "2.2rem", marginBottom: 10 }}>{route.image}</div>

              {/* Type badge */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                background: "rgba(255,255,255,0.12)", borderRadius: 100,
                padding: "4px 10px", marginBottom: 10,
              }}>
                <span style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.05em" }}>
                  {route.type.toUpperCase()}
                </span>
              </div>

              <h2 style={{ color: "#fff", fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: "1.3rem", marginBottom: 8, lineHeight: 1.2 }}>
                {route.name}
              </h2>
              <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.82rem", lineHeight: 1.5, margin: 0 }}>
                {route.description}
              </p>
            </div>

            {/* Route city path */}
            <div style={{ padding: "18px 20px 0", display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap" }}>
              {route.cities.map((city, ci) => (
                <div key={ci} style={{ display: "flex", alignItems: "center" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: "50%",
                      background: ci === 0 ? GOLD : ci === route.cities.length - 1 ? TEAL : NAVY,
                      border: `2px solid ${ci === 0 ? GOLD : ci === route.cities.length - 1 ? TEAL : NAVY}`,
                      margin: "0 auto 4px",
                    }} />
                    <span style={{ color: NAVY, fontSize: "0.7rem", fontWeight: 700, whiteSpace: "nowrap" }}>{city}</span>
                  </div>
                  {ci < route.cities.length - 1 && (
                    <div style={{
                      width: 28, height: 2,
                      background: `linear-gradient(90deg, ${NAVY}40, ${GOLD}60)`,
                      marginBottom: 14, flexShrink: 0,
                      marginLeft: 4, marginRight: 4,
                    }} />
                  )}
                </div>
              ))}
            </div>

            {/* Meta info */}
            <div style={{ display: "flex", gap: 16, padding: "16px 20px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Clock size={13} color="#6B7280" />
                <span style={{ color: "#6B7280", fontSize: "0.78rem" }}>{route.duration}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Star size={13} fill={GOLD} color={GOLD} />
                <span style={{ color: "#6B7280", fontSize: "0.78rem" }}>4.9 (200+ trips)</span>
              </div>
            </div>

            {/* Highlights */}
            <div style={{ padding: "14px 20px 0" }}>
              <p style={{ color: "#9CA3AF", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 8 }}>HIGHLIGHTS</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {route.highlights.map((h, hi) => (
                  <div key={hi} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: GOLD, marginTop: 6, flexShrink: 0 }} />
                    <span style={{ color: "#4B5563", fontSize: "0.8rem", lineHeight: 1.5 }}>{h}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div style={{ display: "flex", gap: 6, padding: "14px 20px 0", flexWrap: "wrap" }}>
              {route.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    background: "rgba(11,19,64,0.05)", color: NAVY,
                    borderRadius: 100, padding: "4px 10px",
                    fontSize: "0.72rem", fontWeight: 600,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Mini route map */}
            <MiniRouteMap cities={route.cities} />

            {/* Price + CTA */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 20px" }}>
              <div>
                <span style={{ color: "#6B7280", fontSize: "0.75rem" }}>Budget traveller from</span>
                <div style={{ color: NAVY, fontWeight: 800, fontSize: "1.2rem", fontFamily: "'Playfair Display', serif" }}>
                  ${route.fromPrice}
                  <span style={{ color: "#9CA3AF", fontWeight: 500, fontSize: "0.75rem", fontFamily: "inherit" }}> /person</span>
                </div>
              </div>
              <button
                onClick={() => navigate("planner")}
                style={{
                  background: `linear-gradient(135deg, ${GOLD}, #E8C547)`,
                  color: NAVY, fontWeight: 800, fontSize: "0.85rem",
                  border: "none", borderRadius: 12, cursor: "pointer",
                  padding: "12px 18px",
                  display: "flex", alignItems: "center", gap: 8,
                  boxShadow: "0 4px 16px rgba(201,162,39,0.3)",
                }}
              >
                Plan This Route
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
