import type { DetailedPlanningResult } from "../../lib/planningV2Itinerary";
import type { TripBriefV1 } from "../../lib/planningTypes";
import { planningBudget, type BudgetGroup, type PlanningAllowance } from "../../lib/planningBudget";
import { compareBudget } from "../../lib/costLedger";
import { PRICES_CHECKED } from "../../lib/indicativePrices";

const VERDICT = {
  WITHIN_BUDGET: "Within your budget",
  LIKELY_WITHIN_BUDGET: "Likely within your budget",
  BUDGET_RISK: "Could go over your budget",
  OVER_BUDGET: "Over your budget, even at the low estimate",
  UNKNOWN: "Budget fit not known yet",
} as const;

export function PlanningBudgetPanel({ detail, brief, onAllowance }: { detail: DetailedPlanningResult; brief: TripBriefV1;
  onAllowance: (group: BudgetGroup, allowance?: PlanningAllowance) => void }) {
  const budget = planningBudget(detail, brief);
  const fit = compareBudget(detail.ledger, brief.budget);
  const money = (amount: number) => `${brief.budget.currency} ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const span = (low: number, high: number) => high - low < 1 ? money(low)
    : `${money(Math.floor(low))}–${Math.ceil(high).toLocaleString()}`;
  // One link per website; several pages of one site are cited for different items.
  const sources = [...new Map(detail.ledger.sourceLines.flatMap(line => line.unitPrice.kind === "RANGE" && line.unitPrice.provenance.source
    ? [[new URL(line.unitPrice.provenance.source).hostname.replace(/^www\./, ""), line.unitPrice.provenance.source] as const] : [])).entries()];
  return <section className="wr-v2-budget" aria-label="Plan your travel budget">
    <h2>Plan your travel budget</h2><p>Your target: <strong>{money(brief.budget.amount)}</strong> for {brief.travellerCount} travellers over {brief.durationDays} days.</p>
    {budget.supported > 0 && <p className={`wr-v2-budget__verdict wr-v2-budget__verdict--${fit.status.toLowerCase()}`}>
      <strong>{VERDICT[fit.status]}.</strong> Estimated trip cost: <strong>{span(budget.supported, budget.supportedMaximum)}</strong>
      {budget.uncovered.length ? ` plus ${budget.uncovered.join(", ").toLowerCase()} still to price` : ""}.
      {fit.status === "BUDGET_RISK" ? " Choosing budget stays, buses or trains, or fewer paid sights keeps you nearer the low end." : ""}</p>}
    {budget.supported === 0 && <p>Current rates are not available. Build a personal budget using your own allowances below.</p>}
    <p><small>Estimates come from published price ranges checked on {PRICES_CHECKED}. They are not quotes: confirm each hotel, driver and ticket before booking.</small></p>
    <details><summary>Cost by category</summary>
      {budget.rows.filter(row => row.lineCount).map(row => <div className="wr-v2-budget__row" key={row.key}><strong>{row.label}</strong><small>{row.supported > 0 || row.supportedMaximum > 0 ? `${span(row.supported, row.supportedMaximum)} estimated` : row.gaps ? "No estimate" : "No cost"}{row.gaps ? " · Price to confirm" : ""}</small>
        {row.gaps > 0 && <><label>Your {row.label.toLowerCase()} allowance<input type="number" min="0" step="0.01" value={row.allowance?.amount ?? ""} onChange={event => onAllowance(row.key, event.target.value === "" ? undefined : { amount: Number(event.target.value), basis: row.allowance?.basis ?? "TRIP", rooms: row.allowance?.rooms })} /></label>
          <label>Allowance basis for {row.label.toLowerCase()}<select value={row.allowance?.basis ?? "TRIP"} disabled={!row.allowance} onChange={event => onAllowance(row.key, { ...row.allowance!, basis: event.target.value as PlanningAllowance["basis"] })}><option value="TRIP">Whole party, whole trip</option><option value="PERSON_DAY">Per person, per day</option>{row.key === "stays" && <option value="ROOM_NIGHT">Per room, per night</option>}</select></label>
          {row.allowance?.basis === "ROOM_NIGHT" && <label>Rooms required<input type="number" min="1" max="12" value={row.allowance.rooms ?? ""} onChange={event => onAllowance(row.key, { ...row.allowance!, rooms: event.target.value ? Number(event.target.value) : undefined })} /></label>}
          {row.allowanceTotal !== undefined && <p>Your additional allowance: {money(row.allowanceTotal)}</p>}</>}
      </div>)}
    </details>
    {sources.length > 0 && <details><summary>Where these prices come from</summary><ul className="wr-v2-budget__sources">
      {sources.map(([host, source]) => <li key={host}><a href={source} target="_blank" rel="noreferrer">{host}</a></li>)}
    </ul></details>}
    {Object.keys(detail.allowances ?? {}).length > 0 && <p className="wr-v2-budget__scenario"><strong>Your budget scenario: {money(budget.scenarioMinimum)}{budget.scenarioMaximum !== budget.scenarioMinimum ? `–${money(budget.scenarioMaximum)}` : ""}</strong><br />Estimates plus your allowances. {budget.uncovered.length ? `Still excludes unpriced ${budget.uncovered.join(", ").toLowerCase()}.` : "Every listed category has an estimate or allowance; actual spending remains unconfirmed."}{budget.scenarioMinimum > brief.budget.amount ? " This exceeds your budget target." : ` ${money(Math.max(0, brief.budget.amount - budget.scenarioMinimum))} left against your target before any uncovered costs.`}</p>}
    <p><small>Excluded: {budget.exclusions.join("; ")}.</small></p>
  </section>;
}
