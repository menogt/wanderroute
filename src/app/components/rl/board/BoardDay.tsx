import { useEffect, useState } from "react";
import { BedDouble, CarFront, ChevronDown, ChevronUp, ExternalLink, Footprints, MoreHorizontal, Plus, Search, Trash2, UtensilsCrossed } from "lucide-react";
import { estimateLeg, fetchDayLegs, formatLeg, googleMapsDayUrl, type Point, type TravelLeg } from "../../../lib/dayTravel";
import type { DetailedPlanningResult } from "../../../lib/planningV2Itinerary";
import type { PlanningV2Edit } from "../../../lib/planningV2Editing";
import { eligibleActivityPlaces } from "../../../lib/planningV2Places";
import type { PlanningDayV2, PlanningItemV2 } from "../../../lib/planningTypes";
import type { TransportLeg } from "../../../lib/transportTypes";
import { formatDriveTime } from "../../../lib/transportPlanning";
import { amountLabel, itemCost, shortDate } from "./boardFormat";
import { dayColour } from "./BoardMap";
import { PlacePhoto } from "./PlacePhoto";
import { SortableDayList, type DragProps } from "./BoardDnd";

export const MAX_PER_DAY = 6;

type DayProps = {
  day: PlanningDayV2;
  detail: DetailedPlanningResult;
  legs: Map<string, TransportLeg>;
  highlightId?: string;
  focused: boolean;
  onEdit: (edit: PlanningV2Edit) => void;
  onHighlight: (itemId?: string) => void;
  sectionRef: (element: HTMLElement | null) => void;
  /** Open when the section first renders (phones start with only day 1 open). */
  defaultOpen?: boolean;
  /** Increases whenever something asks to show this day (map chip, a pin, Today's plan); the day opens. */
  reveal?: number;
};

const pointOf = (item: PlanningItemV2): Point | undefined => item.coordinates
  ? { latitude: item.coordinates.latitude, longitude: item.coordinates.longitude } : undefined;

/** Travel to each mapped place from the one before it: an instant estimate, then road times when OSRM answers. */
function useDayLegs(items: PlanningItemV2[], city: string, enabled: boolean, stagger: number) {
  const mapped = items.filter(item => item.coordinates);
  const points = mapped.map(item => pointOf(item)!);
  const signature = mapped.map(item => `${item.id}@${item.coordinates!.latitude},${item.coordinates!.longitude}`).join("|");
  const [road, setRoad] = useState<{ signature: string; legs: TravelLeg[] }>();
  useEffect(() => {
    if (!enabled || points.length < 2) return;
    let live = true;
    // Staggered so a long trip doesn't send every day's request to the free OSRM server at once.
    const timer = window.setTimeout(() => fetchDayLegs(points, city).then(legs => { if (live && legs) setRoad({ signature, legs }); }), 300 + stagger);
    return () => { live = false; window.clearTimeout(timer); };
  }, [signature, city, enabled]);
  const legs = new Map<string, TravelLeg>();
  mapped.forEach((item, index) => {
    if (index === 0) return;
    legs.set(item.id, road?.signature === signature ? road.legs[index - 1] : estimateLeg(points[index - 1], points[index], city));
  });
  return { legs, points };
}

function legText(leg: TransportLeg | undefined): string {
  if (!leg) return "Journey time to confirm";
  const mode = leg.mode === "UNASSIGNED" ? "Transport to choose" : leg.mode.replace(/_/g, " ").toLowerCase().replace(/^./, letter => letter.toUpperCase());
  const minutes = leg.durationMinutes ?? leg.roadReferenceMinutes;
  return minutes === undefined ? `${mode} · journey time unknown` : `${mode} · about ${formatDriveTime(minutes)} by car (road estimate)`;
}

/** One day of the trip as a section: travel rows, numbered place cards, add a place, stay and cost. */
export function BoardDay({ day, detail, legs, highlightId, focused, onEdit, onHighlight, sectionRef, defaultOpen = true, reveal = 0 }: DayProps) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { if (reveal) setOpen(true); }, [reveal]);
  const { ledger } = detail;
  const city = day.visitCity ?? day.city;
  const activities = day.items.filter(item => item.category === "activity");
  const colour = dayColour(day.day);
  const date = shortDate(day.date);
  const travel = useDayLegs(activities, city, open, (day.day - 1) * 250);
  const mapsUrl = googleMapsDayUrl(travel.points);
  const names = activities.map(item => item.label);

  return <section ref={sectionRef} id={`wr-day-${day.day}`} data-day={day.day} className={`wr-board-day${focused ? " is-focused" : ""}`}
    aria-labelledby={`wr-day-${day.day}-title`} style={{ ["--day-colour" as string]: colour }}>
    <header className="wr-board-day__header" onClick={event => {
      // Tapping anywhere on the header opens or closes the day; its own controls keep their behaviour.
      if (!(event.target as HTMLElement).closest("button, a, summary, input, select, label")) setOpen(value => !value);
    }}>
      <button type="button" className="wr-board-day__toggle" aria-expanded={open} aria-controls={`wr-day-${day.day}-body`}
        onClick={() => setOpen(value => !value)}>{open ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
        <span className="wr-sr-only">{open ? "Collapse" : "Expand"} day {day.day}</span></button>
      <div>
        <h3 id={`wr-day-${day.day}-title`}><span className="wr-board-day__dot" aria-hidden="true" />Day {day.day}
          {date && <span className="wr-board-day__date">{date}</span>}</h3>
        <p className="wr-board-day__place">{day.visitCity ? `${day.visitCity} · day visit from ${day.city}` : day.city}
          {day.overnightCity ? ` · night in ${day.overnightCity}` : " · departure day"}</p>
        {day.localTip && <p className="wr-board-day__theme">{day.localTip}</p>}
        {!open && (names.length > 0 || day.overnightCity) && <p className="wr-board-day__summary">{names.length
          ? `${names.length} ${names.length === 1 ? "place" : "places"}: ${names.join(" · ")}` : "No places yet"}</p>}
      </div>
      <p className="wr-board-day__cost"><span>Day cost</span><strong>{amountLabel(ledger.summary.byDay[day.day], ledger.currency)}</strong></p>
    </header>
    {open && <div id={`wr-day-${day.day}-body`} className="wr-board-day__body">
      {day.items.filter(item => item.category === "transport").map(item => <div key={item.id} className="wr-board-row wr-board-row--travel">
        <CarFront size={17} aria-hidden="true" /><div><strong>{item.label}</strong><span>{legText(item.transportLegId ? legs.get(item.transportLegId) : undefined)}</span></div>
      </div>)}
      {activities.length === 0 && <p className="wr-board-day__empty">{day.overnightCity ? "Nothing planned yet. Add a place below, or keep it as a free day." : "Departure day: leave time for packing and the airport transfer."}</p>}
      <SortableDayList day={day} items={activities} renderCard={(item, index, drag) => {
        const leg = travel.legs.get(item.id);
        return <>
          {leg && <li className="wr-board-leg" title={leg.source === "road" ? "Road route; traffic and stops can add time." : "Distance estimate; traffic and stops can add time."}>
            {leg.walk ? <Footprints size={14} aria-hidden="true" /> : <CarFront size={14} aria-hidden="true" />}<span>{formatLeg(leg)}</span></li>}
          <PlaceCard item={item} number={index + 1}
            day={day} detail={detail} colour={colour} highlighted={highlightId === item.id} onEdit={onEdit} onHighlight={onHighlight}
            first={index === 0} last={index === activities.length - 1} drag={drag} />
        </>;
      }} />
      {mapsUrl && <a className="wr-board-day__gmaps" href={mapsUrl} target="_blank" rel="noopener noreferrer">
        <ExternalLink size={16} aria-hidden="true" /> Open in Google Maps
        <span className="wr-sr-only">: {travel.points.length > 1 ? `day ${day.day} route` : `day ${day.day} place`} (opens in a new tab)</span></a>}
      {day.overnightCity && <AddPlaceBox day={day} detail={detail} city={city} full={activities.length >= MAX_PER_DAY} onEdit={onEdit} />}
      {day.items.filter(item => item.category === "meal").map(item => <div key={item.id} className="wr-board-row">
        <UtensilsCrossed size={16} aria-hidden="true" /><div><strong>{item.label}</strong><span>{item.detail}</span></div></div>)}
      {day.overnightCity && <div className="wr-board-row wr-board-row--stay"><BedDouble size={17} aria-hidden="true" /><div>
        <strong>{day.accommodation}</strong>
        <span>{detail.customization?.stays[day.city]?.status === "TRAVELLER_BOOKED" ? "You report this is booked; not independently verified."
          : "Proposed stay; availability and room price need confirmation."}</span></div></div>}
      {day.warnings && day.warnings.length > 0 && <details className="wr-board-day__checks"><summary>Checks for this day</summary>
        <ul>{day.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
    </div>}
  </section>;
}

function PlaceCard({ item, number, day, detail, colour, highlighted, first, last, onEdit, onHighlight, drag }: {
  item: PlanningItemV2; number: number; day: PlanningDayV2; detail: DetailedPlanningResult; colour: string;
  highlighted: boolean; first: boolean; last: boolean; onEdit: (edit: PlanningV2Edit) => void; onHighlight: (itemId?: string) => void;
  drag?: DragProps;
}) {
  const { itinerary, ledger } = detail;
  const city = day.visitCity ?? day.city;
  const place = item.placeId ? detail.places.find(entry => entry.databaseId === item.placeId) : undefined;
  const dayActivities = day.items.filter(entry => entry.category === "activity");
  const replacements = item.isFreeTime ? [] : eligibleActivityPlaces(detail.places, city).filter(candidate => candidate.databaseId !== item.placeId &&
    !dayActivities.some(entry => entry.id !== item.id && entry.placeId === candidate.databaseId));
  const otherDays = itinerary.days.filter(candidate => candidate.day !== day.day && (candidate.visitCity ?? candidate.city).toLowerCase() === city.toLowerCase() &&
    candidate.items.filter(entry => entry.category === "activity").length < MAX_PER_DAY &&
    (!item.placeId || !candidate.items.some(entry => entry.placeId === item.placeId)));
  return <li id={`wr-card-${item.id}`} ref={drag?.ref} style={drag?.style}
    className={`wr-place-card${highlighted ? " is-highlighted" : ""}${drag?.dragging ? " is-dragging" : ""}`}
    onMouseEnter={() => onHighlight(item.id)} onMouseLeave={() => onHighlight(undefined)} onFocus={() => onHighlight(item.id)}>
    {drag?.handle}
    <span className="wr-place-card__number" style={{ background: colour }} aria-label={`Stop ${number}`}>{number}</span>
    <PlacePhoto name={place?.name ?? item.label} city={place?.city ?? city} category={item.isFreeTime ? "free" : place?.category}
      coordinates={item.coordinates} className="wr-place-card__photo" />
    <div className="wr-place-card__text">
      <h4>{item.label}</h4>
      {item.detail && <p>{item.detail}</p>}
      <p className="wr-place-card__meta">{[item.plannedStart ?? (item.time && !/confirm|choose/i.test(item.time) ? item.time : undefined),
        item.isFreeTime ? "Free time" : item.durationMinutes ? `${item.durationMinutes} min visit` : undefined,
        item.isFreeTime ? undefined : itemCost(ledger, item.id)].filter(Boolean).join(" · ")}</p>
    </div>
    <details className="wr-place-card__menu">
      <summary aria-label={`Change ${item.label}`}><MoreHorizontal size={18} aria-hidden="true" /></summary>
      <div className="wr-place-card__actions">
        <div className="wr-place-card__buttons">
          <button type="button" disabled={first} onClick={() => onEdit({ type: "reorder", itemId: item.id, direction: -1 })}><ChevronUp size={15} aria-hidden="true" /> Earlier</button>
          <button type="button" disabled={last} onClick={() => onEdit({ type: "reorder", itemId: item.id, direction: 1 })}><ChevronDown size={15} aria-hidden="true" /> Later</button>
          <button type="button" className="wr-danger" onClick={() => onEdit({ type: "remove", itemId: item.id })}><Trash2 size={15} aria-hidden="true" /> Remove</button>
        </div>
        {otherDays.length > 0 && <label>Move to another day<select value="" onChange={event => event.target.value && onEdit({ type: "move", itemId: item.id, targetDay: Number(event.target.value) })}>
          <option value="">Choose a day in {city}</option>{otherDays.map(candidate => <option key={candidate.day} value={candidate.day}>Day {candidate.day}</option>)}
        </select></label>}
        {!item.isFreeTime && <label>Replace with<select value="" disabled={!replacements.length} onChange={event => event.target.value && onEdit({ type: "replace", itemId: item.id, placeId: event.target.value })}>
          <option value="">{replacements.length ? "Choose a place" : "No other place available"}</option>
          {replacements.map(candidate => <option key={candidate.databaseId} value={candidate.databaseId}>{candidate.name}</option>)}
        </select></label>}
        <div className="wr-place-card__timing">
          <label>Start time<input type="time" value={item.preferredStart ?? ""} onChange={event => onEdit({ type: "timing", itemId: item.id,
            durationMinutes: item.durationMinutes ?? 90, preferredStart: event.target.value || undefined })} /></label>
          <label>Visit length<select value={item.durationMinutes ?? 90} onChange={event => onEdit({ type: "timing", itemId: item.id,
            durationMinutes: Number(event.target.value), preferredStart: item.preferredStart })}>
            {[30, 60, 90, 120, 180, 240].map(minutes => <option key={minutes} value={minutes}>{minutes} minutes</option>)}</select></label>
        </div>
      </div>
    </details>
  </li>;
}

function AddPlaceBox({ day, detail, city, full, onEdit }: { day: PlanningDayV2; detail: DetailedPlanningResult; city: string;
  full: boolean; onEdit: (edit: PlanningV2Edit) => void }) {
  const [query, setQuery] = useState("");
  const inDay = new Set(day.items.map(item => item.placeId).filter(Boolean));
  const inTrip = new Set(detail.itinerary.days.flatMap(entry => entry.items.map(item => item.placeId)).filter(Boolean));
  const options = eligibleActivityPlaces(detail.places, city).filter(place => !inDay.has(place.databaseId));
  const text = query.trim().toLowerCase();
  const matches = text ? options.filter(place => place.name.toLowerCase().includes(text)).slice(0, 6) : [];
  const suggestions = options.filter(place => !inTrip.has(place.databaseId)).slice(0, 3);
  const add = (placeId: string) => { onEdit({ type: "add", day: day.day, placeId }); setQuery(""); };
  if (full) return <p className="wr-board-add__full">This day has {MAX_PER_DAY} stops, the most we plan in one day.</p>;
  return <div className="wr-board-add">
    <label className="wr-board-add__search"><Search size={16} aria-hidden="true" /><span className="wr-sr-only">Add a place to day {day.day}</span>
      <input type="search" value={query} placeholder={`Add a place in ${city}`} onChange={event => setQuery(event.target.value)} /></label>
    {text && <ul className="wr-board-add__results" aria-label={`Places in ${city} matching ${query}`}>
      {matches.length ? matches.map(place => <li key={place.databaseId}><button type="button" onClick={() => add(place.databaseId!)}>
        <Plus size={15} aria-hidden="true" /> {place.name}</button></li>) : <li className="wr-board-add__none">No match in {city}. Try another name.</li>}
    </ul>}
    {!text && suggestions.length > 0 && <div className="wr-board-add__suggest"><span>Suggestions</span>
      {suggestions.map(place => <button type="button" key={place.databaseId} onClick={() => add(place.databaseId!)}><Plus size={14} aria-hidden="true" /> {place.name}</button>)}
      <button type="button" onClick={() => onEdit({ type: "free-time", day: day.day })}><Plus size={14} aria-hidden="true" /> Free time</button>
    </div>}
  </div>;
}
