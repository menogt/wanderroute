# Architecture and data flow

React 18 + TypeScript + Vite; plain CSS in src/styles; Leaflet/react-leaflet maps; jsPDF export. App.tsx owns screen navigation, Classic result and V2 session. No application framework rewrite is required.

V2 flow: Home/TopNav -> plannerNavigation.ts primary `planning-v2` -> PlanningV2BriefScreen -> planRouteConcepts -> bounded routeCandidates, constraints/scoring/season and OSRM travel-time matrix -> initial concept automatically selected -> trusted candidate places and server activity selections or labeled limited draft -> buildDetailedPlanningResult -> schedulePlanningDays + cost ledger + validatePlanningItinerary -> PlanningV2ItineraryScreen.

The model selects trusted place IDs and short descriptions. It cannot supply authoritative prices, route order, schedule, IDs, bookings or opening hours. Client and Netlify function validate day count, route ID, allowed places and duplicate selections. Groq key stays in the server runtime. Function: netlify/functions/generate-v2-itinerary.js; Classic: generate-itinerary.js through aiService.ts. Netlify rewrites /api/* in netlify.toml. Vite alone does not run functions.

TripBriefV1, PlanningItineraryV2 and transport/cost/evidence types are distinct from Classic GeneratedItinerary. Do not pass V2 into Classic quote/PDF workflows. Unknown costs and unsupported train/bus/tuk-tuk times remain unknown.

Edits: planningV2Editing.ts preserves activity IDs and rebuilds the deterministic schedule/ledger/validation. planningCustomization.ts previews and applies broader trip changes; booked/locked protections, compatible assignments and displaced shortlist. planningExcursions.ts supports return visits on compatible middle days, with outward and return transfer IDs and the same overnight base. Day activity city differs from base city for a visit. All editing, shortlist, map, validation, review and PDF must use that distinction consistently.

planningDraft.ts saves source revisions in browser localStorage key `wanderroute_planning_draft_v1`, schema version 1. Restoring rebuilds totals and validation rather than trusting cached outputs. Current plus up to six past/future revisions persist within a 2,000,000-character serialization cap. In-memory history supports twenty revisions. Storage failures warn; unreadable drafts and unrelated storage are not deleted. This is neither cloud sync nor guaranteed permanent storage.

Maps share mapConfig.ts tiles, mapPins.ts icons and osrmRoute.ts actual road geometry. V2 guards async geometry against changed waypoint sequences. Geometry is a driving overview only, never a train/bus/walking timetable or source for scheduler values. Failed routing shows markers without a fake straight road track. Explore is a destination/place explorer; Classic has separate trip driving and day-route behavior.

planningPresentation.ts produces a detached semantic snapshot shared by review/preferred state/PDF. Exact semantic revision equality controls preference and stale PDF visibility; the short reference is a convenience checksum, not a security signature. planningPDF.ts embeds locally served licensed Vera fonts and uses a public-domain Natural Earth outline for a schematic PDF overview only. Website maps stay interactive and tiled.

Classic App.handleGenerate uses server aiService.ts and safe offline fallback; tripsDb.ts saves browser data and may write Supabase trips. Browser QA must isolate or intercept those writes. Classic quote receipt persistence exists; secondary notification replay/deduplication needs further isolated audit. Do not test real production quote submissions without explicit scope.
