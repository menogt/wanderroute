// Builds src/app/lib/placePhotoCatalog.ts: one freely licensed Wikipedia/Wikimedia Commons photo per
// MUST_SEE landmark, with its credit. Run by hand when the landmark list changes:
//   node scripts/fetchPlacePhotos.mjs
// Only photos under free licences (CC, public domain, GFDL, Free Art License) are kept; anything else falls back to an icon.
import fs from "node:fs";
import { MUST_SEE } from "../src/app/lib/curatedPlaces.ts";
import { CITY_COORDS } from "../src/app/components/rl/mapConfig.ts";

const API = "https://en.wikipedia.org/w/api.php";
const HEADERS = { "User-Agent": "WanderRoute trip planner (https://wanderroute.vercel.app)" };
const MAX_KM = 45;
// Article titles for names that a plain search would match poorly.
const TITLES = {
  "Kandy|Temple of the Sacred Tooth Relic": "Temple of the Tooth",
  "Kandy|Royal Botanical Gardens Peradeniya": "Royal Botanical Gardens, Peradeniya",
  "Kandy|Kandy Cultural Dance Show": "Kandyan dance",
  "Kandy|Kandy Lake": "Kandy Lake",
  "Ella|Nine Arches Bridge": "Nine Arch Bridge",
  "Ella|Little Adam's Peak": "Little Adam's Peak",
  "Ella|Ravana Falls": "Ravana Falls",
  "Galle|Galle Fort": "Galle Fort",
  "Galle|Galle Lighthouse": "Galle Lighthouse",
  "Sigiriya|Sigiriya Rock Fortress": "Sigiriya",
  "Dambulla|Dambulla Cave Temple": "Dambulla cave temple",
  "Nuwara Eliya|Horton Plains National Park": "Horton Plains National Park",
  "Nuwara Eliya|Gregory Lake": "Lake Gregory",
  "Trincomalee|Koneswaram Temple": "Koneswaram Temple",
  "Trincomalee|Pigeon Island National Park": "Pigeon Island National Park",
  "Arugam Bay|Kumana National Park": "Kumana National Park",
  "Colombo|Gangaramaya Temple": "Gangaramaya Temple",
  "Colombo|Galle Face Green": "Galle Face Green",
  "Colombo|Independence Square": "Independence Memorial Hall",
  "Colombo|National Museum of Colombo": "National Museum of Colombo",
  // Town photos that show the beach itself.
  "Mirissa|Mirissa Beach": "Mirissa",
  "Negombo|Negombo Beach": "Negombo",
  "Hikkaduwa|Hikkaduwa Beach": "Hikkaduwa",
  "Arugam Bay|Arugam Bay Beach": "Arugam Bay",
  "Trincomalee|Nilaveli Beach": "Nilaveli",
  "Negombo|Angurukaramulla Temple": "Angurukaramulla Temple",
  "Sigiriya|Pidurangala Rock": "Pidurangala Rock",
  "Nuwara Eliya|Gregory Lake": "Gregory Lake",
  // A search would return a photo of something else; these keep an icon.
  "Negombo|Negombo Fish Market": null,
  "Sigiriya|Sigiriya Museum": null,
  "Mirissa|Whale Watching Mirissa": null,
};
// A searched page must share a distinctive word with the place name; town names and generic words don't count.
const GENERIC = new Set(["sri", "lanka", "the", "temple", "beach", "park", "national", "view", "viewpoint", "point", "lake", "falls",
  "rock", "hill", "fort", "museum", "market", "show", "reef", "coral", "estate", "tea", "island", "watching", "whale", "cultural", "dance"]);
const distinctive = (text, city) => text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, " ").split(/\s+/)
  .filter(word => word.length >= 4 && !GENERIC.has(word) && !city.toLowerCase().split(" ").includes(word));

// Landmarks with no Wikipedia coordinates: approximate positions (about 1 km), so they still get a map pin.
const APPROXIMATE = {
  "Ella|Little Adam's Peak": [6.8697, 81.0599],
  "Sigiriya|Pidurangala Rock": [7.9668, 80.7612],
  "Colombo|Galle Face Green": [6.9248, 79.8445],
  "Ella|Ella Rock": [6.8568, 81.0414],
  "Nuwara Eliya|Gregory Lake": [6.9589, 80.7786],
  "Nuwara Eliya|Pedro Tea Estate": [6.9664, 80.7954],
  "Sigiriya|Sigiriya Museum": [7.9545, 80.7476],
  "Galle|Jungle Beach": [6.0196, 80.2378],
  "Negombo|Angurukaramulla Temple": [7.2119, 79.8393],
  "Mirissa|Whale Watching Mirissa": [5.9452, 80.4583],
  "Hikkaduwa|Hikkaduwa Coral Reef": [6.1338, 80.0986],
};

const km = ([a, b], [c, d]) => {
  const r = Math.PI / 180, dLat = (c - a) * r, dLng = (d - b) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
const strip = html => String(html ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const get = async params => {
  const url = `${API}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  return response.json();
};

async function pageFor(city, name) {
  const title = TITLES[`${city}|${name}`];
  if (title === null) return undefined;
  const base = { prop: "pageimages|coordinates|images", piprop: "name", imlimit: "20", redirects: "1" };
  const data = title ? await get({ action: "query", titles: title, ...base })
    : await get({ action: "query", generator: "search", gsrsearch: `${name} ${city} Sri Lanka`, gsrlimit: "5", ...base });
  const pages = (data.query?.pages ?? []).filter(page => !page.missing).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const near = CITY_COORDS[city];
  // A page without a lead image can still have a photo of the place further down.
  for (const page of pages) page.pageimage ??= page.images?.map(image => image.title.replace(/^File:/, ""))
    .find(file => /\.jpe?g$/i.test(file) && !/map|logo|flag|locator/i.test(file));
  const wanted = distinctive(name, city);
  return pages.find(page => page.pageimage && (!page.coordinates?.[0] || !near ||
    km(near, [page.coordinates[0].lat, page.coordinates[0].lon]) <= MAX_KM) &&
    (title || distinctive(page.title, city).some(word => wanted.includes(word))));
}

async function photoFor(page) {
  const data = await get({ action: "query", titles: `File:${page.pageimage}`, prop: "imageinfo",
    iiprop: "url|extmetadata", iiurlwidth: "500" });
  const info = data.query?.pages?.[0]?.imageinfo?.[0];
  const meta = info?.extmetadata ?? {};
  const licence = strip(meta.LicenseShortName?.value);
  if (!info?.thumburl || !/^(cc|public domain|pd|gfdl|fal|free art)/i.test(licence)) return undefined;
  return { url: info.thumburl.split("?")[0], page: info.descriptionurl, credit: strip(meta.Artist?.value).slice(0, 80) || "Unknown author",
    licence, article: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}` };
}

const catalog = {};
const coordinates = {};
const report = [];
for (const [city, names] of Object.entries(MUST_SEE)) {
  for (const name of names) {
    try {
      const page = await pageFor(city, name);
      const photo = page && await photoFor(page);
      if (photo) catalog[`${city}|${name}`] = photo;
      const point = page?.coordinates?.[0];
      // A town's own article (used for its beach) gives the town centre, which is close enough for a pin.
      if (point) coordinates[`${city}|${name}`] = [Math.round(point.lat * 1e4) / 1e4, Math.round(point.lon * 1e4) / 1e4];
      else if (APPROXIMATE[`${city}|${name}`]) coordinates[`${city}|${name}`] = APPROXIMATE[`${city}|${name}`];
      report.push(`${photo ? "OK  " : "NONE"} ${city} | ${name} -> ${page?.title ?? "(no page)"}${photo ? ` [${photo.licence}]` : ""}`);
    } catch (error) {
      report.push(`ERR  ${city} | ${name}: ${error.message}`);
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
}
const checked = new Date().toISOString().slice(0, 10);
const body = `// Generated by scripts/fetchPlacePhotos.mjs on ${checked}. Do not edit by hand.\n` +
  `// Freely licensed photos from Wikipedia / Wikimedia Commons; show the credit with each photo.\n` +
  `export type PlacePhoto = { url: string; page: string; credit: string; licence: string; article: string };\n` +
  `export const PLACE_PHOTOS_CHECKED = "${checked}";\n` +
  `export const PLACE_PHOTOS: Record<string, PlacePhoto> = ${JSON.stringify(catalog, null, 2)};\n` +
  `/** Landmark positions [latitude, longitude] from Wikipedia, or approximate (about 1 km) where it has none. */\n` +
  `export const LANDMARK_COORDINATES: Record<string, [number, number]> = ${JSON.stringify(coordinates)};\n`;
fs.writeFileSync(new URL("../src/app/lib/placePhotoCatalog.ts", import.meta.url), body.replace(/\n/g, "\r\n"));
console.log(report.join("\n"));
console.log(`${Object.keys(catalog).length} photos and ${Object.keys(coordinates).length} positions written`);
