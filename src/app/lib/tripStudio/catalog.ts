import { CITY_COORDS } from "../../components/rl/mapConfig.ts";
import { MUST_SEE } from "../curatedPlaces.ts";
import { CMB_AIRPORT } from "../planningV2Locations.ts";
import type { MatrixLocation } from "../travelTimeMatrix.ts";

export type StudioPlace = { id: string; name: string; town: string; kind: "destination" | "activity"; detail: string };

const detail: Record<string, string> = {
  Colombo: "City walks, markets and museums",
  Negombo: "Lagoon and west coast near the airport",
  Sigiriya: "Rock fortress and a Cultural Triangle base",
  Dambulla: "Cave temples and nearby heritage sites",
  Anuradhapura: "Ancient capital and sacred city",
  Polonnaruwa: "Ruins and temples of the medieval capital",
  Kandy: "Lakeside city and the Temple of the Tooth",
  "Nuwara Eliya": "Tea estates and the high country",
  Ella: "Hill walks, waterfalls and railway scenery",
  Galle: "Fort, heritage streets and the south coast",
  Mirissa: "Beaches and time by the sea",
  Trincomalee: "East coast and a natural harbour",
  Yala: "Safari country. Base pin is Tissamaharama",
  "Arugam Bay": "East coast beaches and surf",
};

const more: Record<string, [number, number]> = {
  // Polonnaruwa town reference, not the CCF ticket entrance.
  Polonnaruwa: [7.9403, 81.0188],
  // Use the service town as a base, rather than the park centroid.
  Yala: [6.2798, 81.2846],
};
const extraActivities: Record<string, string[]> = {
  Anuradhapura: ["Anuradhapura Ancient City"],
  Polonnaruwa: ["Polonnaruwa Ancient City"],
  Yala: ["Yala National Park safari"],
};
export const locations: Record<string, MatrixLocation> = Object.fromEntries(
  Object.keys(detail).map(name => {
    const [latitude, longitude] = more[name] ?? CITY_COORDS[name];
    return [name, { id: name, name, coordinates: { latitude, longitude } }];
  }),
);
locations[CMB_AIRPORT.id] = { ...CMB_AIRPORT, name: "Bandaranaike Airport (CMB), Katunayake" };
// Sri Lanka AIP, VCRI AD 2.2 airport reference point.
locations.MATTALA = {
  id: "MATTALA", name: "Mattala Airport (HRI)",
  coordinates: { latitude: 6 + 17 / 60 + 4.08 / 3600, longitude: 81 + 7 / 60 + 26.86 / 3600 },
};

export const airports = new Set([CMB_AIRPORT.id, "MATTALA"]);
export const studioPlaces: StudioPlace[] = Object.keys(detail).flatMap(town => [
  { id: town, name: town, town, kind: "destination", detail: detail[town] },
  ...(extraActivities[town] ?? MUST_SEE[town] ?? []).map(name => ({
    id: `${town}/${name}`, name, town, kind: "activity" as const, detail: town,
  })),
]);
export const studioPlace = new Map(studioPlaces.map(place => [place.id, place]));
export const isTown = (id: string) => studioPlace.get(id)?.kind === "destination";
export const locationName = (id: string | null) => id === null ? "Not set" : locations[id]?.name ?? id;
