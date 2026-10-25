# Design handover

Identity: the Living Sri Lanka Atlas, traveler-facing and editorial. Midnight navy #071A2D, ocean #0B2742, warm ivory #FFF9EF, sand #F1E3C8, antique gold #D4A64A, tea green #4F6F52. Fraunces headings, readable sans UI, mono eyebrows. Plain existing CSS/classes; use the repo premium UI skill. Do not replace this with generic cards, new map SDKs, decorative website silhouettes or a developer dashboard.

Authoritative map references: Explore MapScreen.tsx and Classic ItineraryScreen.tsx, mapConfig.ts, mapPins.ts and map-pins.css. Esri World Topo with required attribution, original category/stay/stop pins, navy route underlay and gold dotted track. Classic obtains actual driving geometry from osrmRoute.ts and has its own day-route path. V2 must preserve real route appearance, selection, pan/zoom, popups, explicit Fit route/day and graceful outage behavior. It now fetches driving road geometry; it does not pretend that a road track is a confirmed train/bus/walking service. PDF schematic geography is a separate context, not a replacement website map.

Activity selection highlights corresponding markers; marker selection selects items. Day changes and itinerary/map phone switch should retain context. Do not reset zoom after trivial selection or allow stale requests to draw an old itinerary. Phone layouts need intentional navigation, touch controls, progressive disclosure and readable content, not simply no horizontal overflow.

Approved reference artifacts exist outside the checkout:
`C:/Users/USER/Documents/ChatGPT/Wanderroute/output/pdf/WanderRoute-Itinerary-Draft-Design-Sample.pdf` (8 pages)
`C:/Users/USER/Documents/ChatGPT/Wanderroute/output/pdf/WanderRoute-Workspace-Wireframes.pdf` (2 pages)
`C:/Users/USER/Documents/ChatGPT/Wanderroute/experience-revision/Experience-First-Redesign-Plan-2026-10-22.md`.
Transfer these privately with the workspace for account migration; do not assume another machine has them. If unavailable, this specification remains authoritative.

Approved PDF direction: navy cover, ivory editorial pages, strong typographic hierarchy, geographical overview, full day-by-day content, stays/rooms, all transfers including airports/return visits, current budget/evidence/allowances, arrangement status and practical preparation. Dynamic pagination must preserve all content and long names/notes. Current semantic revision controls preferred status and export; any edit must invalidate stale links. Number of pages follows content; an eight-page visual sample is not a forced truncation limit.

Implementation uses jsPDF and licensed embedded Vera fonts in public/pdf. Preserve the font copyright/license. Natural Earth outline is public domain and credited; map tiles are not copied into exported PDF. Explicitly distinguish proposed/needs booking/traveler reports booked/changed-cancelled. Never visually imply provider confirmation or payment success.
