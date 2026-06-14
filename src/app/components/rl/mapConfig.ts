// Sri Lanka city coordinates (OpenStreetMap / Leaflet uses [lat, lng])
export const CITY_COORDS: Record<string, [number, number]> = {
  Colombo:       [6.9271,  79.8612],
  Kandy:         [7.2906,  80.6337],
  Ella:          [6.8667,  81.0466],
  Mirissa:       [5.9483,  80.4716],
  Galle:         [6.0535,  80.2210],
  Sigiriya:      [7.9570,  80.7603],
  Negombo:       [7.2084,  79.8358],
  "Nuwara Eliya":[6.9497,  80.7891],
  Dambulla:      [7.8675,  80.6517],
  Trincomalee:   [8.5874,  81.2152],
  Unawatuna:     [6.0100,  80.2490],
  Hikkaduwa:     [6.1395,  80.1055],
  "Arugam Bay":  [6.8406,  81.8360],
  Jaffna:        [9.6615,  80.0255],
  Anuradhapura:  [8.3114,  80.4037],
  Yala:          [6.3728,  81.5213],
  Minneriya:     [8.0348,  80.8996],
  Kalpitiya:     [8.2319,  79.7374],
};

export const SRI_LANKA_CENTER: [number, number] = [7.8731, 80.7718];
export const SRI_LANKA_ZOOM = 7;

// Normalize city name to coords (handles spaces and case differences)
export function getCityCoords(city: string): [number, number] | null {
  return CITY_COORDS[city] ?? null;
}

// Category colors matching WanderRoute brand
export const MARKER_COLORS = {
  city:    "#0B1340", // navy
  beach:   "#0D9488", // teal
  hill:    "#10B981", // green
  ancient: "#C9A227", // gold
  wildlife:"#F59E0B", // amber
};

// City categories for the MapScreen filter
export const CITY_CATEGORIES: Record<string, keyof typeof MARKER_COLORS> = {
  Colombo:       "city",
  Kandy:         "city",
  Galle:         "city",
  Negombo:       "city",
  Trincomalee:   "city",
  Jaffna:        "city",
  Ella:          "hill",
  "Nuwara Eliya":"hill",
  Mirissa:       "beach",
  Unawatuna:     "beach",
  Hikkaduwa:     "beach",
  "Arugam Bay":  "beach",
  Kalpitiya:     "beach",
  Sigiriya:      "ancient",
  Dambulla:      "ancient",
  Anuradhapura:  "ancient",
  Yala:          "wildlife",
  Minneriya:     "wildlife",
};
