import { useState } from "react";
import { AlertTriangle, ArrowLeft, Clock3, MapPin, RefreshCw, WalletCards } from "lucide-react";
import type { DetailedPlanningResult } from "../../lib/planningV2Itinerary";
import type { PlanningRouteConcept } from "../../lib/planningV2";
import type { CostLedger, AmountSummary } from "../../lib/costLedger";
import type { TransportLeg } from "../../lib/transportTypes";
import "../../../styles/planning-v2.css";
import "../../../styles/planning-v2-itinerary.css";

const STATUS = { READY: "Ready", READY_WITH_WARNINGS: "Ready with warnings",
  NEEDS_CONFIRMATION: "Needs confirmation", INVALID: "Cannot use as a ready plan" } as const;

function amountLabel(summary: AmountSummary | undefined, currency: string): string {
  if (!summary || summary.unknownCount > 0) {
    return summary?.minimum ? `At least ${currency} ${summary.minimum.toLocaleString()} plus unpriced costs` : "Estimate incomplete";
  }
  if (summary.exact !== undefined) return `${currency} ${summary.exact.toLocaleString()}`;
  if (summary.maximum !== undefined) return `${currency} ${summary.minimum.toLocaleString()}–${summary.maximum.toLocaleString()}`;
  return "Estimate incomplete";
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
  if (!line) return "Price unknown";
  return amountLabel(line.total ? { ...line.total, unknownCount: 0 } : undefined, ledger.currency);
}

export function PlanningV2ItineraryScreen({ detail, concept, busy, error, onBack, onRetry }: {
  detail: DetailedPlanningResult;
  concept: PlanningRouteConcept;
  busy: boolean;
  error?: string;
  onBack: () => void;
  onRetry: () => void;
}) {
  const [activeDay, setActiveDay] = useState(1);
  const { itinerary, ledger, validation } = detail;
  const day = itinerary.days[activeDay - 1] ?? itinerary.days[0];
  const legs = new Map([...concept.transport.legs, concept.transport.arrivalTransfer, concept.transport.departureTransfer]
    .filter((leg): leg is TransportLeg => !!leg).map(leg => [leg.id, leg]));
  const visibleIssues = validation.issues.filter(issue => issue.severity !== "WARNING" ||
    issue.code !== "REQUESTED_CITY_OMITTED").slice(0, 10);
  return <section className="wr-v2 wr-v2-detail" aria-labelledby="wr-v2-detail-title">
    <div className="wr-v2__masthead"><div className="wr-v2__wrap">
      <button type="button" className="wr-v2__back" onClick={onBack}><ArrowLeft size={17} /> Back to route comparison</button>
      <p className="wr-kicker">Day-by-day route draft</p>
      <h1 id="wr-v2-detail-title">{itinerary.routeName}</h1>
      <p>{itinerary.totalDays} days · {itinerary.totalPeople} {itinerary.totalPeople === 1 ? "traveller" : "travellers"} · Route order and overnight bases fixed by your selection.</p>
    </div></div>
    <div className="wr-v2__wrap wr-v2-detail__body">
      <div className="wr-v2-detail__overview">
        <div><span className={`wr-v2__status wr-v2__status--${detail.readiness.toLowerCase().replace(/_/g, "-")}`}>{STATUS[detail.readiness]}</span>
          <h2>Your itinerary</h2><p>{detail.generationMode === "LIMITED_DRAFT" ? "Limited draft from available place records." :
            "Activity choices were checked against available place records."} Transport and prices remain uncertain where marked.</p></div>
        <div className="wr-v2-detail__actions">
          {detail.generationMode === "LIMITED_DRAFT" && <button type="button" className="wr-button wr-button--primary" onClick={onRetry} disabled={busy}>
            <RefreshCw size={16} /> {busy ? "Retrying…" : "Retry suggestions"}</button>}
          <button type="button" className="wr-v2__text-link" onClick={onBack}>Compare routes</button>
        </div>
      </div>
      {detail.generationIssue && <div className="wr-v2__alert" role="status"><AlertTriangle size={18} /> {detail.generationIssue}</div>}
      {error && <div className="wr-v2__alert" role="alert"><AlertTriangle size={18} /> {error}</div>}
      <div className="wr-v2-detail__summary" aria-label="Trip costs and status">
        <div><WalletCards size={19} /><span>Whole trip</span><strong>{amountLabel(ledger.summary.trip, ledger.currency)}</strong></div>
        <div><WalletCards size={19} /><span>Per traveller</span><strong>{amountLabel(ledger.summary.perPerson, ledger.currency)}</strong></div>
        <div><MapPin size={19} /><span>Budget check</span><strong>{validation.budget.status.replace(/_/g, " ").toLowerCase()}</strong></div>
      </div>
      {ledger.summary.unknownCostCount > 0 && <p className="wr-v2-detail__unpriced">{ledger.summary.unknownCostCount} costs have no sourced price. The budget comparison is incomplete; no booking price is implied.</p>}
      <nav className="wr-v2-detail__day-nav" aria-label="Itinerary days">
        {itinerary.days.map(item => <button key={item.day} type="button" aria-current={activeDay === item.day ? "step" : undefined}
          className={activeDay === item.day ? "is-active" : ""} onClick={() => setActiveDay(item.day)}>
          <span>Day {String(item.day).padStart(2, "0")}</span><strong>{item.city}</strong></button>)}
      </nav>
      <div className="wr-v2-detail__grid">
        <article className="wr-v2-detail__day">
          <header><p className="wr-kicker">Day {String(day.day).padStart(2, "0")}{day.date ? ` · ${day.date}` : ""}</p>
            <h2>{day.city}</h2><p>{day.overnightCity ? `Overnight in ${day.overnightCity}` : "Departure day"}</p></header>
          <ol className="wr-v2-detail__timeline">
            {day.items.map(item => {
              const leg = item.transportLegId ? legs.get(item.transportLegId) : undefined;
              return <li key={item.id}>
                <span className="wr-v2-detail__time">{item.plannedStart ?? item.time}</span>
                <div><strong>{item.label}</strong><p>{item.detail}</p>
                  {leg && <small>{leg.mode.replace(/_/g, " ").toLowerCase()} · {leg.durationMinutes === undefined ?
                    "journey time unknown" : `${Math.ceil(leg.durationMinutes)} min road-driving estimate`}</small>}
                  {item.category === "activity" && <small>{item.durationMinutes} min visit estimate · Opening hours {detail.places.find(place => place.databaseId === item.placeId)?.openingHours ? "to check" : "unknown"}</small>}
                  <small>{itemCost(ledger, item.id)}</small></div>
              </li>;
            })}
          </ol>
          {day.overnightCity && <div className="wr-v2-detail__stay"><h3>Suggested stay</h3><p>{day.accommodation}</p><small>Availability and room price need confirmation.</small></div>}
          <div className="wr-v2-detail__day-cost"><span>Day cost</span><strong>{amountLabel(ledger.summary.byDay[day.day], ledger.currency)}</strong></div>
          {day.warnings && day.warnings.length > 0 && <details className="wr-v2-detail__day-warnings"><summary>Checks for this day</summary><ul>{day.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
        </article>
        <aside className="wr-v2-detail__aside">
          <section><h2>Route and season</h2><ol>{concept.routeConcept.stops.map(stop => <li key={stop.id}>{stop.destinationName} · {stop.nights} {stop.nights === 1 ? "night" : "nights"}</li>)}</ol>
            <p>{concept.routeConcept.seasonalAssessment?.status === "SUITABLE" ? "No mapped seasonal warning." :
              concept.routeConcept.seasonalAssessment?.reasons.join(" · ") || "Seasonal conditions need confirmation."}</p></section>
          <section><h2>What needs checking</h2>{visibleIssues.length ? <ul>{visibleIssues.map((issue, index) => <li key={`${issue.code}-${index}`}>
            <AlertTriangle size={15} /><span>{readableIssue(issue.code)}{issue.day ? ` · day ${issue.day}` : ""}</span></li>)}</ul> : <p>No validation issues found.</p>}</section>
          <section><h2>Cost categories</h2><dl>{Object.entries(ledger.summary.byCategory).map(([category, summary]) =>
            <div key={category}><dt>{category.toLowerCase().replace(/_/g, " ")}</dt><dd>{amountLabel(summary, ledger.currency)}</dd></div>)}</dl></section>
        </aside>
      </div>
      <p className="wr-v2-detail__footer"><Clock3 size={16} /> Activity durations are estimates. Train, bus and other unverified transfers have no invented timetable.</p>
    </div>
  </section>;
}
