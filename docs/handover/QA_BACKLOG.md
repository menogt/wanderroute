# QA evidence and backlog

Audit date: 25 October 2026. Keep passing evidence separate from gaps. Never promote a mock response to a successful live integration.

Automated baseline for current milestone: 163 tests pass; TypeScript and production build pass; whitespace clean. Tests cover route/night constraints and seven-vs-ten-day coverage, omitted wishes, cross-day duplicate AI choices, category filtering, schedules/ledger/evidence, visit transfers, stable edit IDs, protections, PDF snapshot semantics and browser-draft recovery/corruption/quota behavior. Actual browser scenarios are recorded below once complete.

Historical real UI checks: M1 desktop/tablet820/phone390 itinerary/map/editing; M2 stays/transport/customization/undo; M3 PDF download after edits/preference invalidation. Latest native UI helper failed with missing computer-use native pipe. Supported existing Playwright + installed Chrome now works; use this to finish current scenarios rather than claiming the old helper still blocks all browser testing.

## Required scenario coverage

Desktop/tablet/phone: primary CTA, Classic, initial planning, meaningful daily detail, day/map selection, search/add/replace/remove/order/move/free time/restore, broader customization, booked/locked rejection, budget recalculation, undo/redo, refresh recovery, PDF, return navigation. Inspect screenshots and usability beyond width/overflow. Check actual road-route request/rendering and outage behavior; never accept merely dotted straight segments as preserved geometry. Isolate all database writes and commercial actions.

## Incomplete product capabilities

1. High: sourced preliminary market price ranges are absent. Current amounts are supported/recorded subtotals plus traveler allowances. Research permitted sources, dates, currency, party/per-person/per-room basis, exclusions and uncertainty before a later pricing feature.
2. High: real Groq generation currently unavailable (last live HTTP500 SERVER_CONFIGURATION,24Oct). Operator configuration and successful real response test required; limited draft mode can remain public with explicit labeling.
3. High: V2 assistance/quote parity is disabled. A future isolated implementation must preserve receipt durability and idempotency, access controls, real notification states, retry behavior and truthful UX. Do not enable incomplete commercial actions.
4. High: Classic secondary quote notification has replay/deduplication risk pending isolated audit; no production replay tests or commercial code changes authorized in this task.
5. Medium: new manually added cities may lack road-matrix evidence. Recompute bounded matrix after route edits without overwriting traveler choices; preserve unknowns until supported.
6. Medium: explicit closed-day opening-hours semantics and complete current catalog quality need more coverage. Guide names/practical duration policies are not verified opening/access data.
7. Medium: full offline map/plan delivery, cross-device draft sync, itinerary sharing and independently verified availability are not implemented by localStorage recovery.
8. Medium: main bundle about1.278MB before gzip; Vite warns about chunks. Improve loading with measured code splitting after correctness gates.
9. Medium: Vera supports tested accents, not complete Sinhala/Tamil shaping. Unsupported characters are explicitly escaped in PDF; do not claim full script support.
10. Low: product copy still contains some historical claims requiring a separate content pass, including homepage wording about V2 drafts staying in-session and Classic example prices. Do not confuse demonstration figures with V2 evidence.

No production requests/bookings/payments/emails are test evidence. Record exact fixture use and every unexecuted scenario.

## Current browser evidence, 25 October 2026

Existing Playwright + installed Chrome, isolated ephemeral contexts; no dependencies installed. Local Supabase URL points to localhost QA, database calls intercepted. Local AI failure is mocked to test limited drafts. Actual OSRM/Esri read-only services were used, not fabricated route geometry. No production trip/quote/booking/payment/email was submitted.

- Desktop1440x1000: primary CTA -> V2; Classic wizard reachable; seven-day draft; two meaningful activities initially; search/add/remove/restore/replace/reorder/move, free time and duration edits. Stored item identities checked through each edit and undo/redo.
- Browser refresh restores draft and recent history. Whole-trip undo/redo restores stays and commitment status. Room rate40 x2 rooms x6 nights produced480 supported recorded subtotal; meal allowance50 x2 people x7 days produced700; combined scenario1180. After changing the recorded stay to changed/cancelled and altering the route, the obsolete room charge was removed and PDF reflected the current700 scenario, not1180.
- Budget/pace/stay/room/rate edits preview/apply. Locked/booked date/night changes rejected before apply. Kandy6 nights -> Kandy4/Ella2 applied after explicitly unlocking and reporting the booking change.
- Real OSRM driving route Kandy->Ella returnedHTTP200 and rendered161 line segments under the original gold/navy styling. A straight connection would have one segment. Tile map visually inspected. Daily return geometry can fail; the markers and honest unavailable message remain. An induced routing outage drew no fake road and left editing usable. Daily geometry is a driving overview, not complete Classic walking-profile parity or selected public-service navigation.
- Tablet820x1180 and phone390x844: actual day selection, add/undo, customization preview/apply/undo. Phone itinerary/map switch, visit editing and readable controls observed. Screenshots inspected; no overflow found, but this conclusion also rests on executed interactions and visible hierarchy, not width alone. Long editor pages still require scrolling; fixed bottom navigation remains visible.
- Per-leg train preference and return visit controls executed. MUST Ella visit on day2 has outward and return items, same Kandy overnight and six total hotel nights. Train times/fares stay unknown; no car timing was relabeled as a train schedule.
- Independent seven-request UI scenarios:7 days included Negombo,Dambulla,Kandy,Ella,Galle with6 nights and explicit Sigiriya/Mirissa omissions;10 days included all7 requested bases,9 nights. No silent omitted-place claim.
- Preferred draft saved with explicit acknowledgment. Editing invalidated preference and hid stale PDF; Undo restored the exact preferred revision. Assistance remained unavailable, no request sent.
- Actual browser PDF downloads: edited route9 pages; return-visit version10 pages. Independent extraction confirms current route, rooms, changed arrangement, visit day and both transfer items. Both PDFs have all text inside page margins. Cover/day render inspected against approved navy/ivory/gold direction.

Evidence directory outside Git: `C:/Users/USER/Documents/ChatGPT/Wanderroute/implementation/`. Scripts `browser-release-qa.mjs`, `browser-additional-qa.mjs`, `browser-classic-qa.mjs`, `browser-marker-qa.mjs`; JSON reports and `qa-*.png` screenshots; `qa-browser-current.pdf`, `qa-browser-visit.pdf`. Earlier harness failures were selector/timing errors or waiting on external web fonts; do not conceal them or count them as successful application checks. Final successful scenario runs must be read alongside those failures.

- Classic final independent browser run passed: complete desktop wizard -> labeled standard fallback -> itinerary, phone result and wizard navigation, return Home and Explore. Cloud save POST was intercepted at localhost4399, not sent to Supabase production. External web-font requests were deliberately failed in this isolated run after an earlier screenshot waited on fonts; fallback-font usability was inspected. No uncaught page errors. Classic quote UI remains accessible but no request was submitted.

- Additional isolated coordinate-catalog fixture check: clicking an itinerary activity highlighted its matching marker; marker click opened the corresponding popup/selected itinerary item. Adding beyond six activities was rejected while the six existing identities remained. Catalog hotel selection applied without claiming availability. These coordinate fixtures test interaction behavior, not live catalog completeness or live prices.

The final marker/recovery fixture retry passed all scenarios with no uncaught page errors. One earlier harness reused an occupied dev-server port and another failed to find a mobile desktop-header selector; both were corrected in the harness without product changes. The additional multi-city/visit run reached all travel checks but its Classic screenshot stalled on external font loading; the independent Classic run above completed. These are recorded test-environment failures, not hidden successful runs. Native helper remains unavailable, but browser verification is no longer blocked. Required local release gates passed for this milestone; the full product backlog remains open.

Public post-push check25Oct: Netlify served the new bundle index-J1S9zNUr.js with draft-recovery/road-geometry code. Fresh desktop and phone real-browser checks passed V2 primary entry, Classic access and return Home, no page errors/mutations. Local full workflow evidence and public navigation evidence are deliberately distinct. Evidence: public-deployment-report.json, public-browser-report.json, qa-public-desktop-v2.png and qa-public-phone-v2.png in the external implementation directory. Public GitHub API had no deployment checks; no Netlify dashboard build ID was obtained. All source/test changes were already committed and pushed; final follow-up changes are handover records only.
