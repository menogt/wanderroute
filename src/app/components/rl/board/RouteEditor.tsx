import { useState } from "react";
import { ArrowDown, ArrowUp, BedDouble, Minus, Plus, X } from "lucide-react";
import { CANONICAL_CITY_ORDER } from "../../../lib/cityPlan";
import { customizationDraft, type CustomizationDraft, type DestinationChoice, type StayChoice } from "../../../lib/planningCustomization";
import type { PlanningV2Session } from "../../../lib/planningV2Session";
import { knownPlanningDestinations } from "../../../lib/routeCandidates";
import { fewerNights, moreNights, type NightMove } from "../../../lib/routeNights";
import { hotelOptions, suggestedStay } from "../../../lib/suggestedStay";
import { dayColour } from "./BoardMap";
import "../../../../styles/route-stay.css";

type Change = { stops: DestinationChoice[]; message: string; moves?: NightMove[] } | { problem: string };

const rank = (city: string) => { const index = CANONICAL_CITY_ORDER.findIndex(entry => entry.toLowerCase() === city.toLowerCase()); return index < 0 ? 99 : index; };

/** The stop with the most nights that can spare one, other than `except`. Later stops win ties. */
function donor(stops: DestinationChoice[], except: number): number {
  let best = -1;
  stops.forEach((stop, index) => {
    if (index === except || stop.locked || stop.nights < 2) return;
    if (best < 0 || stop.nights >= stops[best].nights) best = index;
  });
  return best;
}

export function moveStop(stops: DestinationChoice[], index: number, direction: -1 | 1): Change {
  const target = index + direction;
  if (target < 0 || target >= stops.length) return { problem: "That stop is already at the end." };
  const next = stops.map(stop => ({ ...stop }));
  [next[index], next[target]] = [next[target], next[index]];
  return { stops: next, message: `${stops[index].city} now comes ${direction < 0 ? "before" : "after"} ${stops[target].city}.` };
}
export function removeStop(stops: DestinationChoice[], index: number): Change {
  if (stops.length < 2) return { problem: "Keep at least one stop." };
  const to = index > 0 ? index - 1 : 1;
  const next = stops.map(stop => ({ ...stop }));
  next[to].nights += stops[index].nights;
  next.splice(index, 1);
  return { stops: next, message: `Removed ${stops[index].city}; its ${stops[index].nights === 1 ? "night goes" : "nights go"} to ${stops[to].city}.` };
}
export function addStop(stops: DestinationChoice[], city: string): Change {
  const from = donor(stops, -1);
  if (from < 0) return { problem: `Every stop has one night, so there is no night to give ${city}. Lengthen the trip in Trip settings.` };
  const next = stops.map(stop => ({ ...stop }));
  next[from].nights -= 1;
  // Slot the town into the island loop, before the airport-side last stop.
  let at = next.findIndex(stop => rank(stop.city) > rank(city));
  if (at < 0) at = next.length;
  if (at === next.length && next.length > 1 && rank(next[next.length - 1].city) <= 1) at = next.length - 1;
  next.splice(at, 0, { city, nights: 1, requirement: "OPTIONAL" });
  return { stops: next, message: `Added ${city} with one night from ${stops[from].city}.` };
}

/** Wanderlog-style inline editing of the route: every change applies at once and can be undone. */
export function RouteEditor({ session, busy, onCustomize, onFocusDay }: {
  session: PlanningV2Session; busy: boolean; onCustomize: (draft: CustomizationDraft) => Promise<boolean>;
  onFocusDay: (day: number) => void;
}) {
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState("");
  // Nights moved by − and + since the last other edit, so − returns a night to the town it came from.
  const [moves, setMoves] = useState<NightMove[]>([]);
  const draft = customizationDraft(session);
  const places = session.detailed?.places ?? [];
  const stops = draft.stops;
  const firstDay = stops.map((_, index) => stops.slice(0, index).reduce((sum, stop) => sum + stop.nights, 0) + 1);
  const towns = knownPlanningDestinations().map(place => place.name).filter(name => !stops.some(stop => stop.city === name));
  const apply = async (change: Change) => {
    setNote(""); setProblem("");
    if ("problem" in change) { setProblem(change.problem); return; }
    const ok = await onCustomize({ ...draft, stops: change.stops });
    if (ok) { setMoves(change.moves ?? []); setNote(`${change.message} Undo is below if you change your mind.`); }
  };
  const chooseHotel = async (city: string, placeId: string) => {
    setNote(""); setProblem("");
    const hotel = hotelOptions(places, city).find(place => place.databaseId === placeId);
    const current: StayChoice = draft.stays[city] ?? { status: "PROPOSED" };
    const { placeId: _id, name: _name, ...rest } = current;
    const ok = await onCustomize({ ...draft, stays: { ...draft.stays,
      [city]: hotel ? { ...rest, placeId: hotel.databaseId, name: hotel.name } : rest } });
    if (ok) setNote(hotel ? `${hotel.name} is now your proposed stay in ${city}. It is not booked.` : `Removed your hotel choice in ${city}.`);
  };
  return <section id="wr-board-route" className="wr-board-section wr-route-editor" aria-labelledby="wr-route-title">
    <h2 id="wr-route-title">Your route</h2>
    <p className="wr-board-section__lead">Change nights, order or stops here. Days, places, the map and costs update straight away.</p>
    <ol className="wr-route-editor__stops">
      {stops.map((stop, index) => <li key={stop.city}>
        <button type="button" className="wr-route-editor__name" onClick={() => onFocusDay(firstDay[index])}>
          <span className="wr-route-editor__dot" style={{ background: dayColour(firstDay[index]) }} aria-hidden="true" />
          <strong>{stop.city}</strong><small>from day {firstDay[index]}{stop.locked ? " · locked" : ""}</small>
        </button>
        <div className="wr-route-editor__nights" role="group" aria-label={`Nights in ${stop.city}`}>
          <button type="button" disabled={busy || stop.locked || stop.nights < 2} onClick={() => apply(fewerNights(stops, index, moves))}
            aria-label={`One night less in ${stop.city}`}><Minus size={15} aria-hidden="true" /></button>
          <output aria-live="polite">{stop.nights} {stop.nights === 1 ? "night" : "nights"}</output>
          <button type="button" disabled={busy || stop.locked} onClick={() => apply(moreNights(stops, index, moves))}
            aria-label={`One more night in ${stop.city}`}><Plus size={15} aria-hidden="true" /></button>
        </div>
        <div className="wr-route-editor__order">
          <button type="button" disabled={busy || index === 0} onClick={() => apply(moveStop(stops, index, -1))} aria-label={`Move ${stop.city} earlier`}><ArrowUp size={15} aria-hidden="true" /></button>
          <button type="button" disabled={busy || index === stops.length - 1} onClick={() => apply(moveStop(stops, index, 1))} aria-label={`Move ${stop.city} later`}><ArrowDown size={15} aria-hidden="true" /></button>
          <button type="button" disabled={busy || stops.length < 2 || stop.locked} onClick={() => apply(removeStop(stops, index))} aria-label={`Remove ${stop.city}`}><X size={15} aria-hidden="true" /></button>
        </div>
        {(() => {
          const stay = draft.stays[stop.city];
          const hotels = hotelOptions(places, stop.city);
          const suggestion = suggestedStay(places, stop.city, draft.brief.comfortTier);
          const ownName = !stay?.placeId && (stay?.name?.trim() || (stay?.area ? `Stay in ${stay.area}` : ""));
          if (!hotels.length && !ownName) return <p className="wr-route-editor__stay"><span><BedDouble size={15} aria-hidden="true" /> Hotel</span>
            No listed hotels in {stop.city} yet. Add your own in Trip settings.</p>;
          return <label className="wr-route-editor__stay"><span><BedDouble size={15} aria-hidden="true" /> Hotel</span>
            <select value={stay?.placeId ?? ""} disabled={busy || stay?.status === "TRAVELLER_BOOKED"}
              aria-label={`Hotel in ${stop.city}`} onChange={event => chooseHotel(stop.city, event.target.value)}>
              <option value="">{ownName || (suggestion ? `Suggested: ${suggestion.name}` : "Choose later")}</option>
              {hotels.map(hotel => <option key={hotel.databaseId} value={hotel.databaseId}>
                {hotel.name}{hotel.stayTier ? ` · ${hotel.stayTier}` : ""}{hotel.recordedPrice ? ` · guide US$${hotel.recordedPrice.amount}/night` : ""}</option>)}
            </select>
            <small>{stay?.status === "TRAVELLER_BOOKED" ? "You report this is booked." : "Not booked. Availability and room price need confirmation."}</small></label>;
        })()}
      </li>)}
    </ol>
    <label className="wr-route-editor__add">Add a stop
      <select value="" disabled={busy} onChange={event => event.target.value && apply(addStop(stops, event.target.value))}>
        <option value="">Choose a town</option>{towns.map(town => <option key={town} value={town}>{town}</option>)}
      </select></label>
    <p className="wr-route-editor__status" role="status">{busy ? "Updating your trip…" : note}</p>
    {problem && <p className="wr-route-editor__problem" role="alert">{problem}</p>}
  </section>;
}
