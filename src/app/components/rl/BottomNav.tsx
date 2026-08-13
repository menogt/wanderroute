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

export function BottomNav({
  screen,
  navigate,
  onOpenTrips,
}: {
  screen: Screen;
  navigate: (s: Screen) => void;
  onOpenTrips?: () => void;
}) {
  const isActive = (key: Screen) => {
    if (key === "home") {
      return screen === "home";
    }
    if (key === "planner") {
      return ["planner", "itinerary", "costs", "share"].includes(screen);
    }
    if (key === "map") {
      return screen === "map" || screen === "routes";
    }
    return screen === key;
  };

  return (
    <nav className="wr-bottomnav" aria-label="Primary mobile navigation">
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
                <Icon size={isPrimary ? 21 : 19} strokeWidth={isPrimary ? 2.1 : 1.8} />
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
            <Bookmark size={19} strokeWidth={1.8} />
          </span>
          <span className="wr-bottomnav__label">Saved</span>
        </button>
      </div>
    </nav>
  );
}
