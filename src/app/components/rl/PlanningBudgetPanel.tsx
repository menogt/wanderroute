import type { DetailedPlanningResult } from "../../lib/planningV2Itinerary";
import type { TripBriefV1 } from "../../lib/planningTypes";
import { planningBudget, type BudgetGroup, type PlanningAllowance } from "../../lib/planningBudget";

export function PlanningBudgetPanel({ detail, brief, onAllowance }: { detail: DetailedPlanningResult; brief: TripBriefV1;
  onAllowance: (group: BudgetGroup, allowance?: PlanningAllowance) => void }) {
  const budget = planningBudget(detail, brief);
  const money = (amount: number) => `${brief.budget.currency} ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return <section className="wr-v2-budget" aria-label="Plan your travel budget">
    <h2>Plan your travel budget</h2><p>Your target: <strong>{money(brief.budget.amount)}</strong> for {brief.travellerCount} travellers over {brief.durationDays} days.</p>
    <p>{budget.supported > 0 ? `Supported subtotal: ${money(budget.supported)}. Additional costs below still need pricing.` : "Current rates are not available. Build a personal budget using your own allowances below."}</p>
    <details><summary>Edit category allowances</summary><p>Enter amounts in {brief.budget.currency} for the unpriced part of each category. These are your planning assumptions, not researched rates or quotes. Blank means unknown; zero means you explicitly allow nothing.</p>
      {budget.rows.map(row => <div className="wr-v2-budget__row" key={row.key}><strong>{row.label}</strong><small>{row.supported > 0 ? `${money(row.supported)} supported` : "No supported amount"}{row.gaps ? " · Price to confirm" : ""}</small>
        {row.gaps > 0 && <><label>Your {row.label.toLowerCase()} allowance<input type="number" min="0" step="0.01" value={row.allowance?.amount ?? ""} onChange={event => onAllowance(row.key, event.target.value === "" ? undefined : { amount: Number(event.target.value), basis: row.allowance?.basis ?? "TRIP", rooms: row.allowance?.rooms })} /></label>
          <label>Allowance basis for {row.label.toLowerCase()}<select value={row.allowance?.basis ?? "TRIP"} disabled={!row.allowance} onChange={event => onAllowance(row.key, { ...row.allowance!, basis: event.target.value as PlanningAllowance["basis"] })}><option value="TRIP">Whole party, whole trip</option><option value="PERSON_DAY">Per person, per day</option>{row.key === "stays" && <option value="ROOM_NIGHT">Per room, per night</option>}</select></label>
          {row.allowance?.basis === "ROOM_NIGHT" && <label>Rooms required<input type="number" min="1" max="12" value={row.allowance.rooms ?? ""} onChange={event => onAllowance(row.key, { ...row.allowance!, rooms: event.target.value ? Number(event.target.value) : undefined })} /></label>}
          {row.allowanceTotal !== undefined && <p>Your additional allowance: {money(row.allowanceTotal)}</p>}</>}
      </div>)}
    </details>
    {Object.keys(detail.allowances ?? {}).length > 0 && <p className="wr-v2-budget__scenario"><strong>Your budget scenario: {money(budget.scenarioMinimum)}{budget.scenarioMaximum !== budget.scenarioMinimum ? `–${money(budget.scenarioMaximum)}` : ""}</strong><br />Supported amounts plus your allowances. {budget.uncovered.length ? `Still excludes unpriced ${budget.uncovered.join(", ").toLowerCase()}.` : "All currently listed categories have a price or allowance; actual spending remains unconfirmed."}{budget.scenarioMinimum > brief.budget.amount ? " This exceeds your budget target." : ` ${money(Math.max(0, brief.budget.amount - budget.scenarioMinimum))} left against your target before any uncovered costs.`}</p>}
    <p><small>Excluded: {budget.exclusions.join("; ")}. Rates, rooms, vehicles, admission eligibility and availability must be checked before booking.</small></p>
  </section>;
}
