import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronUp, Clock3, MapPin, Pencil, Redo2,
  RefreshCw, Trash2, Undo2, WalletCards } from "lucide-react";
import { PlanningReviewPanel } from "./PlanningReviewPanel";
import { PlanningShortlist } from "./PlanningShortlist";
import { PlanningCustomizationPanel } from "./PlanningCustomizationPanel";
import type { PlanningV2Session } from "../../lib/planningV2Session";
import type { CustomizationDraft } from "../../lib/planningCustomization";
import { PlanningBudgetPanel } from "./PlanningBudgetPanel";
import { PlanningItineraryMap } from "./PlanningItineraryMap";
import type { DetailedPlanningResult } from "../../lib/planningV2Itinerary";
import type { PlanningV2Edit } from "../../lib/planningV2Editing";
import { eligibleActivityPlaces } from "../../lib/planningV2Places";
import type { PlanningRouteConcept } from "../../lib/planningV2";
import type { TripBriefV1 } from "../../lib/planningTypes";
import type { CostLedger, AmountSummary } from "../../lib/costLedger";
import type { TransportLeg } from "../../lib/transportTypes";
import "../../../styles/planning-v2.css";
import "../../../styles/planning-v2-itinerary.css";

const STATUS = { READY: "Ready", READY_WITH_WARNINGS: "Ready with warnings",
  NEEDS_CONFIRMATION: "Needs confirmation", INVALID: "Cannot use as a ready plan" } as const;

function amountLabel(summary: AmountSummary | undefined, currency: string): string {
  if (!summary || summary.unknownCount > 0) {
    return summary?.minimum ? `At least ${currency} ${summary.minimum.toLocaleString()} plus unpriced costs` : "Price to confirm";
  }
  if (summary.exact !== undefined) return `${currency} ${summary.exact.toLocaleString()}`;
  if (summary.maximum !== undefined) return `${currency} ${summary.minimum.toLocaleString()}–${summary.maximum.toLocaleString()}`;
  return "Price to confirm";
}

function readableIssue(code: string): string {
  const names: Record<string, string> = {
    OPENING_HOURS_UNCONFIRMED: "Opening hours need confirmation",
    OPENING_HOURS_CONFLICT: "An activity conflicts with known opening hours",
    TRANSPORT_TIME_UNKNOWN: "A transfer time is unknown",
    TRANSFER_SCHEDULE_TIME_UNKNOWN: "A transfer cannot be timed yet",
    BUDGET_UNKNOWN: "Budget fit cannot be confirmed",
    SEASON_UNKNOWN: "Seasonal conditions need confirmation",
    HARD_DRIVING_LIMIT_EXCEEDED: "Daily driving exceeds the hard limit",
    ITEMS_OVERLAP: "Scheduled items overlap",
    TRANSFER_TIME_INSUFFICIENT: "A transfer needs more time",
  };
  return names[code] ?? code.toLowerCase().replace(/_/g, " ").replace(/^./, letter => letter.toUpperCase());
}

function itemCost(ledger: CostLedger, itemId: string): string {
  const line = ledger.lines.find(entry => entry.input.id === `cost:${itemId}`);
  if (!line) return "Price to confirm";
  return amountLabel(line.total ? { ...line.total, unknownCount: 0 } : undefined, ledger.currency);
}

export function PlanningV2ItineraryScreen({ detail, concept, brief, busy, error, editError,
  canUndo, canRedo, session, onCustomize, onFinalize, onBack, onRetry, onEdit, onUndo, onRedo }: {
  session: PlanningV2Session;
  onFinalize: (revision: string) => void;
  onCustomize: (draft: CustomizationDraft) => Promise<boolean>;
  detail: DetailedPlanningResult;
  concept: PlanningRouteConcept;
  brief: TripBriefV1;
  busy: boolean;
  error?: string;
  editError?: string;
  canUndo: boolean;
  canRedo: boolean;
  onBack: () => void;
  onRetry: () => void;
  onEdit: (edit: PlanningV2Edit) => void;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const [activeDay, setActiveDay] = useState(1);
  const [customizing, setCustomizing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string>();
  const [mobilePane, setMobilePane] = useState("itinerary");
  const [search, setSearch] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const editHeading = useRef<HTMLHeadingElement>(null);
  const commitEdit = (edit: PlanningV2Edit) => { onEdit(edit); setAnnouncement("Edit checked. Review your itinerary and any messages shown."); if (edit.type === "remove" || edit.type === "move") editHeading.current?.focus(); };
  const { itinerary, ledger, validation } = detail;
  useEffect(() => { setActiveDay(value => Math.min(value, itinerary.days.length)); }, [itinerary.days.length]);
  const day = itinerary.days[activeDay - 1] ?? itinerary.days[0];
  const dayActivities = day.items.filter(item => item.category === "activity");
  const paceLimit = 6;
  const additions = eligibleActivityPlaces(detail.places, day.city).filter(place => !dayActivities.some(item => item.placeId === place.databaseId) && place.name.toLowerCase().includes(search.toLowerCase()));
  const legs = new Map([...concept.transport.legs, concept.transport.arrivalTransfer, concept.transport.departureTransfer]
    .filter((leg): leg is TransportLeg => !!leg).map(leg => [leg.id, leg]));
  const visibleIssues = validation.issues.filter(issue => !issue.code.startsWith("COST_")).slice(0, 10);
  return <section className="wr-v2 wr-v2-detail" aria-labelledby="wr-v2-detail-title">
    <div className="wr-v2__masthead"><div className="wr-v2__wrap">
      <button type="button" className="wr-v2__back" onClick={() => setCustomizing(true)}><ArrowLeft size={17} /> Adjust your journey</button>
      <p className="wr-kicker">Day-by-day route draft</p>
      <h1 id="wr-v2-detail-title">{itinerary.routeName}</h1>
      <p>{itinerary.totalDays} days · {itinerary.totalPeople} {itinerary.totalPeople === 1 ? "traveller" : "travellers"} · Your Sri Lanka travel draft.</p>
    </div></div>
    <div className="wr-v2__wrap wr-v2-detail__body">
      <div className="wr-v2-detail__overview">
        <div><span className={`wr-v2__status wr-v2__status--${detail.readiness.toLowerCase().replace(/_/g, "-")}`}>{STATUS[detail.readiness]}</span>
          <h2 className="wr-sr-only">Your itinerary</h2><p>{detail.generationMode === "LIMITED_DRAFT" ? "Limited draft from available place records." :
            "Activity choices were checked against available place records."} Transport and prices remain uncertain where marked.</p></div>
        <div className="wr-v2-detail__actions">
          {detail.generationMode === "LIMITED_DRAFT" && !canUndo && !canRedo && <button type="button" className="wr-button wr-button--primary" onClick={onRetry} disabled={busy}>
            <RefreshCw size={16} /> {busy ? "Retrying…" : "Retry suggestions"}</button>}
          <button type="button" className="wr-v2-detail__edit-toggle" disabled={busy} onClick={() => setCustomizing(value => !value)} aria-expanded={customizing}>Customize journey</button>
          <button type="button" className="wr-v2-detail__edit-toggle" onClick={() => setEditing(value => !value)}
            aria-expanded={editing}><Pencil size={16} aria-hidden="true" /> {editing ? "Finish editing" : "Edit activities"}</button>
          <button type="button" className="wr-v2__text-link" onClick={() => setCustomizing(true)}>Compare routes</button>
        </div>
      </div>
      {error && <div className="wr-v2__alert" role="alert"><AlertTriangle size={18} /> {error}</div>}
      {editError && <div className="wr-v2__alert" role="alert"><AlertTriangle size={18} /> {editError}</div>}
      {customizing && <PlanningCustomizationPanel session={session} busy={busy} onApply={onCustomize} onClose={() => setCustomizing(false)} />}
      {brief.requestedCities.some(city => !itinerary.cities.includes(city)) && <section className="wr-v2__alert"><strong>Visits still to arrange</strong><p>{brief.requestedCities.filter(city => !itinerary.cities.includes(city)).join(", ")} have not been scheduled. Keep these requests in view while adjusting your bases and trip length.</p></section>}
      {editing && <div className="wr-v2-detail__edit-toolbar" aria-label="Activity editing history">
        <p>Changes stay in this planning session. Times, costs and feasibility are recalculated after each edit.</p>
        <div><button type="button" onClick={() => { onUndo(); editHeading.current?.focus(); }} disabled={busy || !canUndo}><Undo2 size={16} aria-hidden="true" /> Undo</button>
          <button type="button" onClick={() => { onRedo(); editHeading.current?.focus(); }} disabled={busy || !canRedo}><Redo2 size={16} aria-hidden="true" /> Redo</button></div>
      </div>}
      {validation.errors.length > 0 && <div className="wr-v2__alert" role="alert">This draft has conflicts to resolve: {validation.errors.map(issue => readableIssue(issue.code)).join(" · ")}. Keep editing to resolve them.</div>}
      <nav className="wr-v2-detail__day-nav" aria-label="Itinerary days">
        {itinerary.days.map(item => <button key={item.day} type="button" aria-current={activeDay === item.day ? "step" : undefined}
          className={activeDay === item.day ? "is-active" : ""} onClick={() => setActiveDay(item.day)}>
          <span>Day {String(item.day).padStart(2, "0")}</span><strong>{item.city}</strong></button>)}
      </nav>
      <div className="wr-v2-detail__mobile-switch" aria-label="Workspace view"><button type="button" aria-pressed={mobilePane === "itinerary"} onClick={() => setMobilePane("itinerary")}>Itinerary</button><button type="button" aria-pressed={mobilePane === "map"} onClick={() => setMobilePane("map")}>Route map</button></div>
      <div className={`wr-v2-detail__grid is-${mobilePane}`}>
        <article className="wr-v2-detail__day">
          <header><p className="wr-kicker">Day {String(day.day).padStart(2, "0")}{day.date ? ` · ${day.date}` : ""}</p>
            <h2 ref={editHeading} tabIndex={-1}>{day.city}</h2><p>{day.overnightCity ? `Overnight in ${day.overnightCity}` : "Departure day"}</p></header>
          <ol className="wr-v2-detail__timeline">
            {day.items.map(item => {
              const leg = item.transportLegId ? legs.get(item.transportLegId) : undefined;
              const activityIndex = dayActivities.findIndex(activity => activity.id === item.id);
              const replacements = item.category === "activity" ? eligibleActivityPlaces(detail.places, day.city)
                .filter(place => place.databaseId !== item.placeId && !dayActivities.some(activity =>
                  activity.id !== item.id && activity.placeId === place.databaseId)) : [];
              const compatibleDays = item.category === "activity" ? itinerary.days.filter(candidate =>
                candidate.day !== day.day && candidate.city.toLowerCase() === day.city.toLowerCase() &&
                candidate.items.filter(entry => entry.category === "activity").length < paceLimit &&
                (!item.placeId || !candidate.items.some(entry => entry.placeId === item.placeId))) : [];
              return <li key={item.id} className={selectedItemId === item.id ? "is-selected" : undefined}>
                <span className="wr-v2-detail__time">{item.plannedStart ?? item.time}</span>
                <div><button type="button" className="wr-v2-detail__activity-name" aria-pressed={selectedItemId === item.id} onClick={() => { setSelectedItemId(item.id); }}>{item.label}</button><p>{item.detail}</p>
                  {leg && <small>{leg.mode.replace(/_/g, " ").toLowerCase()} · {leg.durationMinutes === undefined ?
                    "journey time unknown" : `${Math.ceil(leg.durationMinutes)} min road-driving estimate`}</small>}
                  {item.category === "activity" && !item.isFreeTime && <small>{item.durationMinutes} min visit estimate · Opening hours {detail.places.find(place => place.databaseId === item.placeId)?.openingHours ? "to check" : "unknown"}</small>}
                  <small>{item.isFreeTime ? "Personal time; include any spending in your allowances." : itemCost(ledger, item.id)}</small>
                  {editing && item.category === "activity" && <div className="wr-v2-detail__item-editor">
                    <div className="wr-v2-detail__edit-buttons">
                      <button type="button" disabled={activityIndex === 0} onClick={() => commitEdit({ type: "reorder", itemId: item.id, direction: -1 })}
                        aria-label={`Move ${item.label} earlier`}><ChevronUp size={16} aria-hidden="true" /> Earlier</button>
                      <button type="button" disabled={activityIndex === dayActivities.length - 1} onClick={() => commitEdit({ type: "reorder", itemId: item.id, direction: 1 })}
                        aria-label={`Move ${item.label} later`}><ChevronDown size={16} aria-hidden="true" /> Later</button>
                      <button type="button" onClick={() => commitEdit({ type: "remove", itemId: item.id })}
                        aria-label={`Remove ${item.label}`}><Trash2 size={16} aria-hidden="true" /> Remove</button>
                    </div>
                    {!item.isFreeTime && <label>Replace {item.label} with
                      <select value="" disabled={!replacements.length} onChange={event => event.target.value &&
                        commitEdit({ type: "replace", itemId: item.id, placeId: event.target.value })}>
                        <option value="">{replacements.length ? "Choose a trusted place" : "No other place available"}</option>
                        {replacements.map(place => <option key={place.databaseId} value={place.databaseId}>{place.name}</option>)}
                      </select>
                    </label>}
                    <label>Preferred start for {item.label}<input type="time" value={item.preferredStart ?? ""} onChange={event => commitEdit({ type: "timing", itemId: item.id, durationMinutes: item.durationMinutes ?? 90, preferredStart: event.target.value || undefined })} /></label>
                    <label>Visit duration for {item.label}<select value={item.durationMinutes ?? 90} onChange={event => commitEdit({ type: "timing", itemId: item.id, durationMinutes: Number(event.target.value), preferredStart: item.preferredStart })}>{[30,60,90,120,180,240].map(minutes => <option key={minutes} value={minutes}>{minutes} minutes</option>)}</select></label>
                    {compatibleDays.length > 0 && <label>Move {item.label} to
                      <select value="" onChange={event => event.target.value &&
                        commitEdit({ type: "move", itemId: item.id, targetDay: Number(event.target.value) })}>
                        <option value="">Choose a {day.city} day</option>
                        {compatibleDays.map(candidate => <option key={candidate.day} value={candidate.day}>Day {candidate.day}</option>)}
                      </select>
                    </label>}
                  </div>}</div>
              </li>;
            })}
          </ol>
          {editing && <div className="wr-v2-detail__item-editor"><h3>Add to day {day.day}</h3><label>Search places in {day.city}<input value={search} onChange={event => setSearch(event.target.value)} type="search" /></label><label>Add an activity<select value="" onChange={event => event.target.value && commitEdit({ type: "add", day: day.day, placeId: event.target.value })}><option value="">{additions.length ? "Choose a place" : "No matching places"}</option>{additions.map(place => <option key={place.databaseId} value={place.databaseId}>{place.name}</option>)}</select></label><button type="button" onClick={() => commitEdit({ type: "free-time", day: day.day })}>Add free time</button>{detail.unscheduledActivities?.filter(item => item.city === day.city).map(item => <button type="button" key={item.id} onClick={() => commitEdit({ type: "restore", day: day.day, itemId: item.id })}>Restore {item.label}</button>)}</div>}
          <p className="wr-sr-only" role="status">{announcement}</p>
          {day.overnightCity && <div className="wr-v2-detail__stay"><h3>Your stay</h3><p>{day.accommodation}</p><small>{detail.customization?.stays[day.city]?.status === "TRAVELLER_BOOKED" ? "You report this is booked; not independently verified." : detail.customization?.stays[day.city]?.status === "NEEDS_BOOKING" ? "Needs booking; availability and rates must be confirmed." : detail.customization?.stays[day.city]?.status === "CHANGED_CANCELLED" ? "You recorded this arrangement as changed/cancelled. Choose or confirm another stay." : "Proposed; availability and room price need confirmation."}</small>{detail.customization?.stays[day.city]?.rooms && <small>{detail.customization.stays[day.city].rooms} rooms requested; occupancy needs checking.</small>}</div>}
          <div className="wr-v2-detail__day-cost"><span>Day cost</span><strong>{amountLabel(ledger.summary.byDay[day.day], ledger.currency)}</strong></div>
          {day.warnings && day.warnings.length > 0 && <details className="wr-v2-detail__day-warnings"><summary>Checks for this day</summary><ul>{day.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
        </article>
        <aside className="wr-v2-detail__aside">
          <PlanningItineraryMap detail={detail} brief={brief} activeDay={day.day} selectedItemId={selectedItemId} onDay={setActiveDay} onItem={id => { setSelectedItemId(id); setMobilePane("itinerary"); }} />
          <section><h2>Route and season</h2><ol>{concept.routeConcept.stops.map(stop => <li key={stop.id}>{stop.destinationName} · {stop.nights} {stop.nights === 1 ? "night" : "nights"}</li>)}</ol>
            <p>{concept.routeConcept.seasonalAssessment?.status === "SUITABLE" ? "No mapped seasonal warning." :
              concept.routeConcept.seasonalAssessment?.reasons.join(" · ") || "Seasonal conditions need confirmation."}</p></section>
          <section><details><summary>What needs checking</summary>{visibleIssues.length ? <ul>{visibleIssues.map((issue, index) => <li key={`${issue.code}-${index}`}>
            <AlertTriangle size={15} /><span>{readableIssue(issue.code)}{issue.day ? ` · day ${issue.day}` : ""}</span></li>)}</ul> : <p>No validation issues found.</p>}</details></section>
          <section><h2>Supported cost categories</h2><dl>{Object.entries(ledger.summary.byCategory).filter(([, summary]) => summary.minimum > 0 || summary.unknownCount > 0).map(([category, summary]) =>
            <div key={category}><dt>{category.toLowerCase().replace(/_/g, " ")}</dt><dd>{amountLabel(summary, ledger.currency)}</dd></div>)}</dl></section>
        </aside>
      </div>
      <PlanningShortlist detail={detail} onEdit={commitEdit} />
      <div className="wr-v2-detail__summary" aria-label="Trip costs and status">
        <div><WalletCards size={19} /><span>Whole trip</span><strong>{amountLabel(ledger.summary.trip, ledger.currency)}</strong></div>
        <div><WalletCards size={19} /><span>Per traveller</span><strong>{amountLabel(ledger.summary.perPerson, ledger.currency)}</strong></div>
        <div><MapPin size={19} /><span>Your budget target</span><strong>{brief.budget.currency} {brief.budget.amount.toLocaleString()}</strong></div>
      </div>
      <PlanningBudgetPanel detail={detail} brief={brief} onAllowance={(group, allowance) => commitEdit({ type: "allowance", group, allowance })} />
      <PlanningReviewPanel detail={detail} brief={brief} concept={concept} busy={busy} approvedRevision={session.preferredRevision} onFinalize={onFinalize} />
      <p className="wr-v2-detail__footer"><Clock3 size={16} /> Activity durations are estimates. Train, bus and other unverified transfers have no invented timetable.</p>
    </div>
  </section>;
}
