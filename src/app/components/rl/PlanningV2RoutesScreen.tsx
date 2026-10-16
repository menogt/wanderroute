import { ArrowLeft, ArrowRight, AlertTriangle, Clock3, MapPin, RefreshCw, Route, WalletCards } from "lucide-react";
import type { PlanningRouteConcept, PlanningV2Result, ConceptReadiness, PlanningV2Issue } from "../../lib/planningV2";
import type { TripBriefV1 } from "../../lib/planningTypes";
import type { PlanningV2Session } from "../../lib/planningV2Session";
import { selectedPlanningConcept } from "../../lib/planningV2Session";
import "../../../styles/planning-v2.css";

const STATUS: Record<ConceptReadiness, string> = {
  READY: "Ready", READY_WITH_WARNINGS: "Ready with warnings",
  NEEDS_CONFIRMATION: "Needs confirmation", INVALID: "Cannot use this route",
};
const TRANSPORT: Record<string, string> = {
  PRIVATE_DRIVER: "Private driver", PUBLIC_TRANSPORT: "Public transport",
  MIXED: "Mixed transport", TUK_TUK_SELF_DRIVE: "Tuk-tuk / self-drive",
  RECOMMEND: "Transport recommendation pending",
};

function timeLabel(minutes?: number): string {
  if (minutes === undefined) return "Unknown";
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return `${hours ? `${hours}h ` : ""}${rest ? `${rest}m` : ""}`.trim() || "0m";
}

function costLabel(concept: PlanningRouteConcept): string {
  const { summary, currency } = concept.ledger;
  if (summary.unknownCostCount > 0) {
    return summary.minimumKnownTripEstimate > 0
      ? `At least ${currency} ${summary.minimumKnownTripEstimate.toLocaleString()} plus unpriced costs`
      : "Estimate incomplete";
  }
  if (summary.trip.exact !== undefined) return `${currency} ${summary.trip.exact.toLocaleString()}`;
  if (summary.trip.maximum !== undefined) return `${currency} ${summary.trip.minimum.toLocaleString()}–${summary.trip.maximum.toLocaleString()}`;
  return "Estimate incomplete";
}

function transportLabel(concept: PlanningRouteConcept, brief: TripBriefV1): string {
  if (brief.transportPreference === "MIXED") {
    const modes = [...new Set(concept.transport.legs.map(leg => leg.mode))];
    return modes.every(mode => mode === "UNASSIGNED") ? "Mixed · leg modes to confirm" :
      `Mixed · ${modes.map(mode => TRANSPORT[mode] ?? mode.toLowerCase().replace(/_/g, " ")).join(" + ")}`;
  }
  return TRANSPORT[brief.transportPreference ?? ""] ?? "Transport mode not chosen";
}

function conceptTitle(concept: PlanningRouteConcept): string {
  const stops = concept.candidate.destinations;
  return stops.length === 1 ? `${stops[0].name} base` : `${stops[0].name} to ${stops[stops.length - 1].name}`;
}

function ConceptCard({ concept, brief, index, onSelect }: {
  concept: PlanningRouteConcept; brief: TripBriefV1; index: number; onSelect?: (id: string) => void;
}) {
  const selectable = concept.readiness !== "INVALID" && !!onSelect;
  const season = concept.routeConcept.seasonalAssessment;
  const issueList = concept.issues.filter(issue => issue.code !== "DESTINATION_SWITCHING");
  return (
    <article className={`wr-v2__concept wr-v2__concept--${concept.readiness.toLowerCase().replace(/_/g, "-")}`}>
      <div className="wr-v2__concept-top">
        <span className="wr-v2__concept-index">Route {String(index + 1).padStart(2, "0")}</span>
        <span className={`wr-v2__status wr-v2__status--${concept.readiness.toLowerCase().replace(/_/g, "-")}`}>
          {STATUS[concept.readiness]}
        </span>
      </div>
      <h2>{conceptTitle(concept)}</h2>
      <p className="wr-v2__recommendation">{concept.recommendation}</p>
      <ol className="wr-v2__stops" aria-label="Route destinations and nights">
        {concept.routeConcept.stops.map((stop, stopIndex) => <li key={stop.id}>
          <span className="wr-v2__stop-dot" aria-hidden="true" />
          <span><strong>{stop.destinationName}</strong><small>{stop.nights} {stop.nights === 1 ? "night" : "nights"}</small></span>
          {stopIndex < concept.routeConcept.stops.length - 1 && <span className="wr-v2__stop-line" aria-hidden="true" />}
        </li>)}
      </ol>
      <dl className="wr-v2__facts">
        <div><dt><Route size={15} /> Transport</dt><dd>{transportLabel(concept, brief)}</dd></div>
        <div><dt><Clock3 size={15} /> Known private-driver road time</dt>
          <dd>{concept.knownDrivingMinutes !== undefined ? `${timeLabel(concept.knownDrivingMinutes)} total · ${timeLabel(concept.longestKnownDrivingLegMinutes)} longest leg` : "No applicable car-time estimate"}</dd></div>
        <div><dt><WalletCards size={15} /> Cost</dt><dd>{costLabel(concept)}</dd></div>
        <div><dt><MapPin size={15} /> Season</dt><dd>{season?.status === "SUITABLE" ? "No mapped seasonal warning" :
          season?.status === "CAUTION" ? "Seasonal caution" : season?.status === "UNSUITABLE" ? "Strong seasonal conflict" : "Season to confirm"}</dd></div>
      </dl>
      {concept.ledger.summary.unknownCostCount > 0 && <p className="wr-v2__cost-note">
        {concept.ledger.summary.unknownCostCount} unpriced {concept.ledger.summary.unknownCostCount === 1 ? "item" : "items"}; budget fit cannot be confirmed.
      </p>}
      {issueList.length > 0 && <div className="wr-v2__issues">
        <h3>Tradeoffs and checks</h3>
        <ul>{issueList.map((issue, issueIndex) => <li key={`${issue.code}-${issueIndex}`}
          className={`is-${issue.severity.toLowerCase()}`}>
          <AlertTriangle size={15} />
          <span>{issue.detail ?? issue.code}</span>
        </li>)}</ul>
      </div>}
      {onSelect && <button type="button" className="wr-v2__select" disabled={!selectable}
        onClick={() => onSelect(concept.routeConcept.id)}>
        {selectable ? "Select this route" : "Unavailable route"} {selectable && <ArrowRight size={17} />}
      </button>}
    </article>
  );
}

export function PlanningV2RoutesScreen({ session, busy, detailBusy, detailError, externalIssues,
  onRetry, onEdit, onSelect, onCompare, onExit, onGenerateDetail, onOpenDetail }: {
  session: PlanningV2Session;
  busy: boolean;
  detailBusy: boolean;
  detailError?: string;
  externalIssues: PlanningV2Issue[];
  onRetry: () => void;
  onEdit: () => void;
  onSelect: (id: string) => void;
  onCompare: () => void;
  onExit: () => void;
  onGenerateDetail: () => void;
  onOpenDetail: () => void;
}) {
  const result = session.result as PlanningV2Result;
  const selected = selectedPlanningConcept(session);
  if (session.view === "selected" && selected) {
    return <section className="wr-v2" aria-labelledby="wr-v2-selected-title">
      <div className="wr-v2__masthead"><div className="wr-v2__wrap">
        <button type="button" className="wr-v2__back" onClick={onCompare}><ArrowLeft size={17} /> Compare routes</button>
        <p className="wr-kicker">Your selected route concept</p>
        <h1 id="wr-v2-selected-title">{conceptTitle(selected)}</h1>
        <p>Your trip brief and route choice are saved for this planning session. Build a day-by-day draft from this selected route.</p>
      </div></div>
      <div className="wr-v2__wrap wr-v2__selected-layout">
        <ConceptCard concept={selected} brief={result.brief} index={result.concepts.indexOf(selected)} />
        <aside className="wr-v2__selected-note">
          <p className="wr-kicker">Next planning step</p>
          <h2>Route selected</h2>
          <p>{result.brief.durationDays} days · {result.brief.travellerCount} {result.brief.travellerCount === 1 ? "traveller" : "travellers"} · {result.brief.budget.currency} {result.brief.budget.amount.toLocaleString()} total budget</p>
          <p>Transport timing, accommodation and activity prices still need confirmation where marked. No driver quote or booking can be sent from this concept.</p>
          {detailError && <p role="alert">{detailError}</p>}
          <button type="button" className="wr-button wr-button--primary"
            onClick={session.detailed ? onOpenDetail : onGenerateDetail} disabled={detailBusy}>
            {detailBusy ? "Building your day-by-day draft…" : session.detailed ? "View day-by-day draft" : "Build day-by-day draft"}
          </button>
          <button type="button" className="wr-button wr-button--primary" onClick={onCompare}>Compare again</button>
          <button type="button" className="wr-v2__text-link" onClick={onExit}>Return to WanderRoute</button>
        </aside>
      </div>
    </section>;
  }

  return <section className="wr-v2" aria-labelledby="wr-v2-routes-title">
    <div className="wr-v2__masthead"><div className="wr-v2__wrap">
      <button type="button" className="wr-v2__back" onClick={onEdit}><ArrowLeft size={17} /> Edit trip brief</button>
      <p className="wr-kicker">Route concepts · {result.brief.durationDays} days</p>
      <h1 id="wr-v2-routes-title">Choose the shape of your trip.</h1>
      <p>Routes are ranked from the information we can check. Prices and some transport modes still need confirmation.</p>
    </div></div>
    <div className="wr-v2__wrap wr-v2__comparison">
      {externalIssues.length > 0 && <div className="wr-v2__alert" role="alert">
        <ul>{externalIssues.map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.detail}</li>)}</ul>
      </div>}
      {result.issues.length > 0 && <div className="wr-v2__alert wr-v2__alert--soft" role="status">
        <ul>{result.issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.detail}</li>)}</ul>
        {result.matrix.failure && <button type="button" onClick={onRetry} disabled={busy}>
          <RefreshCw size={15} /> {busy ? "Retrying…" : "Retry road check"}
        </button>}
      </div>}
      {result.concepts.length > 0 ? <>
        <div className="wr-v2__comparison-head"><div><p className="wr-kicker">Compare routes</p>
          <h2>{result.concepts.length} {result.concepts.length === 1 ? "option" : "options"} for your brief</h2></div>
          <button type="button" className="wr-v2__text-link" onClick={onEdit}>Change trip details</button>
        </div>
        <div className="wr-v2__concept-list">
          {result.concepts.map((concept, index) => <ConceptCard key={concept.routeConcept.id}
            concept={concept} brief={result.brief} index={index} onSelect={onSelect} />)}
        </div>
      </> : <div className="wr-v2__empty">
        <AlertTriangle size={26} /><h2>No usable route yet</h2>
        <p>Try more days, fewer destinations, or adjust your arrival and departure times.</p>
        <button type="button" className="wr-button wr-button--primary" onClick={onEdit}>Edit trip brief</button>
      </div>}
      {result.rejected.length > 0 && <details className="wr-v2__rejected">
        <summary>{result.rejected.length} route {result.rejected.length === 1 ? "option needs" : "options need"} changes</summary>
        <div className="wr-v2__concept-list">
          {result.rejected.map((concept, index) => <ConceptCard key={concept.routeConcept.id}
            concept={concept} brief={result.brief} index={index} onSelect={onSelect} />)}
        </div>
      </details>}
      <div className="wr-v2__exit"><button type="button" className="wr-v2__text-link" onClick={onExit}>Back to the current planner</button></div>
    </div>
  </section>;
}
