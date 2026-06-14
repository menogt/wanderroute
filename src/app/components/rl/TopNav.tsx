import { useState, useEffect } from "react";
import { Compass, Lock, Home, Map, MapPin, Hotel, Zap, Bookmark } from "lucide-react";
import type { Screen } from "./types";

const NAVY = "#0B1340";
const GOLD = "#C9A227";

const NAV_LINKS: { key: Screen; label: string; icon: React.ReactNode }[] = [
  { key: "home", label: "Home", icon: <Home size={14} /> },
  { key: "routes", label: "Routes", icon: <Map size={14} /> },
  { key: "planner", label: "Plan", icon: <Zap size={14} /> },
  { key: "hotels", label: "Hotels", icon: <Hotel size={14} /> },
  { key: "map", label: "Map", icon: <MapPin size={14} /> },
];

export function TopNav({
  screen,
  navigate,
  showAdmin = false,
  onOpenTrips,
}: {
  screen: Screen;
  navigate: (s: Screen) => void;
  showAdmin?: boolean;
  onOpenTrips?: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const isActive = (key: Screen) => {
    if (key === "home") return screen === "home" || screen === "itinerary" || screen === "costs";
    return screen === key;
  };

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 200,
        background: "#fff",
        borderBottom: "1px solid rgba(11,19,64,0.08)",
        boxShadow: scrolled ? "0 4px 20px rgba(11,19,64,0.10)" : "none",
        transition: "box-shadow 0.3s ease",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "0 32px",
          height: 60,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {/* Logo */}
        <button
          onClick={() => navigate("home")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "none",
            border: "none",
            cursor: "pointer",
            flexShrink: 0,
            marginRight: 16,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              background: GOLD,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Compass size={16} color={NAVY} strokeWidth={2.5} />
          </div>
          <span
            style={{
              color: NAVY,
              fontFamily: "'Playfair Display', serif",
              fontWeight: 800,
              fontSize: "1.15rem",
            }}
          >
            Wander<span style={{ color: GOLD }}>Route</span>
          </span>
        </button>

        {/* Nav links */}
        <div style={{ display: "flex", gap: 2, flex: 1 }}>
          {NAV_LINKS.map(({ key, label, icon }) => {
            const active = isActive(key);
            return (
              <button
                key={key}
                onClick={() => navigate(key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  background: "none",
                  border: "none",
                  borderBottom: active ? `2px solid ${GOLD}` : "2px solid transparent",
                  cursor: "pointer",
                  color: active ? NAVY : "#6B7280",
                  fontWeight: active ? 700 : 500,
                  fontSize: "0.88rem",
                  transition: "all 0.2s",
                  height: 60,
                  borderRadius: 0,
                }}
              >
                <span style={{ color: active ? GOLD : "#9CA3AF" }}>{icon}</span>
                {label}
              </button>
            );
          })}
        </div>

        {/* My Trips (saved itineraries drawer) */}
        {onOpenTrips && (
          <button
            onClick={onOpenTrips}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              background: "rgba(201,162,39,0.12)",
              border: "1px solid rgba(201,162,39,0.3)",
              borderRadius: 8,
              cursor: "pointer",
              color: NAVY,
              fontSize: "0.8rem",
              fontWeight: 700,
              marginRight: 8,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            <Bookmark size={13} color={GOLD} />
            My Trips
          </button>
        )}

        {/* Admin link */}
        {showAdmin && (
          <button
            onClick={() => navigate("admin")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "6px 12px",
              background: screen === "admin" ? "rgba(11,19,64,0.08)" : "rgba(11,19,64,0.04)",
              border: "1px solid rgba(11,19,64,0.08)",
              borderRadius: 8,
              cursor: "pointer",
              color: "#6B7280",
              fontSize: "0.76rem",
              fontWeight: 600,
              marginRight: 8,
            }}
          >
            <Lock size={11} />
            Admin
          </button>
        )}

        {/* CTA */}
        <button
          onClick={() => navigate("planner")}
          style={{
            background: `linear-gradient(135deg, ${GOLD}, #E8C547)`,
            color: NAVY,
            border: "none",
            borderRadius: 10,
            padding: "10px 20px",
            fontWeight: 700,
            fontSize: "0.88rem",
            cursor: "pointer",
            whiteSpace: "nowrap",
            boxShadow: "0 4px 12px rgba(201,162,39,0.25)",
            flexShrink: 0,
          }}
        >
          Plan My Trip →
        </button>
      </div>
    </nav>
  );
}
