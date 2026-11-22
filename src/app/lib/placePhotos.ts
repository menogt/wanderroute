import type { PlacePhoto } from "./placePhotoCatalog.ts";
import { photoForPlace } from "./requestedPlaces.ts";
import type { Coordinates } from "./planningTypes";

/**
 * Photos for place cards. Landmarks use the committed catalog. Other places with coordinates look for a
 * Wikipedia article within 1.5 km whose title shares a distinctive word with the place name, and keep its
 * lead photo only under a free licence. Results (and misses) are cached in this browser for 30 days.
 */
const API = "https://en.wikipedia.org/w/api.php";
const CACHE_PREFIX = "wr_place_photo_v1:";
const CACHE_DAYS = 30;
const GENERIC = new Set(["sri", "lanka", "the", "temple", "beach", "park", "national", "view", "viewpoint", "point",
  "lake", "falls", "rock", "kovil", "church", "road", "hotel", "house", "garden", "gardens", "museum", "fort", "hill",
  "bridge", "trail", "tank", "waterfall", "ella", "kandy", "galle", "colombo", "mirissa", "sigiriya", "negombo", "vihara", "viharaya"]);
const FREE = /^(cc|public domain|pd|gfdl|fal|free art)/i;

const words = (text: string) => text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, " ").split(/\s+/)
  .filter(word => word.length >= 4 && !GENERIC.has(word));
const strip = (html: unknown) => String(html ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

type Cached = { at: number; photo: PlacePhoto | null };
function readCache(key: string): PlacePhoto | null | undefined {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return undefined;
    const cached = JSON.parse(raw) as Cached;
    return Date.now() - cached.at > CACHE_DAYS * 86_400_000 ? undefined : cached.photo;
  } catch { return undefined; }
}
function writeCache(key: string, photo: PlacePhoto | null) {
  try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), photo } satisfies Cached)); } catch { /* storage full or blocked */ }
}

type Fetch = (url: string) => Promise<any>;
const getJson: Fetch = async url => { const response = await fetch(url); if (!response.ok) throw new Error(String(response.status)); return response.json(); };
const query = (params: Record<string, string>) => `${API}?${new URLSearchParams({ format: "json", formatversion: "2", origin: "*", ...params })}`;

/** Looks up a free photo near the place. Never throws; resolves to null when none is suitable. */
export async function findPlacePhoto(name: string, city: string, coordinates?: Coordinates, fetchJson: Fetch = getJson): Promise<PlacePhoto | null> {
  const known = photoForPlace(city, name);
  if (known) return known;
  if (!coordinates) return null;
  const key = `${city}|${name}`;
  const cached = readCache(key);
  if (cached !== undefined) return cached;
  try {
    const nearby = await fetchJson(query({ action: "query", generator: "geosearch", ggscoord: `${coordinates.latitude}|${coordinates.longitude}`,
      ggsradius: "1500", ggslimit: "10", prop: "pageimages", piprop: "name" }));
    const wanted = words(name);
    const page = (nearby?.query?.pages ?? []).find((candidate: any) => candidate.pageimage && wanted.length > 0 &&
      words(candidate.title).some(word => wanted.includes(word)));
    let photo: PlacePhoto | null = null;
    if (page) {
      const file = await fetchJson(query({ action: "query", titles: `File:${page.pageimage}`, prop: "imageinfo",
        iiprop: "url|extmetadata", iiurlwidth: "500" }));
      const info = file?.query?.pages?.[0]?.imageinfo?.[0];
      const licence = strip(info?.extmetadata?.LicenseShortName?.value);
      if (info?.thumburl && FREE.test(licence)) photo = { url: String(info.thumburl).split("?")[0], page: info.descriptionurl,
        credit: strip(info.extmetadata?.Artist?.value).slice(0, 80) || "Unknown author", licence,
        article: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(page.title).replace(/ /g, "_"))}` };
    }
    writeCache(key, photo);
    return photo;
  } catch {
    return null;
  }
}

// At most two lookups run at once, so a long itinerary doesn't flood the Wikipedia API.
let running = 0;
const waiting: (() => void)[] = [];
export async function queuedPlacePhoto(name: string, city: string, coordinates?: Coordinates): Promise<PlacePhoto | null> {
  const known = photoForPlace(city, name);
  if (known || !coordinates) return known ?? null;
  if (running >= 2) await new Promise<void>(resolve => waiting.push(resolve));
  running++;
  try { return await findPlacePhoto(name, city, coordinates); }
  finally { running--; waiting.shift()?.(); }
}
