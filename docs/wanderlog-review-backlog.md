# Feature backlog from a Wanderlog review

Written 22 Nov 2026. Nothing here is built yet; this is a list to pick from after the BizTycoon finals.

**Source:** "I Tested Wanderlog Pro for a Group Trip: Here Is My Honest Review" (Stardrift, 17 Jul 2026), https://stardrift.ai/resources/wanderlog.

**Caveats about the source:**
- Stardrift sells a competing AI planner, so the review leans towards "Wanderlog is manual, ours is AI".
- The author tested a group trip to Lisbon.
- Check Wanderlog's own site before quoting any feature or price from it.

## Where WanderRoute already stands

| Wanderlog (per the review) | WanderRoute today |
|---|---|
| List of days beside a map, drag and drop, unscheduled places | Done: the trip board, `BoardDnd`, Places to visit |
| Place search with a photo and short description | Done: place picker, Wikipedia photos with credits, AI descriptions |
| You find the places yourself ("assumes you've already found the places") | Better: pick a few places and the AI plus operator route rules build the rest |
| Route optimisation (Pro, 3+ places a day), time and distance per day | Only between towns; not within a day |
| Expense splitting | No |
| Live co-editing with tripmates | No; the plan is saved in one browser |
| Flight, hotel and train confirmations, attachments, Gmail import (Pro) | Flight times only |
| Offline access and offline maps (Pro) | No; the PDF works offline |
| Export to Google Maps (Pro) | No |
| AI chat, "auto-fill day" | The AI plans whole trips; there is no per-day refill |
| Hotel and Airbnb search | Hotels screen; no price comparison |
| Pro at $39.99 a year, annual only | Free; revenue planned from driver and operator quotes |

## Backlog

Effort: S is under a day, M is a few days, L is a week or more. Every item is free to run unless its row says otherwise.

### First: cheap and helps every traveller

1. **Open a day in Google Maps.** S. Done 22 Nov 2026.
   - Add a button per day that opens Google Maps directions through that day's places in order.
   - It uses the public `https://www.google.com/maps/dir/?api=1&origin=…&destination=…&waypoints=…` link: no key and no cost.
   - Wanderlog keeps this behind Pro.
2. **Travel time between places in a day.** M. Done 22 Nov 2026 (`lib/dayTravel.ts`).
   - Show "about 25 min by car" between cards.
   - Uses the OSRM matrix we already call, corrected with `roadTimeCorrection.ts`, so hill-country times stay realistic.
   - Cache the results, because the OSRM server is a free demo.
3. **Best order for this day.** M.
   - A button that reorders a day's places into the shortest drive, with Undo.
   - With at most 6 places a day, checking every order is cheap, so it can run in the browser.
   - Wanderlog charges for this and needs 3+ places; ours could be free.
4. **Poya day and closure warnings.** S to M.
   - Every full-moon Poya day is a public holiday. Alcohol sales stop, some shops close, and temples are busy.
   - Flag Poya days on the board.
   - Also warn about places closed on certain days (for example, some museums are shut on public holidays) where the data has it.
5. **Refill one day with AI.** M.
   - "Suggest places for this day" calls the AI for one day only, around about 1k tokens.
   - That stays far inside the Groq free limit.
   - This matches Wanderlog's "Auto-fill day".

### Next: the trip after planning

6. **Works offline.** M.
   - Turn the site into a PWA: a service worker caches the app and the saved trip, so the board opens without signal.
   - Hill country and national parks have patchy coverage.
   - Offline map tiles are harder: check the Esri tile terms before caching tiles. Until then, keep the PDF.
7. **Bookings in the trip.** M.
   - Manual entries for flights, hotels, train seats and safari jeeps, with a reference number, time and an optional file.
   - Files would use Supabase Storage, which is free up to 1 GB.
   - Skip Gmail scanning: Google's review for inbox access costs money and raises privacy questions.
8. **Kandy–Ella train helper.** M.
   - Show the scenic train's departures and the classes that need booking.
   - Seats open about 30 days ahead and sell out.
   - Link to the official railway booking site rather than copying timetables we can't keep current.
9. **Expense splitting.** M.
   - Who paid what in LKR or USD, how to split it, and who owes whom.
   - Keep it on the trip and in the PDF.

### Later: groups and growth

10. **Share and plan together.** L.
    - Step 1: a read-only share link (the `ShareScreen` exists; connect it to V2 drafts).
    - Step 2: tripmates suggest places into Places to visit.
    - Step 3: live co-editing with Supabase Realtime on the free tier, which needs sign-in.
11. **Save places from links.** M.
    - Paste a Google Maps, TikTok or Instagram link into Places to visit; match it to our places by name or coordinates.
    - Google Maps links carry coordinates, so start there.
12. **Ready-made routes.** S to M.
    - "Classic 10 days", "Beaches and whales", "Hill country slow".
    - Base them on the 24 operator itineraries we benchmarked, and open them straight on the board.
13. **Hotel price comparison.** L.
    - Needs an affiliate programme, such as Booking.com or Agoda, which needs approval.
    - It is also a revenue source. Only with clear "estimated" labels.

## Pricing lessons (if WanderRoute ever charges travellers)

- Offer a monthly option. The review criticised Wanderlog's annual-only Pro.
- State the free limits plainly. The reviewer could not find Wanderlog's attachment limit.
- Keep planning, route ordering and the map free. Earn from what costs us money or brings in bookings: driver quotes, operator leads and affiliate hotels.

## Not worth copying

- A manual-first planner that assumes the traveller already knows the places. Our edge is that the route rules and AI do that work.
- A slow general-purpose AI chat. Targeted buttons ("Refill this day", "Best order") are faster and cheaper on the free tier.
