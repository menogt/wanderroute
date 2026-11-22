import { useEffect, useState } from "react";
import { BedDouble, Bookmark, Compass, Home, MapPinned } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Screen } from "./types";
import "../../../styles/core-ui.css";

type ScreenNavItem = {
  key: Screen;
  label: string;
  icon: LucideIcon;
  isPrimary?: boolean;
};

const NAV_ITEMS: ScreenNavItem[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "map", label: "Explore", icon: MapPinned },
  { key: "planner", label: "Plan", icon: Compass, isPrimary: true },
  { key: "hotels", label: "Hotels", icon: BedDouble },
];

/**
 * On the planner the bar is slimmer and slides away while the traveller scrolls down,
 * coming back on any scroll up, so the trip gets the screen. The state is mirrored on
 * <html data-bottomnav> so floating buttons (the board's Map button) can sit above it.
 */
function useCompactNav(compact: boolean) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    setHidden(false);
    if (!compact) return;
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const nearBottom = window.innerHeight + y >= document.documentElement.scrollHeight - 24;
      if (y < 80 || nearBottom) setHidden(false);
      else if (y > last + 6) setHidden(true);
      else if (y < last - 6) setHidden(false);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [compact]);
  const state = !compact ? "full" : hidden ? "hidden" : "compact";
  useEffect(() => {
    document.documentElement.dataset.bottomnav = state;
    return () => { delete document.documentElement.dataset.bottomnav; };
  }, [state]);
  return { hidden: compact && hidden, show: () => setHidden(false) };
}

export function BottomNav({
  screen,
  navigate,
  onOpenTrips,
}: {
  screen: Screen;
  navigate: (s: Screen) => void;
  onOpenTrips?: () => void;
}) {
  const compact = screen === "planning-v2";
  const { hidden, show } = useCompactNav(compact);
  const isActive = (key: Screen) => {
    if (key === "home") {
      return screen === "home";
    }
    if (key === "planner") {
      return ["planner", "classic-planner", "planning-v2", "itinerary", "costs", "share"].includes(screen);
    }
    if (key === "map") {
      return screen === "map" || screen === "routes";
    }
    return screen === key;
  };

  return (
    <nav className={`wr-bottomnav${compact ? " is-compact" : ""}${hidden ? " is-hidden" : ""}`} aria-label="Primary mobile navigation" onFocus={show}>
      <div className="wr-bottomnav__inner">
        {NAV_ITEMS.map(({ key, label, icon: Icon, isPrimary }) => {
          const active = isActive(key);
          return (
            <button
              type="button"
              key={key}
              className={`wr-bottomnav__item${isPrimary ? " is-primary" : ""}${active ? " is-active" : ""}`}
              onClick={() => navigate(key)}
              aria-current={active ? "page" : undefined}
              aria-label={isPrimary ? "Plan a trip" : label}
            >
              <span className="wr-bottomnav__icon" aria-hidden="true">
                <Icon size={compact ? 18 : isPrimary ? 21 : 19} strokeWidth={isPrimary ? 2.1 : 1.8} />
              </span>
              <span className="wr-bottomnav__label">{label}</span>
            </button>
          );
        })}

        <button
          type="button"
          className="wr-bottomnav__item"
          onClick={onOpenTrips}
          disabled={!onOpenTrips}
          aria-label="Open Saved Trips"
        >
          <span className="wr-bottomnav__icon" aria-hidden="true">
            <Bookmark size={compact ? 18 : 19} strokeWidth={1.8} />
          </span>
          <span className="wr-bottomnav__label">Saved</span>
        </button>
      </div>
    </nav>
  );
}
