# WanderRoute — project guide for AI assistants

Read this first. It describes how the app actually works today (updated 21 Nov 2026), which differs from the README and the older `docs/` notes in places.

## What it is
A React + Vite single-page app that plans Sri Lanka trips. The user sets budget, days, travellers, cities, interests, and style; the app asks an LLM for a day-by-day itinerary, shows it with maps, costs, hotels, and a PDF, and saves trips locally and to Supabase. Live at https://wanderroute.vercel.app (Vercel free Hobby plan), deployed automatically from `main` on GitHub `menogt/wanderroute`. Netlify was retired in Nov 2026 when its credits ran out; the `hosting/digitalocean` branch is abandoned, so push only to `main`.

## Commands
```bash
npm run dev        # Vite on http://localhost:5173 (no API functions locally)
npm start          # node server.mjs: serves dist/ plus /api/* from netlify/functions (PORT, server env vars)
npm run build      # production build to dist/
npm test           # node --test src/**/*.test.ts  (Node 22.6+, no test packages)
npx tsc --noEmit -p tsconfig.json
```
There is no lint step. `tsconfig` has `strict: false`. Files use CRLF line endings; keep them.

## Architecture in one paragraph
Everything lives in `src/app`. `App.tsx` owns screen state, the current itinerary, and `handleGenerate`. Screens are in `components/rl/` (`HomeScreen` quick form, `PlannerScreen` five-step wizard, `ItineraryScreen`, `CostBreakdownScreen`, `MapScreen` explorer, `HotelsScreen`, `RoutesScreen`, `ShareScreen`, `AdminScreen`). Shared logic is in `lib/` and `hooks/`. Styles are plain CSS in `src/styles` using `wr-*` class names and `--wr-*` variables from `theme.css`. Server handlers live in `netlify/functions` (Netlify `event` signature). On Vercel each is wrapped by a one-line file in `api/` via `api/_netlify.js`; `vercel.json` sets the build, a 30 s function limit and the SPA rewrite. `server.mjs` does the same for any Node host.

## Two planners
- **Planning V2 (main, `/?plan`, the homepage form).** `planRouteConcepts` (`lib/planningV2.ts`) builds route options from an OSRM road matrix, checks arrival and departure flight times (adds a Negombo last night when a distant final stop cannot reach CMB in time), then `generatePlanningV2Itinerary` asks `/api/generate-v2-itinerary` to pick places, schedules days and builds the cost ledger. The draft lives in localStorage `wanderroute_planning_draft_v1` with undo history.
- **Classic Planner.** `App.tsx` `handleGenerate` → `aiService.ts` → `/api/generate-itinerary`; on any error it falls back to the offline generator in `components/rl/data.ts` with a toast. `resolveCities` (`lib/cityPlan.ts`) fixes the route first. It holds the only quote form.

AI keys are server-only (`GROQ_API_KEY`); nothing AI-related is in the browser bundle. AI failures show in the Vercel function logs, and V2 then shows a "Limited draft".

V2 asks Groq `openai/gpt-oss-120b`, then the free backups `openai/gpt-oss-20b` and `qwen/qwen3.8-27b` (each has its own 8K tokens/min limit, so about 3 full plans a minute in total; `GROQ_FALLBACK_MODEL` takes `none` or a comma-separated list), then OpenRouter only if `OPENROUTER_API_KEY` is set (paid; leave unset). Llama 3.x and Qwen3-32B were shut down by Groq in 2026; check console.groq.com/docs/deprecations before adding models. Reasoning options are per model (`groqOptions`). A successful reply carries an `X-WanderRoute-Model` header naming the model. The prompt's per-day place limit must match `validateModel` in the same file.

## Route rules (benchmarked against 24 Sri Lankan operator itineraries, Nov 2026)
- `lib/routeStayPolicy.ts`: typical maximum nights per base (2 inland, 3 at Sigiriya or the beach, 4 at the beach on 13+ day trips, +1 for slower paces) and the 210-minute limit for first/last airport drives. Extra nights become `LONG_STAY` penalties; long airport drives become `LONG_AIRPORT_DRIVE`.
- `lib/routeFill.ts`: chosen cities are must-sees. When they cannot carry the nights, classic-loop stops are added (`requested: false`): a coastal finish within reach of CMB first, then the stops operators use most. `services.exactCities` turns this off.
- Scoring prefers the canonical loop direction (Cultural Triangle → hills → coast); a last night in Negombo closes the loop. Alternatives with long stays or airport drives are shown only to keep a choice of two.
- `lib/roadTimeSnapshot.ts` (generated) and `lib/roadSnapshotMatrix.ts`: OSRM road times stored on 2026-11-21 for every planner town and CMB, used only when the live OSRM demo server fails (the plan says so).
- `lib/roadTimeCorrection.ts`: OSRM assumes free-flowing roads (about 48 km/h in the hills). Live and stored matrices are converted to realistic Sri Lankan car times (hills 27 km/h, hill↔lowland 42, Kandy↔lowland 38, lowland 45, expressway legs OSRM +5%; never faster than OSRM), calibrated on transfer-operator times. Only the default road provider is corrected; tests that pass `getMatrix` supply their own times.
- `splitLongLegs` (in `routeFill.ts`) adds an in-between loop stop with place data when a leg exceeds the preferred driving day (Kandy → Nuwara Eliya → Ella). Neutral ranking now counts long driving days for every traveller.

## Places first
Both forms start with `rl/PlacePicker.tsx`: popular landmarks (`MUST_SEE`) as photo cards, a Supabase name search, and "Or just pick towns". `lib/requestedPlaces.ts` derives `requestedCities` from the chosen places; the brief carries optional `requestedPlaces` (schemaVersion stays 1). Chosen places are guaranteed on the plan: `allocateNights` gives their town enough nights, `assignPinsToDays` fixes each to a day in its town before the AI runs, the AI request marks them `fixed` (the model only fills `chooseUpTo` slots and never repeats them), and leftovers wait in `unscheduledActivities` with a `REQUESTED_PLACE_UNSCHEDULED` warning. Days with no sightseeing time (a 07:00 flight, a late arrival) get no AI candidates.

Photos: `lib/placePhotoCatalog.ts` is generated by `node scripts/fetchPlacePhotos.mjs` (free-licence Wikipedia/Commons photos with credits, matched by name). Other places look up a nearby Wikipedia article at runtime (`lib/placePhotos.ts`, name-matched, free licences only, cached 30 days). Never show a photo without its credit.

## Trip Studio (the trip board)
The generated trip is one editable board in `PlanningV2ItineraryScreen` with parts in `components/rl/board/`: `RouteEditor` (nights −/+, reorder, add/remove towns; applies through `onCustomize`, no AI), `PlacesToVisit`, `BoardDay` (every day as a section of numbered `PlaceCard`s with a ⋯ menu and an add-a-place box), `BoardMap` (all days, pins coloured per day, follows the day being read) and `BoardDnd` (@dnd-kit: drag within a day, between days in the same town, or from Places to visit; uses edit op `place` and `index` on `add`/`restore`). Trip settings opens the older `PlanningCustomizationPanel` for dates, travellers, transport and stays. On phones the map opens full screen from the Map button and closes with its X or Escape; the bottom navigation is slim on the planner and hides while scrolling down (`BottomNav` sets `html[data-bottomnav]`). Phones start with only day 1 open (showing a day from the map, a pin or Today's plan opens it). Between places, `lib/dayTravel.ts` shows travel time (an instant distance estimate, then OSRM road legs, never faster than 22 km/h in hill towns or 28 km/h elsewhere, walks under 1.2 km) and each day links to Google Maps directions (public URL, no key). The loading screen (`GenerationScreen`) shows the four steps, a progress bar and elapsed seconds. `/trip-studio` opens the board when a draft exists; the standalone `tripStudio/TripStudio` is only the blank build-from-scratch studio and must not be linked from a generated trip.

## Prices
`lib/indicativePrices.ts` gives every V2 cost line an ESTIMATED USD range with a source URL and check date (rooms by comfort tier and season, meals, car with driver, CMB taxi fares, train and bus fares, tickets, tuk-tuks, SIM and tips). The homepage "Rough estimate" uses `quickTripEstimate` from the same tables. Traveller-recorded and sourced place prices still win. Ranges were checked 2026-11-21; refresh `PRICES_CHECKED` and the tables every few months. Only USD and LKR budgets convert; other currencies stay "Price to confirm". Test files that check recorded/allowance arithmetic call `setIndicativePricing(false)`.

## Data and persistence
- `lib/tripsDb.ts` saves the whole `GeneratedItinerary` as JSON to localStorage (`wanderroute_current_trip`, `wanderroute_saved_trips`) and upserts it to Supabase `trips.itinerary_json`. New optional fields need no schema change.
- Supabase `places` has 4,840 rows across the 12 picker cities, all with `lat`/`lng`. The `style` column is empty on every row. Six map-only cities (Jaffna, Kalpitiya, Yala, Minneriya, Unawatuna, Anuradhapura) have no rows and are missing from `CANONICAL_CITY_ORDER`.
- The last screen is restored from localStorage key `wanderroute_screen`, so a reload may not land on Home.
- Types are in `components/rl/types.ts`: `TripInputs` (what goes to the AI) and `GeneratedItinerary` (what is rendered and saved) are deliberately separate.

## External services and their limits
| Service | Used by | Limit or cost |
|---|---|---|
| Groq | `/api/generate-v2-itinerary`, `/api/generate-itinerary` | Free tier, 8,000 tokens/min **per model**. One itinerary is about 6k tokens, so about one generation per minute per model; the 20b backup roughly doubles burst capacity. Space live tests a minute apart. |
| Vercel functions | everything under `/api/*` | Free Hobby plan; tests mock `fetch` and never call the live API. |
| Foursquare via proxy | day map geocoding (6-8 calls per day viewed), Explore nearby search (up to 18 per click), admin seeder (60 per run) | Cached 7-14 days in localStorage only; the cache clears itself entirely when storage is full |
| Supabase | trips, places, quote requests | Anon key in the client; fine to query REST directly for checks |
| Esri World Topo tiles | every map, via `TILE_LAYER` in `mapConfig.ts` | Free with attribution, no key. Do not switch back to CARTO: its tiles now carry an "API KEY REQUIRED" watermark |
| OSRM demo server | `lib/osrmRoute.ts` road routes | Public demo, no key, cached in localStorage; falls back to straight lines |

Testing Groq or Supabase directly from a script is fine; read keys from the owner's `.env` (server names such as `GROQ_API_KEY`, no `VITE_` prefix). Never print key values.

## Maps
All pins come from `components/rl/mapPins.ts` and `styles/map-pins.css`: `createCategoryPin`, `createStopPin`, `createHotelPin`, `createStayPin`, `createPlacePin`, plus `ROUTE_UNDERLAY` for the navy line drawn under the gold route. `leafletSetup.ts` only provides side effects now. The UI looks up icon and colour by item `category` with no fallback, so categories must be one of `transport`, `activity`, `meal`, `accommodation`; both generators normalise them.

## Design language
The homepage (`HomeScreen` with `rl/home/`, styles in `home-landing.css`) is a landing page: a film hero, the classic loop as four stops with a scroll-drawn route line and "Add to my trip" buttons that fill the quick planner, a seasons band, the quick planner, and a final call. Media lives in `public/home/`: the hero film is four Pexels clips verified as filmed in Sri Lanka (Nine Arches 32629871, Sigiriya 36373731, Mirissa 34100516, railway 32630178), cut and graded with ffmpeg into `hero-1080.mp4` (about 7 MB) and a vertical `hero-phone.mp4` (about 4 MB); stills are A.Savin's Wikimedia Commons featured photos under the Free Art License, credited on the page. Parallax and the route line come from `useLandingMotion` (CSS variables, off with reduced motion); the film shows its still frame with reduced motion or data saver.

Premium "Living Sri Lanka Atlas" look: navy `--wr-midnight`, ivory `--wr-ivory`, gold `--wr-gold`, serif `Fraunces` headings, mono eyebrows. Follow `.agents/skills/wanderroute-premium-ui/SKILL.md`. Existing notice patterns to copy: `.wr-itinerary-notice`, `.wr-toast`, `.wr-season-banner`. New features go in new files; touch existing files only to wire them in.

## Working agreements with the owner
- Propose changes and wait for a go-ahead before editing, committing or pushing. The owner is a student on free tiers: flag anything that could cost money.
- Show the true error and the diff before fixing. Diagnose first, then change.
- Before any `git push`, state the remote, branch, and commit author. Pushes may be blocked by the permission classifier; if so, hand over a runnable `git push` block instead of retrying.
- Small steps. Verify with `tsc`, `npm test`, `npm run build`, and a browser check on the dev server where the change is visible. The in-app browser pane's screenshots of the itinerary page are unreliable; verify that page through the DOM.
- Commit messages end with the Co-Authored-By line for Claude.

## Open work, in priority order
Feature ideas from a Wanderlog review (best order within a day, Poya warnings, offline, bookings, sharing; day links and travel times are done) are listed in `docs/wanderlog-review-backlog.md`; nothing there is built.

1. Rotate the Groq, Foursquare, Resend and OpenRouter keys (they were exposed in a chat) and update Vercel env vars.
2. Supabase-first geocoding in `foursquareGeocoder.ts` to cut API calls; evict old cache entries instead of clearing.
3. Add the six map-only cities to the canonical circuit and seed their places.
4. Pace option (relaxed two nights per stop vs fast one per day) and "Day 2 of 2" labels; weight spare days by city instead of padding Negombo.
5. Populate `places.style` or drop the style filter; audit mis-tagged temples.
6. V2: keep the good parts of an AI plan when editing; count V2 drafts in "Saved Trips"; show the AI's day notes.
7. Minor: `TripsDrawer` `inert` warning, Explore legend still shows dots, split the large build chunk.
