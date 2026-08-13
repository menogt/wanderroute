import { ArrowLeft, Compass } from "lucide-react";
import { useState, type CSSProperties } from "react";
import type { GeneratedItinerary, Screen } from "./types";
import { CURRENCY_SYMBOLS } from "./data";
import "../../../styles/secondary-screens.css";

const CATEGORIES = [
  { key: "hotels" as const, label: "Accommodation", short: "Stay", color: "var(--wr-ocean, #0B2742)" },
  { key: "food" as const, label: "Food & dining", short: "Food", color: "var(--wr-gold, #D4A64A)" },
  { key: "transport" as const, label: "Transport", short: "Move", color: "var(--wr-mist-deep, #7795A4)" },
  { key: "activities" as const, label: "Activities", short: "See", color: "var(--wr-tea, #4F6F52)" },
  { key: "entryFees" as const, label: "Entry fees", short: "Enter", color: "#A86F32" },
  { key: "misc" as const, label: "Flexible costs", short: "Flex", color: "#68747D" },
];

export function CostBreakdownScreen({
  itinerary,
  navigate,
}: {
  itinerary: GeneratedItinerary;
  navigate: (s: Screen) => void;
}) {
  const [perPerson, setPerPerson] = useState(false);
  const sym = CURRENCY_SYMBOLS[itinerary.currency];
  const { costBreakdown, totalPeople } = itinerary;
  const total = Object.values(costBreakdown).reduce((sum, value) => sum + value, 0);
  const remaining = itinerary.inputBudget - total;
  const safePeople = Math.max(1, totalPeople);
  const safeDays = Math.max(1, itinerary.totalDays);
  const divisor = perPerson ? safePeople : 1;

  const categoryData = CATEGORIES.map((category) => {
    const amount = costBreakdown[category.key];
    return {
      ...category,
      amount,
      percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
    };
  });

  const largestCategory = categoryData.reduce(
    (largest, category) => category.amount > largest.amount ? category : largest,
    categoryData[0],
  );
  const budgetPercentage = itinerary.inputBudget > 0
    ? Math.round((total / itinerary.inputBudget) * 100)
    : 0;
  const meterWidth = Math.min(100, Math.max(0, budgetPercentage));

  const status = {
    great: { label: "Comfortably within budget", note: "There is room left for changes along the way." },
    ok: { label: "Within budget", note: "The planned spend remains inside your total budget." },
    tight: { label: "Close to budget", note: "Keep an eye on flexible costs while you travel." },
    over: { label: "Over budget", note: "Review the largest categories before confirming the route." },
  }[itinerary.budgetStatus];

  const money = (value: number) => `${sym}${Math.round(Math.abs(value)).toLocaleString()}`;
  const viewMoney = (value: number) => money(value / divisor);

  return (
    <main className="wr-screen wr-cost-screen">
      <header className="wr-editorial-header wr-cost-header">
        <button className="wr-back-button" onClick={() => navigate("itinerary")}>
          <ArrowLeft aria-hidden="true" size={17} />
          Back to itinerary
        </button>
        <div className="wr-header-grid">
          <div>
            <p className="wr-kicker">Travel budget · {itinerary.currency}</p>
            <h1>See where your budget goes.</h1>
          </div>
          <p className="wr-header-intro">
            A practical view of the estimated spend for {itinerary.totalDays} days and {safePeople}{" "}
            {safePeople === 1 ? "traveller" : "travellers"}.
          </p>
        </div>
      </header>

      <div className="wr-secondary-shell wr-cost-shell">
        <section className={`wr-budget-overview wr-budget-status-${itinerary.budgetStatus}`} aria-labelledby="budget-overview-title">
          <div className="wr-budget-lead">
            <p className="wr-section-index">01 · Route allowance</p>
            <div className="wr-budget-title-row">
              <h2 id="budget-overview-title">Estimated {perPerson ? "per-traveller" : "trip"} spend</h2>
              <div className="wr-budget-view-toggle" role="group" aria-label="Cost view">
                <button type="button" aria-pressed={!perPerson} onClick={() => setPerPerson(false)}>Trip total</button>
                <button type="button" aria-pressed={perPerson} onClick={() => setPerPerson(true)}>Per traveller</button>
              </div>
            </div>
            <p className="wr-budget-total">{viewMoney(total)}</p>
            <div className="wr-budget-status-line">
              <span className="wr-status-marker" aria-hidden="true" />
              <strong>{status.label}</strong>
              <span>{status.note}</span>
            </div>
          </div>

          <dl className="wr-budget-facts">
            <div>
              <dt>Total budget</dt>
              <dd>{viewMoney(itinerary.inputBudget)}</dd>
            </div>
            <div>
              <dt>{remaining >= 0 ? "Remaining" : "Over plan by"}</dt>
              <dd>{viewMoney(remaining)}</dd>
            </div>
            <div>
              <dt>Average per day</dt>
              <dd>{viewMoney(total / safeDays)}</dd>
            </div>
            <div>
              <dt>{perPerson ? "Full-trip total" : "Per traveller"}</dt>
              <dd>{perPerson ? money(total) : money(total / safePeople)}</dd>
            </div>
          </dl>

          <div className="wr-budget-meter-copy">
            <span>{budgetPercentage}% of the total budget allocated</span>
            <span>{viewMoney(total)} / {viewMoney(itinerary.inputBudget)}</span>
          </div>
          <div
            className="wr-budget-meter"
            role="progressbar"
            aria-label="Share of total budget allocated"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, Math.max(0, budgetPercentage))}
            aria-valuetext={`${budgetPercentage}% of budget allocated`}
          >
            <span style={{ "--wr-meter-width": `${meterWidth}%` } as CSSProperties} />
          </div>
        </section>

        <section className="wr-cost-ledger" aria-labelledby="cost-ledger-title">
          <div className="wr-section-heading">
            <div>
              <p className="wr-section-index">02 · Cost route</p>
              <h2 id="cost-ledger-title">Planned categories</h2>
            </div>
            <p>Amounts are shown {perPerson ? "per traveller" : "for the full trip"}.</p>
          </div>

          <ol className="wr-cost-route-list">
            {categoryData.map((category, index) => (
              <li
                key={category.key}
                style={{ "--wr-category-color": category.color } as CSSProperties}
              >
                <div className="wr-cost-route-marker" aria-hidden="true">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </div>
                <div className="wr-cost-route-content">
                  <div className="wr-cost-route-label">
                    <div>
                      <span className="wr-cost-short">{category.short}</span>
                      <h3>{category.label}</h3>
                    </div>
                    <div className="wr-cost-amount">
                      <strong>{viewMoney(category.amount)}</strong>
                      <span>{category.percentage}%</span>
                    </div>
                  </div>
                  <div
                    className="wr-cost-track"
                    role="progressbar"
                    aria-label={`${category.label}: ${category.percentage}% of estimated spend`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={category.percentage}
                  >
                    <span style={{ "--wr-category-width": `${category.percentage}%` } as CSSProperties} />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <aside className="wr-budget-notes" aria-labelledby="budget-notes-title">
          <div className="wr-budget-notes-mark" aria-hidden="true">
            <Compass size={20} />
          </div>
          <div>
            <p className="wr-section-index">Budget notes</p>
            <h2 id="budget-notes-title">Useful context for the road</h2>
            <ul>
              <li>
                {largestCategory.label} is the largest planned category at {largestCategory.percentage}% ({money(largestCategory.amount)}).
              </li>
              <li>
                The route averages {money(total / safeDays)} per day, or {money(total / safePeople / safeDays)} per traveller per day.
              </li>
              <li>
                {remaining >= 0
                  ? `${money(remaining)} is not allocated to the current estimate.`
                  : `The current estimate is ${money(remaining)} above the entered budget.`}
              </li>
              <li>Keep receipts and leave room for price changes or optional stops during the trip.</li>
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}
