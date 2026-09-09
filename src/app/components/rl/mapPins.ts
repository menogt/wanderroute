// Branded Leaflet pins used by every map: Explore, itinerary route, day
// activity, and hotels. All pins are div icons styled in map-pins.css so hover,
// selection halos, and colours are pure CSS. Icon paths are from lucide (ISC).

import L from "leaflet";
import { MARKER_COLORS, CITY_CATEGORIES } from "./mapConfig";
// Side effect: loads leaflet.css and patches the default icon URLs.
import "./leafletSetup";
import "../../../styles/map-pins.css";

export type PinCategory = keyof typeof MARKER_COLORS;
export type HotelTier = "budget" | "comfort" | "luxury";

const ICON_PATHS: Record<string, string> = {
  city:
    '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
  beach:
    '<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>',
  hill: '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>',
  ancient:
    '<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
  wildlife:
    '<circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/>',
  hotel:
    '<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/>',
  arrival:
    '<path d="M2 22h20"/><path d="M3.77 10.77 2 9l2-4.5 1.1.55c.55.28.9.84.9 1.45s.35 1.17.9 1.45L8 8.5l3-6 1.05.53a2 2 0 0 1 1.09 1.52l.72 5.4a2 2 0 0 0 1.09 1.52l4.4 2.2c.42.22.78.55 1.01.96l.6 1.03c.49.88-.06 1.98-1.06 2.1l-1.18.15c-.47.06-.95-.02-1.37-.24L4.29 11.15a2 2 0 0 1-.52-.38Z"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
  place: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
};

function svg(name: string, strokeWidth = 2.2): string {
  const paths = ICON_PATHS[name] ?? ICON_PATHS.place;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

const HOTEL_TIER_COLORS: Record<HotelTier, string> = {
  luxury: "#C9A227",
  comfort: "#0D9488",
  budget: "#6B7280",
};

const GOLD = "#D4A64A";

/** Category for a city name, falling back to "city" for anything unknown. */
export function categoryForCity(city: string): PinCategory {
  return CITY_CATEGORIES[city] ?? "city";
}

/**
 * Teardrop pin with a category icon. Size is the body diameter; the icon
 * box is a little taller so the tip sits exactly on the coordinate.
 */
export function createCategoryPin(
  category: PinCategory,
  options: { selected?: boolean; size?: number; icon?: string; color?: string } = {}
) {
  const { selected = false, size = 30, icon = category, color } = options;
  const width = Math.round(size * 1.2);
  const height = Math.round(size * 1.47);
  const pinColor = color ?? MARKER_COLORS[category];
  return L.divIcon({
    className: `wr-pin-wrap${selected ? " is-selected" : ""}`,
    html: `<div class="wr-pin wr-pin--drop" style="--pin:${pinColor};--pin-size:${size}px;">
      <span class="wr-pin__halo"></span>
      <span class="wr-pin__body">${svg(icon)}</span>
    </div>`,
    iconSize: [width, height],
    iconAnchor: [width / 2, height],
    popupAnchor: [0, -height + 4],
    tooltipAnchor: [width / 2 - 4, -height / 2 - 2],
  });
}

/** Numbered stop for the day activity map. Colour comes from the item category. */
export function createStopPin(num: number, color: string, options: { active?: boolean } = {}) {
  const { active = false } = options;
  const size = active ? 32 : 28;
  return L.divIcon({
    className: `wr-pin-wrap${active ? " is-selected" : ""}`,
    html: `<div class="wr-pin wr-pin--stop" style="--pin:${color};--pin-size:${size}px;">
      <span class="wr-pin__halo"></span>
      <span class="wr-pin__body">${num}</span>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 4],
    tooltipAnchor: [size / 2 + 2, 0],
  });
}

/** Rounded-square hotel pin tinted by travel-style tier. */
export function createHotelPin(tier: HotelTier, options: { selected?: boolean; color?: string } = {}) {
  const { selected = false, color } = options;
  const size = selected ? 30 : 26;
  const pinColor = selected ? GOLD : color ?? HOTEL_TIER_COLORS[tier];
  return L.divIcon({
    className: `wr-pin-wrap${selected ? " is-selected" : ""}`,
    html: `<div class="wr-pin wr-pin--hotel" style="--pin:${pinColor};--pin-size:${size}px;">
      <span class="wr-pin__halo"></span>
      <span class="wr-pin__body">${svg("hotel")}</span>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size - 2],
    tooltipAnchor: [size / 2 + 2, -size / 2],
  });
}

/** Tonight's stay on the day map: a gold teardrop with a bed icon. */
export function createStayPin() {
  return createCategoryPin("city", { icon: "hotel", color: GOLD, size: 32, selected: true });
}

/** Small dot for discovered places (restaurants, cafes, sights). */
export function createPlacePin(color: string, options: { selected?: boolean } = {}) {
  const { selected = false } = options;
  const size = selected ? 18 : 13;
  return L.divIcon({
    className: `wr-pin-wrap${selected ? " is-selected" : ""}`,
    html: `<div class="wr-pin wr-pin--dot" style="--pin:${color};--pin-size:${size}px;">
      <span class="wr-pin__halo"></span>
      <span class="wr-pin__body"></span>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 2],
    tooltipAnchor: [size / 2 + 2, 0],
  });
}

/** Path options for the route underlay drawn beneath the gold line. */
export const ROUTE_UNDERLAY = { color: "#071A2D", weight: 9, opacity: 0.16, lineCap: "round" as const };
