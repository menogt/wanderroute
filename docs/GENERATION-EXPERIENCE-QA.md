# Itinerary generation experience verification

Verified locally on 27 October 2026. Scope: generation feedback, transitions, cancellation and retained choices. No pricing engine, quote integration or map redesign.

## Diagnosis and history

Compared the recoverable public V2 version at `d3eb493`, the itinerary-first change at `3722836`, and the starting release at `4a83620` using Git and isolated Chrome sessions.

- Classic had an animated gold route and island mark on a navy atlas background. V2 never used that opener.
- Earlier V2 exposed route comparison and a separate detailed-generation action. The itinerary-first change bypassed those interstitial steps but retained only a disabled “Checking routes…” button throughout routing, place lookup and AI generation. Quick planning unexpectedly opened the full form while waiting.
- Classic delayed generation by 1.6 seconds, then rotated messages on a timer, including unsupported cost-checking claims. Its fallback notice disappeared after 4.5 seconds. Navigation did not invalidate Classic generation.

## Focused repair

Both planners now use the atlas opener, with the submitted trip summary, actual-operation messages and a return-to-choices action. Navigation remains available. Results appear immediately when ready; the brief arrival transition never delays rendering. Reduced motion leaves a static, visible route illustration.

A synchronous request gate prevents duplicate starts. Cancellation aborts AI requests and prevents late responses from changing screens, publishing fallback drafts or saving Classic trips. Place lookup and AI waits are bounded. Submitted form values and prior usable V2 drafts survive cancellation. Classic records AI versus standard generation provenance in newly saved itineraries, keeping the fallback notice visible when those trips are reopened. Older saved trips remain readable without inventing their provenance.

## Validation

- `npm test`: 170 passed, zero failures.
- `npx tsc --noEmit -p tsconfig.json`: passed.
- `npm run build`: passed. Existing large-chunk and mixed dynamic/static import warnings remain.
- `git diff --check`: passed. Reviewed all changed source and new files; no environment files or credentials included. Existing `.claude/` excluded and untouched.
- 20 isolated browser checks passed: quick entry, detailed-form inputs, immediate opener, duplicate submission, successful validated response, limited draft, network failure, retry, cancellation during lookup, navigation during AI, retained inputs, mobile, reduced motion, Classic generation/cancellation/fallback/retry, persistent fallback label and no late Classic save. No uncaught browser errors.
- 26 regression checks passed: V2 primary and Classic secondary, detailed-form generation, activity add/remove/replace/reorder/move/duration edits, stable identities, undo/redo, reload recovery, allowances, stay editing, recorded room rates, locked bookings, destination/night customization, finalization, current-plan PDF and stale-PDF invalidation. Desktop 1440px, tablet 820px and phone 390px interactions passed with no horizontal overflow.
- Real OSRM road response returned HTTP 200 with 161-segment geometry; dotted road styling remains unchanged.

Local AI success uses controlled valid responses. Service and network failures are simulated. Local tests do not prove live Groq functionality. All local database writes were intercepted. Remote font requests were blocked in deterministic screenshot comparisons; fallback fonts were used. No production quote, booking, payment or database-write testing was performed.

## Evidence

Captured outside the application repository in the workspace `implementation/generation-opener/` folder:

- `previous-classic-opener.png`, `previous-v2-loading.png`, `before-v2-loading.png`: historical comparison.
- `after-desktop-opener.png`, `after-desktop-itinerary.png`, `after-limited-draft.png`: V2 flow.
- `after-phone-no-preference.png`, `after-phone-reduce.png`: phone and reduced motion.
- `after-classic-opener.png`, `after-classic-fallback.png`, `after-phone-classic.png`: Classic flow.
- `browser-report.json`: 20 flow checks.
- `regression/browser-release-report.json`: 26 preserved-feature checks, plus screenshots and downloaded PDF.

Production publication must be checked separately after the push. The public browser/deployment reports belong in this same evidence folder; this pre-push record does not claim a successful deployment or live AI response.

## Exact change manifest

- `src/app/App.tsx`
- `src/app/components/rl/GenerationScreen.tsx`
- `src/app/components/rl/HomeScreen.tsx`
- `src/app/components/rl/PlannerScreen.tsx`
- `src/app/components/rl/aiService.ts`
- `src/app/components/rl/types.ts`
- `src/app/lib/generationRequest.ts`
- `src/app/lib/generationRequest.test.ts`
- `src/app/lib/itineraryPlaces.ts`
- `src/app/lib/planningV2Itinerary.ts`
- `src/app/lib/planningV2Itinerary.test.ts`
- `src/app/lib/planningV2ItineraryService.ts`
- `src/styles/atlas-app.css`
- `src/styles/generation.css`
- `docs/GENERATION-EXPERIENCE-QA.md`
