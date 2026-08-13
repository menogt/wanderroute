import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  BedDouble,
  Bookmark,
  Compass,
  LockKeyhole,
  MapPinned,
  Route,
  WandSparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Screen } from "./types";
import "../../../styles/core-ui.css";

const NAV_LINKS: Array<{ key: Screen; label: string; icon: LucideIcon }> = [
  { key: "planner", label: "Plan", icon: WandSparkles },
  { key: "map", label: "Explore", icon: MapPinned },
  { key: "routes", label: "Routes", icon: Route },
  { key: "hotels", label: "Hotels", icon: BedDouble },
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
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const isActive = (key: Screen) => {
    if (key === "planner") {
      return ["planner", "itinerary", "costs", "share"].includes(screen);
    }
    return screen === key;
  };

  return (
    <nav
      className={`wr-topnav${scrolled ? " is-scrolled" : ""}`}
      aria-label="Primary navigation"
    >
      <div className="wr-topnav__inner">
        <button
          type="button"
          className="wr-topnav__brand"
          onClick={() => navigate("home")}
          aria-label="WanderRoute home"
        >
          <span className="wr-brand-mark" aria-hidden="true">
            <Compass size={18} strokeWidth={2.2} />
          </span>
          <span className="wr-topnav__brand-word">
            Wander<span>Route</span>
          </span>
        </button>

        <div className="wr-topnav__links">
          {NAV_LINKS.map(({ key, label, icon: Icon }) => {
            const active = isActive(key);
            return (
              <button
                type="button"
                key={key}
                className={`wr-topnav__link${active ? " is-active" : ""}`}
                onClick={() => navigate(key)}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        <div className="wr-topnav__actions">
          {onOpenTrips && (
            <button
              type="button"
              className="wr-topnav__saved"
              onClick={onOpenTrips}
              aria-label="Open Saved Trips"
            >
              <Bookmark size={15} strokeWidth={1.9} aria-hidden="true" />
              <span className="wr-topnav__saved-full">Saved Trips</span>
              <span className="wr-topnav__saved-short" aria-hidden="true">Saved</span>
            </button>
          )}

          {showAdmin && (
            <button
              type="button"
              className={`wr-topnav__admin${screen === "admin" ? " is-active" : ""}`}
              onClick={() => navigate("admin")}
              aria-label="Open administration"
              aria-current={screen === "admin" ? "page" : undefined}
            >
              <LockKeyhole size={14} strokeWidth={1.8} aria-hidden="true" />
              <span>Admin</span>
            </button>
          )}

          <button
            type="button"
            className="wr-topnav__cta"
            onClick={() => navigate("planner")}
          >
            <span className="wr-topnav__cta-full">Plan My Free Trip</span>
            <span className="wr-topnav__cta-short" aria-hidden="true">Plan trip</span>
            <ArrowUpRight size={15} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>
    </nav>
  );
}
