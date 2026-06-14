import { Home, Map, MapPin, Hotel, Zap } from "lucide-react";
import type { Screen } from "./types";

const NAVY = "#0B1340";
const GOLD = "#C9A227";

type NavItem = {
  key: Screen;
  label: string;
  icon: React.ReactNode;
  isCTA?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { key: "home", label: "Home", icon: <Home size={20} /> },
  { key: "routes", label: "Routes", icon: <Map size={20} /> },
  { key: "planner", label: "Plan", icon: <Zap size={20} />, isCTA: true },
  { key: "hotels", label: "Hotels", icon: <Hotel size={20} /> },
  { key: "map", label: "Map", icon: <MapPin size={20} /> },
];

export function BottomNav({
  screen,
  navigate,
}: {
  screen: Screen;
  navigate: (s: Screen) => void;
}) {
  return (
    <div style={{
      position: "sticky",
      bottom: 0,
      left: 0,
      right: 0,
      background: "#fff",
      borderTop: "1px solid rgba(11,19,64,0.07)",
      display: "flex",
      alignItems: "center",
      padding: "8px 8px 16px",
      zIndex: 100,
      boxShadow: "0 -4px 24px rgba(11,19,64,0.08)",
    }}>
      {NAV_ITEMS.map(({ key, label, icon, isCTA }) => {
        const active =
          key === screen ||
          (key === "map" && screen === "map") ||
          (key === "home" && (screen === "home" || screen === "itinerary" || screen === "costs"));

        if (isCTA) {
          return (
            <button
              key={key}
              onClick={() => navigate(key)}
              style={{
                flex: 1.2,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "none",
                border: "none",
                cursor: "pointer",
                gap: 0,
              }}
            >
              <div style={{
                width: 50, height: 50, borderRadius: 16,
                background: `linear-gradient(135deg, ${GOLD}, #E8C547)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 16px rgba(201,162,39,0.4)",
                transform: "translateY(-8px)",
              }}>
                <Zap size={22} fill={NAVY} color={NAVY} />
              </div>
              <span style={{ color: GOLD, fontSize: "0.62rem", fontWeight: 800, marginTop: -4 }}>
                {label}
              </span>
            </button>
          );
        }

        const isActive = screen === key ||
          (key === "home" && !["routes", "hotels", "map", "planner"].includes(screen));

        return (
          <button
            key={key}
            onClick={() => navigate(key)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              padding: "6px 0",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: isActive ? NAVY : "#9CA3AF",
              transition: "color 0.2s",
            }}
          >
            <div style={{
              padding: "4px 12px",
              borderRadius: 10,
              background: isActive ? "rgba(11,19,64,0.06)" : "transparent",
              transition: "background 0.2s",
            }}>
              {icon}
            </div>
            <span style={{ fontSize: "0.65rem", fontWeight: isActive ? 700 : 500, lineHeight: 1 }}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
