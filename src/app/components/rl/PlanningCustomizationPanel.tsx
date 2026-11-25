import { useMemo, useState } from "react";
import { DestinationHint } from "./DestinationHint";
import { newStudioPlan, orderAlternative } from "../../lib/tripStudio/model";
import { isTown } from "../../lib/tripStudio/catalog";
import { calendarDuration } from "../../lib/planningCalendar";
import type { PlanningV2Session } from "../../lib/planningV2Session";
import { customizationDraft, previewPlanningCustomization, type ArrangementStatus, type CustomizationDraft } from "../../lib/planningCustomization";
import { knownPlanningDestinations } from "../../lib/routeCandidates";
import type { Interest } from "./types";
import type { TransportMode } from "../../lib/transportTypes";

const ARRANGEMENTS: { value: ArrangementStatus; label: string }[] = [
  { value: "PROPOSED", label: "Proposed" }, { value: "NEEDS_BOOKING", label: "Needs booking" },
  { value: "TRAVELLER_BOOKED", label: "I have booked this independently" },
  { value: "CHANGED_CANCELLED", label: "My recorded arrangement changed / was cancelled" },
];
const MODES: { value: TransportMode; label: string }[] = [{ value: "PRIVATE_DRIVER", label: "Private transfer / driver" },
  { value: "SELF_DRIVE", label: "Self-drive car" }, { value: "TUK_TUK_SELF_DRIVE", label: "Self-drive tuk-tuk" },
  { value: "TRAIN", label: "Train" }, { value: "BUS", label: "Bus" }, { value: "UNASSIGNED", label: "Choose later / mixed" }];

export function PlanningCustomizationPanel({ session, busy, onApply, onClose }: { session: PlanningV2Session; busy: boolean;
  onApply: (draft: CustomizationDraft) => Promise<boolean>; onClose: (applied?: boolean) => void }) {
  const [draft, setDraft] = useState(() => customizationDraft(session));
  const initialStart = draft.brief.travelDates?.start ?? draft.brief.arrival?.dateTime?.slice(0, 10) ?? "";
  const initialEnd = draft.brief.travelDates?.end ?? draft.brief.departure?.dateTime?.slice(0, 10) ?? "";
  const [exact, setExact] = useState(Boolean(initialStart || initialEnd));
  const [city, setCity] = useState("");
  const [preview, setPreview] = useState<ReturnType<typeof previewPlanningCustomization>>();
  const change = (fn: (value: CustomizationDraft) => CustomizationDraft) => { setDraft(fn); setPreview(undefined); };
  const brief = (patch: Partial<CustomizationDraft["brief"]>) => change(value => ({ ...value, brief: { ...value.brief, ...patch } }));
  function changeDates(start: string, end: string, useExact: boolean) {
    const length = calendarDuration(start, end);
    function endpoint(kind: "arrival" | "departure", date: string) {
      const previous = draft.brief[kind];
      const clock = previous?.dateTime?.slice(11, 16);
      return { ...previous, dateTime: useExact && date && clock ? date + "T" + clock : undefined };
    }
    brief({ travelDates: useExact ? { start: start || undefined, end: end || undefined } : undefined,
      travelMonth: useExact ? undefined : Number(start.slice(5, 7)) || draft.brief.travelMonth,
      durationDays: useExact && length !== undefined ? length : draft.brief.durationDays,
      arrival: endpoint("arrival", start), departure: endpoint("departure", end) });
    setExact(useExact);
  }
  const dateProblem = exact && (!initialStart || !initialEnd || draft.brief.durationDays < 2 || draft.brief.durationDays > 21);
  const updateStop = (index: number, patch: Partial<CustomizationDraft["stops"][number]>) => change(value => ({ ...value, stops: value.stops.map((stop, i) => i === index ? { ...stop, ...patch } : stop) }));
  function moveBase(index: number, offset: number) {
    change(value => {
      const stops = [...value.stops];
      const [stop] = stops.splice(index, 1);
      stops.splice(index + offset, 0, stop);
      return { ...value, stops };
    });
  }
  const updateStay = (city: string, patch: Partial<CustomizationDraft["stays"][string]>) => change(value => ({ ...value,
    stays: { ...value.stays, [city]: { status: "PROPOSED", ...value.stays[city], ...patch } } }));
  const concept = session.result!.concepts.find(item => item.routeConcept.id === session.selectedConceptId)!;
  const legs = [...concept.transport.legs, concept.transport.arrivalTransfer, concept.transport.departureTransfer].filter(Boolean);
  const visitBases = draft.stops.flatMap(stop => Array.from({ length: Math.max(0, Math.min(21, Math.floor(stop.nights || 0))) }, () => stop.city));
  const nights = draft.stops.reduce((sum, stop) => sum + stop.nights, 0);
  const roadOrder = useMemo(() => {
    const trip = draft.brief;
    if (trip.transportPreference !== "PRIVATE_DRIVER" ||
      Object.keys(draft.transport).length || draft.wishlist.some(item => item.day) ||
      draft.stops.some(stop => stop.locked || !isTown(stop.city) || draft.stays[stop.city]?.status === "TRAVELLER_BOOKED")) return;
    const candidate = newStudioPlan();
    candidate.start = trip.arrival?.location ?? null;
    candidate.end = trip.departure?.location ?? null;
    candidate.mode = "private";
    candidate.pace = trip.pace === "PACKED" ? "fast" : trip.pace === "RELAXED" || trip.pace === "SLOW_TRAVEL" ? "relaxed" : "balanced";
    candidate.bases = draft.stops.map(stop => ({ place: stop.city, nights: stop.nights }));
    if (trip.travelDates?.start && trip.travelDates.end) candidate.dates = { kind: "exact", arrival: trip.travelDates.start,
      departure: trip.travelDates.end, arrivalTime: trip.arrival?.dateTime?.slice(11), departureTime: trip.departure?.dateTime?.slice(11) };
    return orderAlternative(candidate, session.result!.matrix);
  }, [draft, session.result]);
  return <section className="wr-v2-customize" aria-labelledby="wr-customize-title">
    <h2 id="wr-customize-title">My Journey</h2><p>Preview changes before applying them. Compatible activities stay in your plan; displaced choices stay in a shortlist. No reservation is made or cancelled here.</p>
    <fieldset disabled={busy}>
      {roadOrder && <details><summary>Compare another driving order</summary>
        <p>{roadOrder.bases.map(base => base.place).join(" → ")} · Estimated driving including both transfers: {Math.round(roadOrder.total)} minutes. Current order: {Math.round(roadOrder.currentTotal)} minutes.</p>
        <button type="button" onClick={() => change(value => ({ ...value, stops: roadOrder.bases.map(base => value.stops.find(stop => stop.city === base.place)!) }))}>Try this order</button>
      </details>}
      <details><summary>Inspect route alternatives</summary><p>Compare the route shapes below. Previewing an alternative preserves compatible edits; displaced activities stay in your shortlist.</p>{session.result!.concepts.filter(item => item.routeConcept.id !== session.selectedConceptId).map(alternative => <div className="wr-v2-customize__stop" key={alternative.routeConcept.id}><h3>{alternative.routeConcept.stops.map(stop => stop.destinationName).join(" to ")}</h3><p>{alternative.routeConcept.stops.map(stop => `${stop.nights} nights in ${stop.destinationName}`).join("; ")}</p><p>{alternative.knownDrivingMinutes !== undefined ? `${Math.ceil(alternative.knownDrivingMinutes)} minutes of supported road-driving estimates, including known airport legs. Other journey times may remain unknown.` : "Journey times need confirmation."}</p><button type="button" onClick={() => change(value => ({ ...value, stops: alternative.routeConcept.stops.map(stop => ({ city: stop.destinationName, nights: stop.nights, requirement: value.stops.find(item => item.city === stop.destinationName)?.requirement ?? "OPTIONAL", locked: value.stops.find(item => item.city === stop.destinationName)?.locked })), wishlist: [...value.wishlist, ...value.stops.filter(stop => !alternative.routeConcept.stops.some(item => item.destinationName === stop.city)).map(stop => ({ city: stop.city, requirement: stop.requirement, role: "VISIT" as const }))] }))}>Try this route shape</button></div>)}</details>
      <details><summary>Trip settings</summary><div className="wr-v2-customize__fields">
        <label>Travel dates<select value={exact ? "exact" : "approximate"} onChange={event => changeDates(initialStart, initialEnd, event.target.value === "exact")}>
          <option value="approximate">I’m planning roughly</option><option value="exact">I know my dates</option>
        </select></label>
        {exact && <>
          <label>Arrival date<input type="date" value={initialStart} onChange={event => changeDates(event.target.value, initialEnd, true)} /></label>
          <label>Departure date<input type="date" min={initialStart} value={initialEnd} onChange={event => changeDates(initialStart, event.target.value, true)} /></label>
          <p role="status">{dateProblem ? "Choose dates spanning 2 to 21 days." : `${draft.brief.durationDays} days · ${draft.brief.durationDays - 1} nights`}</p>
        </>}
        {!exact && <label>Travel month<select value={draft.brief.travelMonth ?? ""} onChange={event => brief({ travelMonth: event.target.value ? Number(event.target.value) : undefined })}><option value="">Not sure yet</option>{["January","February","March","April","May","June","July","August","September","October","November","December"].map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select></label>}
        <label>Preferred daily driving minutes<input type="number" min="30" max="720" value={draft.brief.maxPreferredDailyDrivingMinutes ?? ""} onChange={event => brief({ maxPreferredDailyDrivingMinutes: event.target.value ? Number(event.target.value) : undefined })} /></label>
        {!exact && <label>Travel days<input type="number" min="2" max="21" value={draft.brief.durationDays || ""} onChange={event => brief({ durationDays: Number(event.target.value) })} /></label>}
        <label>Travellers<input type="number" min="1" max="12" value={draft.brief.travellerCount || ""} onChange={event => brief({ travellerCount: Number(event.target.value) })} /></label>
        <label>Total budget<input type="number" min="1" value={draft.brief.budget.amount || ""} onChange={event => brief({ budget: { ...draft.brief.budget, amount: Number(event.target.value) } })} /></label>
        <label>Budget currency<select value={draft.brief.budget.currency} onChange={event => brief({ budget: { ...draft.brief.budget, currency: event.target.value as typeof draft.brief.budget.currency } })}>{["USD", "EUR", "GBP", "AUD", "LKR"].map(currency => <option key={currency}>{currency}</option>)}</select></label>
        <label>Overall transport preference<select value={draft.brief.transportPreference ?? "RECOMMEND"} onChange={event => brief({ transportPreference: event.target.value as typeof draft.brief.transportPreference })}><option value="RECOMMEND">Choose later</option><option value="PRIVATE_DRIVER">Private driver</option><option value="PUBLIC_TRANSPORT">Public transport</option><option value="MIXED">Mixed, choose per leg</option><option value="TUK_TUK_SELF_DRIVE">Self-drive tuk-tuk</option></select></label>
        <label>Travel pace<select value={draft.brief.pace ?? "BALANCED"} onChange={event => brief({ pace: event.target.value as typeof draft.brief.pace })}><option value="SLOW_TRAVEL">Slow travel</option><option value="RELAXED">Relaxed</option><option value="BALANCED">Balanced</option><option value="PACKED">Packed</option></select></label>
        <label>Accommodation preference<select value={draft.brief.comfortTier ?? ""} onChange={event => brief({ comfortTier: event.target.value as typeof draft.brief.comfortTier || undefined })}><option value="">Choose later</option><option value="budget">Budget</option><option value="comfort">Comfort</option><option value="luxury">Luxury</option></select></label>
        <details><summary>Change transfers or flight times</summary>
          {(["arrival", "departure"] as const).map(kind => {
            const date = kind === "arrival" ? initialStart : initialEnd;
            const point = draft.brief[kind];
            const label = kind === "arrival" ? "Arrival" : "Departure";
            return <div key={kind}><label>{label} location<input value={point?.location ?? ""} placeholder="Airport, hotel or town"
              onChange={event => brief({ [kind]: { ...point, location: event.target.value } })} /></label>
              {exact && date && <label>{label} local time<input type="time" value={point?.dateTime?.slice(11, 16) ?? ""}
                onChange={event => brief({ [kind]: { ...point, dateTime: event.target.value ? date + "T" + event.target.value : undefined } })} /></label>}</div>;
          })}
        </details>
        <label>Travel notes<textarea value={draft.brief.travellerNotes ?? ""} onChange={event => brief({ travellerNotes: event.target.value })} maxLength={2000} /></label>
      </div><div className="wr-v2-customize__interests" aria-label="Trip interests">{["beaches", "culture", "wildlife", "hiking", "food", "temples", "adventure", "photography"].map(interest => <label key={interest}><input type="checkbox" checked={draft.brief.interests.includes(interest as Interest)} onChange={event => brief({ interests: event.target.checked ? [...draft.brief.interests, interest as Interest] : draft.brief.interests.filter(value => value !== interest) })} />{interest}</label>)}</div></details>
      <details open><summary>Destinations and nights</summary><p>{nights} nights allocated; {draft.brief.durationDays - 1} available. Adding nights requires extending the trip or taking nights from an unlocked stay.</p>
        {draft.stops.map((stop, index) => <div key={stop.city} className="wr-v2-customize__stop"><h3>{index + 1}. {stop.city}</h3>
          <div className="wr-v2-detail__edit-buttons">
            <button type="button" disabled={index === 0 || stop.locked} onClick={() => moveBase(index, -1)}>Move {stop.city} earlier</button>
            <button type="button" disabled={index === draft.stops.length - 1 || stop.locked} onClick={() => moveBase(index, 1)}>Move {stop.city} later</button>
          </div>
          <label>Nights in {stop.city}<input type="number" min="1" max="20" value={stop.nights || ""} onChange={event => updateStop(index, { nights: Number(event.target.value) })} /></label>
          {stop.nights > 1 && !stop.locked && draft.stays[stop.city]?.status !== "TRAVELLER_BOOKED" && <label>Give one night from {stop.city} to
            <select value="" onChange={event => {
              const recipient = event.target.value;
              if (recipient) change(value => ({ ...value, stops: value.stops.map(base =>
                base.city === stop.city ? { ...base, nights: base.nights - 1 } :
                  base.city === recipient ? { ...base, nights: base.nights + 1 } : base) }));
            }}><option value="">Choose another base</option>{draft.stops.filter(base => base.city !== stop.city && !base.locked && draft.stays[base.city]?.status !== "TRAVELLER_BOOKED")
              .map(base => <option key={base.city}>{base.city}</option>)}</select></label>}
          <label>Priority for {stop.city}<select value={stop.requirement} onChange={event => updateStop(index, { requirement: event.target.value as "MUST" | "OPTIONAL" })}><option value="MUST">Must visit</option><option value="OPTIONAL">Optional</option></select></label>
          <label><input type="checkbox" checked={!!stop.locked} onChange={event => updateStop(index, { locked: event.target.checked })} />Lock these dates and nights</label>
          <div className="wr-v2-detail__edit-buttons">{([-1, 1] as const).map(direction => <button type="button" key={direction} disabled={index + direction < 0 || index + direction >= draft.stops.length} onClick={() => change(value => { const stops = [...value.stops]; [stops[index], stops[index + direction]] = [stops[index + direction], stops[index]]; return { ...value, stops }; })}>{direction < 0 ? "Earlier" : "Later"} {stop.city}</button>)}
            <button type="button" disabled={!!stop.locked} onClick={() => change(value => ({ ...value, stops: value.stops.filter(item => item.city !== stop.city), wishlist: [...value.wishlist, { city: stop.city, requirement: stop.requirement, role: "VISIT" }] }))}>Keep {stop.city} as a visit request</button>
            <button type="button" disabled={stop.requirement === "MUST" || !!stop.locked} onClick={() => change(value => ({ ...value, stops: value.stops.filter(item => item.city !== stop.city), wishlist: [...value.wishlist.filter(item => item.city !== stop.city), { city: stop.city, requirement: "EXCLUDED", role: "BASE" }] }))}>Exclude {stop.city}</button>
          </div>
          <details><summary>Stay in {stop.city}</summary>
            <label>Catalog property in {stop.city}<select value={draft.stays[stop.city]?.placeId ?? ""} onChange={event => { const hotel = session.detailed!.places.find(place => place.databaseId === event.target.value); updateStay(stop.city, { placeId: hotel?.databaseId, name: hotel?.name }); }}><option value="">Choose an area or enter your own property</option>{session.detailed!.places.filter(place => place.city === stop.city && place.category === "hotel").map(place => <option key={place.databaseId} value={place.databaseId}>{place.name}</option>)}</select></label>
            <label>Accommodation area in {stop.city}<input value={draft.stays[stop.city]?.area ?? ""} onChange={event => updateStay(stop.city, { area: event.target.value })} /></label>
            <label>Your property name in {stop.city}<input value={draft.stays[stop.city]?.name ?? ""} disabled={!!draft.stays[stop.city]?.placeId} onChange={event => updateStay(stop.city, { name: event.target.value })} /></label>
            <label>Rooms needed in {stop.city}<input type="number" min="1" max="12" value={draft.stays[stop.city]?.rooms ?? ""} onChange={event => updateStay(stop.city, { rooms: event.target.value ? Number(event.target.value) : undefined })} /></label>
            <p>Enter a room rate from your quote or booking. For a personal budget target, use planning allowances instead.</p>
            <label>Your recorded price per room per night ({draft.stays[stop.city]?.rateCurrency ?? draft.brief.budget.currency})<input type="number" min="0" step="0.01" value={draft.stays[stop.city]?.nightlyRoomAmount ?? ""} onChange={event => updateStay(stop.city, { nightlyRoomAmount: event.target.value ? Number(event.target.value) : undefined, rateCurrency: draft.stays[stop.city]?.rateCurrency ?? draft.brief.budget.currency })} /></label>
            <label>Recorded rate currency for {stop.city}<select value={draft.stays[stop.city]?.rateCurrency ?? draft.brief.budget.currency} onChange={event => updateStay(stop.city, { rateCurrency: event.target.value as typeof draft.brief.budget.currency })}>{["USD", "EUR", "GBP", "AUD", "LKR"].map(currency => <option key={currency}>{currency}</option>)}</select></label>
            <label>Arrangement for {stop.city}<select value={draft.stays[stop.city]?.status ?? "PROPOSED"} onChange={event => updateStay(stop.city, { status: event.target.value as ArrangementStatus })}>{ARRANGEMENTS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label>Room or booking notes for {stop.city}<textarea value={draft.stays[stop.city]?.notes ?? ""} onChange={event => updateStay(stop.city, { notes: event.target.value })} maxLength={1000} /></label><p>Catalog entries do not establish current rates, amenities, room capacity or availability. Recorded bookings are your report and are not independently verified.</p>
          </details></div>)}
        <div className="wr-v2-customize__fields"><label>Add destination<select value={city} onChange={event => setCity(event.target.value)}><option value="">Choose a destination</option>{knownPlanningDestinations().filter(item => !draft.stops.some(stop => stop.city === item.name)).map(item => <option key={item.id}>{item.name}</option>)}</select></label>
          <button type="button" disabled={!city || draft.stops.length >= 8} onClick={() => { change(value => ({ ...value, stops: [...value.stops, { city, nights: 1, requirement: "OPTIONAL" }], wishlist: value.wishlist.filter(item => item.city !== city) })); setCity(""); }}>Add overnight base</button></div>
        <DestinationHint cities={draft.stops.map(stop => stop.city)} days={draft.brief.durationDays}
          start={draft.brief.arrival?.location ?? null} end={draft.brief.departure?.location ?? null}
          lockedOrder={draft.stops.some(stop => stop.locked || draft.stays[stop.city]?.status === "TRAVELLER_BOOKED") || Object.values(draft.transport).some(leg => leg.status === "TRAVELLER_BOOKED")} />
        {draft.wishlist.map(item => <div className="wr-v2-customize__stop" key={item.city}><h3>{item.city} · {item.requirement === "EXCLUDED" ? "Excluded" : "Day visit"}</h3>
          <label>Priority for requested {item.city}<select value={item.requirement} onChange={event => change(value => ({ ...value, wishlist: value.wishlist.map(entry => entry.city === item.city ? { ...entry, requirement: event.target.value as typeof item.requirement, ...(event.target.value === "EXCLUDED" ? { day: undefined } : {}) } : entry) }))}><option value="MUST">Must visit</option><option value="OPTIONAL">Optional</option><option value="EXCLUDED">Exclude from this plan</option></select></label>
          {item.requirement !== "EXCLUDED" && <><label>Day for visiting {item.city}<select value={item.day ?? ""} onChange={event => change(value => ({ ...value, wishlist: value.wishlist.map(entry => entry.city === item.city ? { ...entry, day: event.target.value ? Number(event.target.value) : undefined } : entry) }))}><option value="">Keep as an unscheduled request</option>{visitBases.map((base, index) => ({ base, day: index + 1 })).filter(day => day.day > 1 && day.day < draft.brief.durationDays && visitBases[day.day - 2] === day.base && day.base !== item.city && !draft.wishlist.some(other => other.city !== item.city && other.day === day.day)).map(day => <option key={day.day} value={day.day}>Day {day.day} · return to {day.base}</option>)}</select></label>
          <label>Transport for visiting {item.city}<select value={item.mode ?? (draft.brief.transportPreference === "PRIVATE_DRIVER" ? "PRIVATE_DRIVER" : "UNASSIGNED")} onChange={event => change(value => ({ ...value, wishlist: value.wishlist.map(entry => entry.city === item.city ? { ...entry, mode: event.target.value as TransportMode } : entry) }))}>{MODES.map(mode => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select></label>
          <p>A day visit returns to the same overnight base. Both transfers need arranging; unsupported service times and fares stay unknown. Activity choices displaced by this visit stay in your shortlist.</p></>}
        </div>)}
      </details>
      <details><summary>Transport arrangements</summary><p>Choices apply to each leg. New connections may need their own mode after a route edit. Train, bus and unsupported journey times stay unknown.</p>
        {legs.map(leg => <div className="wr-v2-customize__stop" key={leg!.id}><h3>{leg!.fromId.replace("CMB_AIRPORT", "CMB airport")} to {leg!.toId.replace("CMB_AIRPORT", "CMB airport")}</h3>
          <label>Transport for {leg!.id}<select value={draft.transport[leg!.id]?.mode ?? leg!.mode} onChange={event => change(value => ({ ...value, brief: { ...value.brief, transportPreference: "MIXED" }, transport: { ...value.transport, [leg!.id]: { status: "PROPOSED", ...value.transport[leg!.id], mode: event.target.value as TransportMode } } }))}>{MODES.map(mode => <option key={mode.value} value={mode.value}>{mode.label}</option>)}{leg!.mode === "PUBLIC_TRANSPORT_UNSPECIFIED" && <option value="PUBLIC_TRANSPORT_UNSPECIFIED">Public transport — service to choose</option>}</select></label>
          <label>Arrangement for {leg!.id}<select value={draft.transport[leg!.id]?.status ?? "PROPOSED"} onChange={event => change(value => ({ ...value, transport: { ...value.transport, [leg!.id]: { mode: leg!.mode, ...value.transport[leg!.id], status: event.target.value as ArrangementStatus } } }))}>{ARRANGEMENTS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        </div>)}
      </details>
      <div className="wr-v2-detail__edit-buttons"><button type="button" disabled={dateProblem} onClick={() => setPreview(previewPlanningCustomization(session, draft))}>Preview changes</button><button type="button" onClick={() => onClose()}>Cancel</button></div>
      {preview && <div className="wr-v2-customize__preview" role="status"><h3>{preview.problems.length ? "Resolve these before applying" : "Review your changes"}</h3><ul>{[...preview.problems, ...preview.consequences].map((text, i) => <li key={i}>{text}</li>)}</ul>{preview.session && <button type="button" className="wr-button wr-button--primary" onClick={async () => { if (await onApply(draft)) onClose(true); }}>Apply and save changes</button>}</div>}
    </fieldset>{busy && <p role="status">Updating your itinerary and place choices…</p>}
  </section>;
}
