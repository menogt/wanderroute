import { useState, type FormEvent } from "react";
import { studioCosts } from "../../lib/tripStudio/costs";
import { currencies, type StudioPlan } from "../../lib/tripStudio/model";

export const moneyLabel = (amount: number, currency: string) =>
  new Intl.NumberFormat("en", { style: "currency", currency, currencyDisplay: "code", maximumFractionDigits: 2 }).format(amount);
export const amountFrom = (value: string) => value === "" ? undefined : Number(value);

export function StudioBudget({ plan, apply }: { plan: StudioPlan; apply: (plan: StudioPlan) => void }) {
  const costs = studioCosts(plan);
  return <>
    <header className="wr-studio__panel-heading">
      <h2>My Budget</h2><p>Plan the cost of the whole group, excluding international flights.</p>
    </header>
    <div className="wr-studio__budget-summary">
      <span>Supported land subtotal</span>
      <strong>{costs.items.some(line => line.result.total && line.kind !== "User allowance")
        ? moneyLabel(costs.supported, plan.budget.currency) : "No applicable prices yet"}</strong>
      <p>{costs.priced} of {costs.items.length} lines priced or covered by an allowance.
        {costs.paid > 0 && ` Already paid: ${moneyLabel(costs.paid, plan.budget.currency)}.`}
        {costs.allowances > 0 && ` Allowances: ${moneyLabel(costs.allowances, plan.budget.currency)}.`}</p>
      {costs.exceedsTarget ? <p>Priced items and entered allowances already exceed your target. Check the remaining costs as well.</p>
        : <p>Whole-trip affordability is unverified. Check prices and availability for your dates.</p>}
    </div>
    <BudgetInputs key={JSON.stringify([plan.party, plan.budget])} plan={plan} apply={apply} />
    <ul className="wr-studio__costs">
      {costs.items.map(line => <li key={line.id}>
        <div><strong>{line.label}</strong><p>{line.kind}{line.note && ` · ${line.note}`}</p></div>
        <div className="wr-studio__cost-amount">{line.result.total
          ? moneyLabel(line.result.total.minimum, plan.budget.currency)
          : line.result.sourceTotal ? `${moneyLabel(line.result.sourceTotal.minimum, line.result.sourceTotal.currency)} · conversion needed`
            : "To confirm"}</div>
        {line.evidence && <details><summary>Price source and terms</summary>
          <p><a href={line.evidence.source} target="_blank" rel="noreferrer">{line.evidence.item}</a> · checked {line.evidence.checked}.</p>
          <p>{line.evidence.occupancy}. Includes {line.evidence.includes.toLowerCase()}. Excludes {line.evidence.excludes.toLowerCase()}.</p>
        </details>}
      </li>)}
    </ul>
    <p className="wr-studio__hint">Transfer rates apply only to individually priced legs. If you buy a package, compare its inclusions instead of adding the package to these figures.</p>
  </>;
}

function BudgetInputs({ plan, apply }: { plan: StudioPlan; apply: (plan: StudioPlan) => void }) {
  const [party, setParty] = useState(plan.party?.toString() ?? "");
  const [draft, setDraft] = useState(plan.budget);
  const [fxRate, setFxRate] = useState(plan.budget.usdConversion?.rate);
  const [fxDate, setFxDate] = useState(plan.budget.usdConversion?.checked ?? "");
  function submit(event: FormEvent) {
    event.preventDefault();
    apply({ ...plan, party: party ? Number(party) : null, budget: { ...draft,
      usdConversion: draft.currency !== "USD" && fxRate && fxDate ? { rate: fxRate, checked: fxDate } : undefined,
    } });
  }
  return <details className="wr-studio__detail" open={plan.party === null || undefined}>
    <summary>Travelers and budget</summary>
    <form onSubmit={submit}>
      <div className="wr-studio__field-grid">
        <label>Travelers<input type="number" min={1} max={12} value={party} onChange={event => setParty(event.target.value)} /></label>
        <label>Budget currency<select value={draft.currency} onChange={event => {
          setDraft({ currency: event.target.value as StudioPlan["budget"]["currency"] });
          setFxRate(undefined); setFxDate("");
        }}>{currencies.map(currency => <option key={currency}>{currency}</option>)}</select></label>
        {(["target", "meals", "other"] as const).map(field => <label key={field}>
          {{ target: "Group land budget", meals: "Group meals allowance", other: "Group other expenses allowance" }[field]}
          <input type="number" min={0} max={1e9} step="0.01" value={draft[field] ?? ""}
            onChange={event => setDraft({ ...draft, [field]: amountFrom(event.target.value) })} />
        </label>)}
        {draft.currency !== "USD" && <>
          <label>{draft.currency} per 1 USD (optional)<input type="number" min="0.000001" max={1e9} step="any" value={fxRate ?? ""}
            onChange={event => setFxRate(amountFrom(event.target.value))} /></label>
          <label>Rate checked on<input type="date" required={fxRate !== undefined} value={fxDate} onChange={event => setFxDate(event.target.value)} /></label>
        </>}
      </div>
      <p className="wr-studio__hint">Changing currency clears the draft target and allowances. A dated USD conversion is applied for seven days.</p>
      <button className="wr-studio__button" type="submit">Save budget settings</button>
    </form>
  </details>;
}
