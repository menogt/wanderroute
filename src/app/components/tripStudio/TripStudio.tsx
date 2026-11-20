import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Bookmark, Redo2, Undo2 } from "lucide-react";
import { fetchRoadRoute } from "../../lib/osrmRoute";
import { fetchTravelMatrix, travelMatrixKey, type TravelMatrix } from "../../lib/travelTimeMatrix";
import { locations, studioPlaces, studioPlace } from "../../lib/tripStudio/catalog";
import { studioCalendar } from "../../lib/tripStudio/dates";
import { canScheduleVisit, canUseDriveTime, formatEndpoint, modes, orderAlternative, replaceBases, roadLocations,
  studioDays, studioIssues, studioLegs, wishlistOutline, type StudioBase, type StudioPlan } from "../../lib/tripStudio/model";
import { loadStudio, redoStudio, reviseStudio, saveStudio, undoStudio } from "../../lib/tripStudio/storage";
import { StudioBudget } from "./StudioBudget";
import { DestinationHint } from "../rl/DestinationHint";
import { StudioJourney } from "./StudioJourney";
import { StudioMap } from "./StudioMap";
import "../../../styles/trip-studio.css";

import { StudioNavigation, type StudioPanel } from "./StudioNavigation";

function timeLabel(minutes: number) {
  const value = Math.round(minutes);
  const hours = Math.floor(value / 60);
  return hours ? `${hours}h ${value % 60}m` : `${value} min`;
}

export default function TripStudio() {
  const [history, setHistory] = useState(loadStudio);
  const plan = history.current;
  const [panel, setPanel] = useState<StudioPanel>("places");
  const [query, setQuery] = useState("");
  const [town, setTown] = useState("");
  const [visitPlace, setVisitPlace] = useState("");
  const [selectedDay, setSelectedDay] = useState("");
  const visitForm = useRef<HTMLFormElement>(null);
  const [notice, setNotice] = useState("");
  const [stored, setStored] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [retry, setRetry] = useState(0);
  const [road, setRoad] = useState<{ key: string; matrix: TravelMatrix }>();
  const [shape, setShape] = useState<{ key: string; points: [number, number][] | null }>();

  useEffect(() => { setStored(saveStudio(history)); }, [history]);
  useEffect(() => { if (visitPlace) visitForm.current?.querySelector<HTMLElement>("select, button")?.focus(); }, [visitPlace]);
  useEffect(() => {
    const previous = document.title;
    document.title = "Trip Studio · WanderRoute";
    return () => { document.title = previous; };
  }, []);

  const points = roadLocations(plan);
  const matrixKey = travelMatrixKey(points);
  const matrix = road?.key === matrixKey ? road.matrix : undefined;
  const legs = studioLegs(plan, matrix);
  const orderedIds = [...legs.slice(0, 1).map(leg => leg.from), ...legs.map(leg => leg.to)];
  const geometryKey = JSON.stringify(orderedIds);
  const geometry = shape?.key === geometryKey ? shape.points : undefined;
  useEffect(() => {
    if (points.length < 2) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      const result = await fetchTravelMatrix(points);
      if (active) setRoad({ key: matrixKey, matrix: result });
    }, 220);
    return () => { active = false; window.clearTimeout(timer); };
  }, [matrixKey, retry]);
  useEffect(() => {
    if (orderedIds.length < 2 || orderedIds.some(id => !locations[id]?.coordinates) ||
        legs.some((leg, index) => index > 0 && leg.from !== legs[index - 1].to)) return;
    const coords = orderedIds.map(id => {
      const { latitude, longitude } = locations[id].coordinates!;
      return [latitude, longitude] as [number, number];
    });
    let active = true;
    const timer = window.setTimeout(async () => {
      const result = await fetchRoadRoute(coords);
      if (!active) return;
      const valid = Array.isArray(result) && result.length >= 2 && result.every(point =>
        Array.isArray(point) && point.length === 2 && point.every(value => Number.isFinite(value)));
      setShape({ key: geometryKey, points: valid ? result : null });
    }, 220);
    return () => { active = false; window.clearTimeout(timer); };
  }, [geometryKey, retry]);

  const issues = studioIssues(plan, matrix);
  const alternative = useMemo(() => panel === "route" ? orderAlternative(plan, matrix) : undefined, [plan, matrix, panel]);
  const outline = wishlistOutline(plan);
  const days = studioDays(plan);
  const calendar = studioCalendar(plan.dates);
  const selectedSnapshot = history.saved.find(item => item.id === selectedVersion);
  const eligibleDays = visitPlace ? days.filter(day => canScheduleVisit(plan, visitPlace, day.key)) : [];
  const placeResults = studioPlaces.filter(place => {
    if (query.trim()) return `${place.name} ${place.detail}`.toLowerCase().includes(query.trim().toLowerCase()) && (!town || place.town === town);
    return town ? place.town === town : place.kind === "destination";
  });

  function apply(next: StudioPlan) {
    setNotice("");
    setHistory(current => reviseStudio(current, next));
  }
  function changeBases(bases: StudioBase[]) {
    const changed = replaceBases(plan, bases);
    if (changed.error) setNotice(changed.error);
    else if (changed.plan) apply(changed.plan);
  }
  function wish(place: string) {
    const exists = plan.wishes.some(item => item.place === place);
    apply({ ...plan, wishes: exists ? plan.wishes.filter(item => item.place !== place) : [...plan.wishes, { place, required: false }] });
  }
  function addVisit() {
    const dayKey = selectedDay || eligibleDays[0]?.key;
    if (!dayKey || !canScheduleVisit(plan, visitPlace, dayKey) || plan.visits.some(visit => visit.place === visitPlace)) return;
    apply({ ...plan, visits: [...plan.visits, { place: visitPlace, dayKey }] });
    setVisitPlace("");
    setNotice(`Added ${studioPlace.get(visitPlace)?.name} to your journey.`);
  }
  function openTown(value: string) {
    setTown(value); setQuery(""); setPanel("places");
  }
  function saveVersion() {
    const id = new Date().toISOString();
    setHistory(value => ({ ...value, saved: [{ id, plan: value.current }, ...value.saved.filter(item => item.id !== id)].slice(0, 5) }));
    setSelectedVersion(id);
  }
  const displayEndpoints = [formatEndpoint(plan.start), formatEndpoint(plan.end)];
  return <main className="wr-studio" data-view={panel}>
    <header className="wr-studio__masthead">
      <div className="wr-studio__wrap">
        <a className="wr-studio__back" href="/"><ArrowLeft size={16} aria-hidden="true" /> WanderRoute</a>
        <div className="wr-studio__title-row">
          <div><p className="wr-studio__eyebrow">Sri Lanka</p><h1>Trip Studio</h1>
            <p>Collect places, shape your route and see what still needs checking.</p>
            <a href="/?plan">Generate a trip from my preferences</a></div>
          <div className="wr-studio__history">
            <button aria-label="Undo" disabled={!history.past.length} onClick={() => { setHistory(undoStudio); setNotice(""); }}><Undo2 size={18} aria-hidden="true" /></button>
            <button aria-label="Redo" disabled={!history.future.length} onClick={() => { setHistory(redoStudio); setNotice(""); }}><Redo2 size={18} aria-hidden="true" /></button>
            <button onClick={saveVersion}><Bookmark size={16} aria-hidden="true" /> Save version</button>
          </div>
        </div>
        <p className="wr-studio__storage" role="status">{stored ? "Draft saved in this browser" : "This browser could not save your draft"}</p>
      </div>
    </header>
    <div className="wr-studio__wrap">
      <StudioNavigation panel={panel} select={value => { setPanel(value); setNotice(""); }} />
      {notice && <p role="status" className="wr-studio__notice">{notice}</p>}
      <div className="wr-studio__layout">
        <section className="wr-studio__panel" id="studio-panel">
          {panel === "places" && <>
            <header className="wr-studio__panel-heading"><h2>My Places</h2><p>Save ideas or add a place to the journey now.</p></header>
            {!plan.bases.length && <div className="wr-studio__start">
              <p>Start with a short outline or build your own.</p>
              <button className="wr-studio__button" onClick={() => {
                changeBases([{ place: "Sigiriya", nights: 2 }, { place: "Kandy", nights: 2 }]); setPanel("journey");
              }}>Cultural Triangle &amp; Kandy · 4 nights</button>
            </div>}
            <div className="wr-studio__field-grid">
              <label>Search places<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
              <label>Destination<select aria-label="Destination" value={town} onChange={event => setTown(event.target.value)}>
                <option value="">All destinations</option>
                {studioPlaces.filter(place => place.kind === "destination").map(place => <option key={place.id}>{place.name}</option>)}
              </select></label>
            </div>
            <DestinationHint cities={[...new Set([...plan.bases.map(base => base.place), ...plan.wishes.map(wish => studioPlace.get(wish.place)!.town)])]}
              days={calendar.days} start={plan.start} end={plan.end} lockedOrder={plan.bases.some(base => !!base.stay?.lock)} />
            {!!plan.wishes.length && <details className="wr-studio__detail">
              <summary>Wishlist · {plan.wishes.length}</summary>
              <ul className="wr-studio__wishlist">{plan.wishes.map(item => <li key={item.place}>
                <button className="wr-studio__link" onClick={() => openTown(studioPlace.get(item.place)!.town)}>{studioPlace.get(item.place)?.name}</button>
                <label className="wr-studio__check"><input type="checkbox" checked={item.required}
                  onChange={event => apply({ ...plan, wishes: plan.wishes.map(saved => saved.place === item.place
                    ? { ...saved, required: event.target.checked } : saved) })} /> Must visit</label>
                <button className="wr-studio__button" aria-label={`Remove ${studioPlace.get(item.place)?.name} from wishlist`}
                  onClick={() => wish(item.place)}>Remove</button>
              </li>)}</ul>
              {!plan.bases.length && (outline.bases ? <button className="wr-studio__button" onClick={() => {
                changeBases(outline.bases!); setPanel("journey");
              }}>Start from saved destinations</button> : outline.error && <p>{outline.error}</p>)}
            </details>}
            {visitPlace && <form ref={visitForm} className="wr-studio__visit" onSubmit={event => { event.preventDefault(); addVisit(); }}>
              <strong>Add {studioPlace.get(visitPlace)?.name}</strong>
              {eligibleDays.length > 0 ? <>
                <label>Journey day<select aria-label="Journey day" value={selectedDay || eligibleDays[0].key} onChange={event => setSelectedDay(event.target.value)}>
                  {eligibleDays.map(day => <option key={day.key} value={day.key}>Day {day.number} · {day.base?.place}
                    {day.base?.place !== studioPlace.get(visitPlace)?.town ? " · return visit" : ""}</option>)}
                </select></label>
                <button className="wr-studio__button wr-studio__button--primary" type="submit">Add to this day</button>
              </> : <p>Add an overnight base with a free day to schedule this visit.</p>}
              <button type="button" className="wr-studio__button" onClick={() => setVisitPlace("")}>Cancel</button>
            </form>}
            {!placeResults.length && <p>No matching places. Try a town or landmark.</p>}
            <ul className="wr-studio__places">
              {placeResults.map(place => {
                const saved = plan.wishes.some(item => item.place === place.id);
                const isBase = plan.bases.some(base => base.place === place.id);
                const visited = plan.visits.some(visit => visit.place === place.id);
                return <li key={place.id}>
                  <div>{place.kind === "destination" ? <button className="wr-studio__place-title" onClick={() => openTown(place.town)}>{place.name}</button>
                    : <strong>{place.name}</strong>}<p>{place.detail}</p></div>
                  <div className="wr-studio__actions">
                    <button aria-label={`${saved ? "Unsave" : "Save"} ${place.name}`} onClick={() => wish(place.id)}>{saved ? "Saved" : "Save"}</button>
                    {place.kind === "destination" && <button aria-label={`Stay in ${place.name}`} disabled={isBase}
                      onClick={() => changeBases([...plan.bases, { place: place.town, nights: 1 }])}>{isBase ? "Base added" : "Stay here"}</button>}
                    <button aria-label={`Plan a visit to ${place.name}`} disabled={visited} onClick={() => {
                      setVisitPlace(place.id); setSelectedDay("");
                    }}>{visited ? "Visit added" : "Day visit"}</button>
                  </div>
                </li>;
              })}
            </ul>
          </>}
          {panel === "route" && <>
            <header className="wr-studio__panel-heading"><h2>My Route</h2><p>{displayEndpoints.join(" → ")}</p></header>
            {!legs.length && <p>Add a base and choose your endpoints in My Journey to see the transfers.</p>}
            {!!legs.length && <ol className="wr-studio__legs">{legs.map((leg, index) => <li key={`${leg.day}:${index}`}>
              <div><strong>{formatEndpoint(leg.from)} → {formatEndpoint(leg.to)}</strong><p>Day {leg.day}
                {leg.kind === "visit" && " · Day visit"}
                {leg.roadMinutes === undefined ? " · Travel time unverified" : canUseDriveTime(leg.mode)
                  ? ` · Estimated drive ${timeLabel(leg.roadMinutes)}` : ` · Car reference ${timeLabel(leg.roadMinutes)}; travel time unverified`}</p></div>
              <label>Transport for this leg<select aria-label={`Transport for ${formatEndpoint(leg.from)} to ${formatEndpoint(leg.to)}`}
                value={plan.legModes[leg.id] ?? ""} onChange={event => {
                  const next = { ...plan.legModes };
                  const mode = event.target.value as StudioPlan["mode"] | "";
                  if (mode) next[leg.id] = mode;
                  else delete next[leg.id];
                  apply({ ...plan, legModes: next });
                }}>
                <option value="">Trip default · {modes[plan.mode]}</option>
                {Object.entries(modes).map(([mode, label]) => <option key={mode} value={mode}>{label}</option>)}
              </select></label>
            </li>)}</ol>}
            {alternative ? <div className="wr-studio__alternative">
              <h3>Alternative order</h3><p>{alternative.bases.map(base => base.place).join(" → ")}</p>
              <p>Car reference including both endpoints: {timeLabel(alternative.total)} vs {timeLabel(alternative.currentTotal)} currently.</p>
              <button className="wr-studio__button" onClick={() => changeBases(alternative.bases)}>Use this order</button>
            </div> : plan.bases.length > 1 && <p className="wr-studio__hint">{matrix?.source === "OSRM_TABLE"
              ? "No better order found among the checked alternatives. Locked stays and existing visits are retained."
              : "A route comparison needs road estimates for both endpoints and every base."}</p>}
            {legs.length > 0 && (matrix?.source === "UNAVAILABLE" || geometry === null) &&
              <button className="wr-studio__button" onClick={() => setRetry(value => value + 1)}>Retry road checks</button>}
          </>}
          {panel === "journey" && <StudioJourney plan={plan} apply={apply} changeBases={changeBases} browse={() => setPanel("places")} />}
          {panel === "budget" && <StudioBudget plan={plan} apply={apply} />}
        </section>
        <aside className="wr-studio__sidebar" aria-label="Route map and journey checks">
          <section className="wr-studio__map-panel" aria-label="Route map">
            <header><h2>Route map</h2><span>{plan.bases.length} {plan.bases.length === 1 ? "base" : "bases"}</span></header>
            <StudioMap plan={plan} geometry={geometry ?? undefined} browse={openTown} />
            <p>{geometry ? "Dotted line shows routed roads. Rail and bus services need separate confirmation."
              : legs.length ? "Road line unverified. Route stops are shown." : "Choose a pin to explore its destination."}</p>
          </section>
          {!!issues.length && <section className="wr-studio__checks">
            <h2>Journey checks</h2>
            <ul>{issues.map(issue => <li key={issue.message}><strong>{{
              conflict: "Needs resolving", advice: "Worth checking", unknown: "Unverified",
            }[issue.severity]}</strong> {issue.message}</li>)}</ul>
          </section>}
          {!!history.saved.length && <details className="wr-studio__detail">
            <summary>Compare saved versions</summary>
            <label>Saved version<select aria-label="Saved version" value={selectedVersion} onChange={event => setSelectedVersion(event.target.value)}>
              <option value="">Select a version</option>{history.saved.map(item => <option key={item.id} value={item.id}>
                {new Date(item.id).toLocaleString()} · {item.plan.bases.length} bases
              </option>)}
            </select></label>
            {selectedSnapshot && <>
              <p><strong>Current</strong> · {plan.bases.map(base => `${base.place} (${base.nights}n)`).join(" → ") || "No bases"} · {calendar.days ?? "Open"} days</p>
              <p><strong>Saved</strong> · {selectedSnapshot.plan.bases.map(base => `${base.place} (${base.nights}n)`).join(" → ") || "No bases"} · {studioCalendar(selectedSnapshot.plan.dates).days ?? "Open"} days</p>
              <button className="wr-studio__button" onClick={() => apply(selectedSnapshot.plan)}>Restore this version</button>
            </>}
          </details>}
        </aside>
      </div>
    </div>
  </main>;
}
