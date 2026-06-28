// scripts/importPlaces.mjs
//
// Bulk-import real Sri Lanka places (hotels, restaurants, temples, attractions,
// beaches) from the OpenStreetMap Overpass API into the Supabase `places` table.
//
// - No dotenv: .env is parsed by hand.
// - One Overpass request per city+category, 2s apart (rate-limit friendly).
// - Rows match the `places` schema used by src/app/lib/supabase.ts (DbPlace).
//
// Run from the app folder ("Travel plan app"):
//   node scripts/importPlaces.mjs

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── 1. Parse .env manually (no dotenv) ───────────────────────────────────────
function loadEnv() {
  const envPath = resolve(__dirname, "..", ".env");
  const env = {};
  let raw;
  try {
    raw = readFileSync(envPath, "utf8");
  } catch {
    throw new Error(`Could not read .env at ${envPath}`);
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // Strip surrounding quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── 2. City bounding boxes (centre ± ~6km) ───────────────────────────────────
// Overpass bbox order is (south, west, north, east).
const CITY_CENTERS = {
  Colombo:        [6.9271, 79.8612],
  Kandy:          [7.2906, 80.6337],
  Ella:           [6.8667, 81.0466],
  Galle:          [6.0535, 80.2210],
  Mirissa:        [5.9483, 80.4716],
  Sigiriya:       [7.9570, 80.7603],
  Negombo:        [7.2084, 79.8358],
  "Nuwara Eliya": [6.9497, 80.7891],
  Dambulla:       [7.8675, 80.6517],
  Trincomalee:    [8.5874, 81.2152],
  Hikkaduwa:      [6.1395, 80.1055],
  "Arugam Bay":   [6.8406, 81.8360],
};

const DELTA = 0.06; // ~6.6 km in each direction

function bboxFor(city) {
  const [lat, lng] = CITY_CENTERS[city];
  const south = (lat - DELTA).toFixed(5);
  const west = (lng - DELTA).toFixed(5);
  const north = (lat + DELTA).toFixed(5);
  const east = (lng + DELTA).toFixed(5);
  return `${south},${west},${north},${east}`;
}

// ── 3. Category → OSM selectors + display label ──────────────────────────────
const CATEGORIES = [
  {
    key: "hotel",
    label: "hotels",
    selectors: ['["tourism"~"^(hotel|guest_house|hostel|motel|resort)$"]'],
  },
  {
    key: "restaurant",
    label: "restaurants",
    selectors: ['["amenity"~"^(restaurant|cafe|fast_food)$"]'],
  },
  {
    key: "temple",
    label: "temples",
    selectors: ['["amenity"="place_of_worship"]'],
  },
  {
    key: "attraction",
    label: "attractions",
    selectors: [
      '["tourism"~"^(attraction|museum|viewpoint|artwork|zoo|theme_park|gallery)$"]',
      '["historic"]',
    ],
  },
  {
    key: "beach",
    label: "beaches",
    selectors: ['["natural"="beach"]'],
  },
];

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

function buildQuery(bbox, selectors) {
  // Match nodes and ways for each selector; `out center` gives ways a centroid.
  const body = selectors
    .map((sel) => `node${sel}(${bbox});way${sel}(${bbox});`)
    .join("");
  return `[out:json][timeout:25];(${body});out center 300;`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Map common OSM tags → our amenity chips ──────────────────────────────────
function deriveAmenities(tags) {
  const out = [];
  if (tags.internet_access && tags.internet_access !== "no") out.push("WiFi");
  if (tags["swimming_pool"] === "yes" || tags.leisure === "swimming_pool") out.push("Pool");
  if (tags.air_conditioning === "yes") out.push("AC");
  if (tags.restaurant === "yes" || tags.amenity === "restaurant") out.push("Restaurant");
  if (tags.breakfast === "yes" || tags.breakfast === "included") out.push("Breakfast");
  if (tags.parking === "yes") out.push("Parking");
  return out;
}

// Turn one Overpass element into a `places` row, or null if unusable.
function toPlace(el, city, category) {
  const tags = el.tags || {};
  const name = (tags.name || tags["name:en"] || "").trim();
  if (!name) return null;

  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return null;

  const area =
    tags["addr:suburb"] ||
    tags["addr:city"] ||
    tags["addr:town"] ||
    city;

  const stars = tags.stars ? parseInt(tags.stars, 10) : undefined;

  return {
    name,
    city,
    category,
    lat,
    lng,
    area,
    stars: Number.isFinite(stars) ? stars : undefined,
    description: tags.description || tags["description:en"] || undefined,
    amenities: category === "hotel" ? deriveAmenities(tags) : undefined,
    source: "overpass",
  };
}

// Dedup within a fetch by (name, city) — that's the table's unique constraint,
// so collapsing on it prevents "ON CONFLICT cannot affect row a second time"
// (OSM regularly returns a node + a way, or several points, for one named place).
// city is constant within a batch, so keying on name is equivalent here.
function dedupe(rows) {
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const k = r.name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

// Insert into Supabase. Prefer upsert on (name, city); if that unique
// constraint doesn't exist, fall back to a plain insert so the run still works.
async function insertPlaces(rows) {
  if (rows.length === 0) return { inserted: 0, error: null };

  let { error } = await supabase
    .from("places")
    .upsert(rows, { onConflict: "name,city" });

  if (error && (error.code === "42P10" || /ON CONFLICT/i.test(error.message || ""))) {
    ({ error } = await supabase.from("places").insert(rows));
  }

  if (error) return { inserted: 0, error };
  return { inserted: rows.length, error: null };
}

async function fetchOverpass(query, attempt = 1) {
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      // overpass-api.de returns 406 Not Acceptable without a User-Agent.
      "User-Agent": "WanderRoute/1.0 (Sri Lanka places import)",
    },
    body: "data=" + encodeURIComponent(query),
  });
  if (!res.ok) {
    // 429 (rate limited) and 504 (gateway timeout) are transient — back off once.
    if ((res.status === 429 || res.status === 504) && attempt < 3) {
      await sleep(5000 * attempt);
      return fetchOverpass(query, attempt + 1);
    }
    throw new Error(`Overpass HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.elements || [];
}

// ── 4–6. Main loop ───────────────────────────────────────────────────────────
async function main() {
  console.log(`🌍 Importing places for ${Object.keys(CITY_CENTERS).length} cities → Supabase\n`);

  const totals = { inserted: 0, errors: 0 };
  let first = true;

  for (const city of Object.keys(CITY_CENTERS)) {
    const bbox = bboxFor(city);

    for (const cat of CATEGORIES) {
      // Rate-limit: 2s between every Overpass request (skip before the very first).
      if (!first) await sleep(2000);
      first = false;

      let rows = [];
      try {
        const elements = await fetchOverpass(buildQuery(bbox, cat.selectors));
        rows = dedupe(
          elements.map((el) => toPlace(el, city, cat.key)).filter(Boolean)
        );
      } catch (err) {
        totals.errors++;
        console.log(`📍 ${city} — ${cat.label}: ⚠️ Overpass failed (${err.message})`);
        continue;
      }

      const { inserted, error } = await insertPlaces(rows);
      if (error) {
        totals.errors++;
        console.log(`📍 ${city} — ${cat.label}: ⚠️ Supabase error: ${error.message}`);
      } else {
        totals.inserted += inserted;
        console.log(`📍 ${city} — ${cat.label}: ${inserted} inserted`);
      }
    }
  }

  console.log(`\n🎉 Done. ${totals.inserted} places inserted · ${totals.errors} errors`);
}

main().catch((err) => {
  console.error("❌ Import failed:", err);
  process.exit(1);
});
