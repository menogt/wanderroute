# WanderRoute — project guide for AI assistants

Read this first. It describes how the app actually works today, which differs from the README in places. Detailed history of recent changes is in `docs/PATCH-2026-09-10.md`.

## What it is
A React + Vite single-page app that plans Sri Lanka trips. The user sets budget, days, travellers, cities, interests, and style; the app asks an LLM for a day-by-day itinerary, shows it with maps, costs, hotels, and a PDF, and saves trips locally and to Supabase. Live at https://wanderroute.netlify.app, deployed automatically from `main` on GitHub `menogt/wanderroute`.

## Commands
```bash
npm run dev        # Vite on http://localhost:5173 (no Netlify functions locally)
npm run build      # production build to dist/
npm test           # node --test src/**/*.test.ts  (Node 22.6+, no test packages)
npx tsc --noEmit -p tsconfig.json
```
There is no lint step. `tsconfig` has `strict: false`. Files use CRLF line endings; keep them.

## Architecture in one paragraph
Everything lives in `src/app`. `App.tsx` owns screen state, the current itinerary, and `handleGenerate`. Screens are in `components/rl/` (`HomeScreen` quick form, `PlannerScreen` five-step wizard, `ItineraryScreen`, `CostBreakdownScreen`, `MapScreen` explorer, `HotelsScreen`, `RoutesScreen`, `ShareScreen`, `AdminScreen`). Shared logic is in `lib/` and `hooks/`. Styles are plain CSS in `src/styles` using `wr-*` class names and `--wr-*` variables from `theme.css`. Netlify functions live in `netlify/functions` and are reached through `/api/*` rewrites in `netlify.toml`.

## Generation flow, and the one thing everyone gets wrong
`App.tsx` imports `generateItineraryWithAI` from `components/rl/claudeApi.ts`, which calls **Groq directly from the browser** with `VITE_GROQ_API_KEY`. The Netlify function `generate-itinerary.js` and its client `aiService.ts` are deployed, tested, and **unused**. Consequences:
- Generation failures never appear in Netlify logs. Look in the browser console for "AI enhancements unavailable".
- On any error the app silently falls back to the offline generator in `components/rl/data.ts` and shows a toast.
- The Groq key is compiled into the public bundle. Planned fix: import from `aiService.ts` instead, set `GROQ_API_KEY` in Netlify, rotate the key.

Model is `openai/gpt-oss-120b` with Groq JSON mode, in both `claudeApi.ts` and the function. Keep the two in sync when changing the prompt.

Order of operations in `handleGenerate`: `resolveCities` from `lib/cityPlan.ts` fixes the route (canonical clockwise order, max six cities, one city per 1.5 days), that resolved list goes to the AI, and the finished itinerary's `cities` is overwritten with it. The optional `travelMonth` is passed separately and never enters `TripInputs`.

## Data and persistence
- `lib/tripsDb.ts` saves the whole `GeneratedItinerary` as JSON to localStorage (`wanderroute_current_trip`, `wanderroute_saved_trips`) and upserts it to Supabase `trips.itinerary_json`. New optional fields need no schema change.
- Supabase `places` has 4,840 rows across the 12 picker cities, all with `lat`/`lng`. The `style` column is empty on every row. Six map-only cities (Jaffna, Kalpitiya, Yala, Minneriya, Unawatuna, Anuradhapura) have no rows and are missing from `CANONICAL_CITY_ORDER`.
- The last screen is restored from localStorage key `wanderroute_screen`, so a reload may not land on Home.
- Types are in `components/rl/types.ts`: `TripInputs` (what goes to the AI) and `GeneratedItinerary` (what is rendered and saved) are deliberately separate.

## External services and their limits
| Service | Used by | Limit or cost |
|---|---|---|
| Groq | `claudeApi.ts` | Free tier, 8,000 tokens/min. One itinerary is 5-7k tokens, so about one generation per minute. Exceeding it returns 429 and triggers the offline fallback. |
| Netlify functions | `/api/foursquare` only, in practice | Free tier 125k invocations/month; was at 50% on 10 Sep 2026. **Never call a Netlify function from tests or scripts.** |
| Foursquare via proxy | day map geocoding (6-8 calls per day viewed), Explore nearby search (up to 18 per click), admin seeder (60 per run) | Cached 7-14 days in localStorage only; the cache clears itself entirely when storage is full |
| Supabase | trips, places, quote requests | Anon key in the client; fine to query REST directly for checks |
| Esri World Topo tiles | every map, via `TILE_LAYER` in `mapConfig.ts` | Free with attribution, no key. Do not switch back to CARTO: its tiles now carry an "API KEY REQUIRED" watermark |
| OSRM demo server | `lib/osrmRoute.ts` road routes | Public demo, no key, cached in localStorage; falls back to straight lines |

Testing Groq or Supabase directly from a script is fine; read keys from `.env` (note some values have a leading space after `=`).

## Maps
All pins come from `components/rl/mapPins.ts` and `styles/map-pins.css`: `createCategoryPin`, `createStopPin`, `createHotelPin`, `createStayPin`, `createPlacePin`, plus `ROUTE_UNDERLAY` for the navy line drawn under the gold route. `leafletSetup.ts` only provides side effects now. The UI looks up icon and colour by item `category` with no fallback, so categories must be one of `transport`, `activity`, `meal`, `accommodation`; both generators normalise them.

## Design language
Premium "Living Sri Lanka Atlas" look: navy `--wr-midnight`, ivory `--wr-ivory`, gold `--wr-gold`, serif `Fraunces` headings, mono eyebrows. Follow `.agents/skills/wanderroute-premium-ui/SKILL.md`. Existing notice patterns to copy: `.wr-itinerary-notice`, `.wr-toast`, `.wr-season-banner`. New features go in new files; touch existing files only to wire them in.

## Working agreements with the owner
- Show the true error and the diff before fixing. Diagnose first, then change.
- Before any `git push`, state the remote, branch, and commit author. Pushes may be blocked by the permission classifier; if so, hand over a runnable `git push` block instead of retrying.
- Small steps. Verify with `tsc`, `npm test`, `npm run build`, and a browser check on the dev server where the change is visible. The in-app browser pane's screenshots of the itinerary page are unreliable; verify that page through the DOM.
- Commit messages end with the Co-Authored-By line for Claude.

## Open work, in priority order
1. Move generation behind the Netlify function and rotate the Groq key.
2. Supabase-first geocoding in `foursquareGeocoder.ts` to cut Netlify usage; evict old cache entries instead of clearing.
3. Add the six map-only cities to the canonical circuit and seed their places.
4. Pace option (relaxed two nights per stop vs fast one per day) and "Day 2 of 2" labels; weight spare days by city instead of padding Negombo.
5. Populate `places.style` or drop the style filter; audit mis-tagged temples.
6. Minor: `TripsDrawer` `inert` warning, Explore legend still shows dots, split the large build chunk.
