import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  Binoculars,
  Building2,
  Camera,
  Castle,
  Check,
  Compass,
  Fish,
  Gem,
  Landmark,
  MapPin,
  Minus,
  Mountain,
  PlaneLanding,
  Plus,
  Route,
  Sparkles,
  Trees,
  UtensilsCrossed,
  WalletCards,
  Waves,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Currency, Interest, Screen, TravelStyle, TripInputs } from "./types";
import { CURRENCY_SYMBOLS } from "./data";
import { useLiveRates } from "./useLiveRates";
import "../../../styles/core-ui.css";

const CURRENCIES: Currency[] = ["USD", "EUR", "GBP", "AUD", "LKR"];
const USD_BUDGET_PRESETS = [400, 800, 1500, 2500, 4000, 8000];
const DAY_OPTIONS = [4, 5, 6, 7, 8, 9, 10, 12, 14];

const START_CITIES: Array<{ name: string; icon: LucideIcon; note?: string }> = [
  { name: "Colombo", icon: Building2, note: "Main airport gateway" },
  { name: "Kandy", icon: Trees },
  { name: "Negombo", icon: Fish, note: "Close to BIA airport" },
  { name: "Galle", icon: Castle },
  { name: "Sigiriya", icon: Landmark },
  { name: "Ella", icon: Mountain },
];

const INTERESTS: Array<{ key: Interest; label: string; icon: LucideIcon }> = [
  { key: "beaches", label: "Beaches", icon: Waves },
  { key: "culture", label: "Culture", icon: Landmark },
  { key: "wildlife", label: "Wildlife", icon: Binoculars },
  { key: "hiking", label: "Hiking", icon: Mountain },
  { key: "food", label: "Food & spice", icon: UtensilsCrossed },
  { key: "temples", label: "Temples", icon: Trees },
  { key: "adventure", label: "Adventure", icon: Compass },
  { key: "photography", label: "Photography", icon: Camera },
];

const STYLES: Array<{
  key: TravelStyle;
  label: string;
  icon: LucideIcon;
  desc: string;
  range: string;
}> = [
  {
    key: "budget",
    label: "Budget explorer",
    icon: WalletCards,
    desc: "Hostels, local buses and everyday Sri Lankan food.",
    range: "$30–55 / day",
  },
  {
    key: "comfort",
    label: "Comfort traveller",
    icon: Sparkles,
    desc: "Boutique stays, mixed transport and relaxed dining.",
    range: "$85–170 / day",
  },
  {
    key: "luxury",
    label: "Luxury escape",
    icon: Gem,
    desc: "Resorts, private transfers and destination dining.",
    range: "$250–500 / day",
  },
];

const STEPS = [
  { short: "Budget", title: "Set your real trip budget" },
  { short: "Length", title: "Choose your trip length" },
  { short: "Start", title: "Choose where the route begins" },
  { short: "Interests", title: "Tell us what draws you here" },
  { short: "Style", title: "Set your travel style" },
];

export function PlannerScreen({
  onGenerate,
  navigate,
  initialStartCity,
}: {
  onGenerate: (inputs: TripInputs) => void;
  navigate: (s: Screen) => void;
  initialStartCity?: string | null;
}) {
  const [step, setStep] = useState(0);
  const [budget, setBudget] = useState(800);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [days, setDays] = useState(7);
  const [people, setPeople] = useState(2);
  const [startCity, setStartCity] = useState(initialStartCity ?? "Colombo");
  const [interests, setInterests] = useState<Interest[]>(["beaches", "culture"]);
  const [travelStyle, setTravelStyle] = useState<TravelStyle>("comfort");
  const [generating, setGenerating] = useState(false);

  const sym = CURRENCY_SYMBOLS[currency];
  const { rates, error: ratesError } = useLiveRates();

  const handleCurrencyChange = (next: Currency) => {
    if (next === currency) return;
    const inUSD = budget / (rates[currency] || 1);
    setBudget(Math.round(inUSD * (rates[next] || 1)));
    setCurrency(next);
  };

  const presetAmount = (usd: number) => Math.round(usd * (rates[currency] || 1));

  const toggleInterest = (interest: Interest) => {
    setInterests((current) =>
      current.includes(interest)
        ? current.filter((item) => item !== interest)
        : [...current, interest]
    );
  };

  const canNext = () => {
    if (step === 0) return budget > 0;
    if (step === 2) return Boolean(startCity);
    if (step === 3) return interests.length > 0;
    return true;
  };

  const tripInputs: TripInputs = {
    budget,
    currency,
    days,
    people,
    startCity,
    interests,
    travelStyle,
  };

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      onGenerate(tripInputs);
      setGenerating(false);
    }, 1600);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canNext()) return;
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      return;
    }
    handleGenerate();
  };

  const handleBack = () => {
    if (step === 0) {
      navigate("home");
      return;
    }
    setStep(step - 1);
  };

  const summary = [
    { label: "Budget", value: budget > 0 ? `${sym}${budget.toLocaleString()} ${currency}` : "—" },
    { label: "Duration", value: `${days} days` },
    { label: "Travellers", value: `${people} ${people === 1 ? "person" : "people"}` },
    { label: "Starting point", value: startCity },
    { label: "Travel style", value: travelStyle },
  ];

  return (
    <main className="wr-planner">
      <header className="wr-planner__masthead">
        <div className="wr-planner__masthead-inner">
          <button
            type="button"
            className="wr-planner__exit"
            onClick={() => navigate("home")}
            aria-label="Return to home"
          >
            <ArrowLeft size={17} aria-hidden="true" />
            <span>Back to atlas</span>
          </button>
          <div className="wr-planner__masthead-copy">
            <p className="wr-kicker">Route builder · Sri Lanka</p>
            <h1>Plan around what you can really spend.</h1>
            <p>Five useful choices. One practical day-by-day route.</p>
          </div>
          <span className="wr-coordinates wr-planner__coordinates" aria-hidden="true">
            07.8731° N · 80.7718° E
          </span>
        </div>
      </header>

      <div className="wr-planner__progress-wrap">
        <ol className="wr-planner__progress" aria-label="Trip planning progress">
          {STEPS.map((item, index) => {
            const complete = index < step;
            const current = index === step;
            return (
              <li
                key={item.short}
                className={`${complete ? "is-complete" : ""}${current ? " is-current" : ""}`}
                aria-current={current ? "step" : undefined}
              >
                <span className="wr-planner__progress-index" aria-hidden="true">
                  {complete ? <Check size={12} strokeWidth={2.6} /> : String(index + 1).padStart(2, "0")}
                </span>
                <span>{item.short}</span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="wr-planner__layout">
        <form className="wr-planner__question" onSubmit={handleSubmit}>
          <div className="wr-planner__question-heading">
            <span>Question {String(step + 1).padStart(2, "0")}</span>
            <h2>{STEPS[step].title}</h2>
          </div>

          <div className="wr-planner__question-body">
            {step === 0 && (
              <div className="wr-planner__step" key="budget">
                <p className="wr-planner__lead">
                  Use the total for everyone, including accommodation, meals, transport and activities.
                </p>

                <fieldset className="wr-fieldset">
                  <legend>Currency</legend>
                  <div className="wr-segmented wr-segmented--currency">
                    {CURRENCIES.map((item) => (
                      <button
                        type="button"
                        key={item}
                        className={currency === item ? "is-selected" : ""}
                        onClick={() => handleCurrencyChange(item)}
                        aria-pressed={currency === item}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                  <p className={`wr-rate-note${ratesError ? " is-offline" : ""}`} aria-live="polite">
                    <span aria-hidden="true" />
                    {ratesError
                      ? "Using offline rates — your amounts still convert."
                      : "Live rates convert the budget when you switch currency."}
                  </p>
                </fieldset>

                <div className="wr-budget-entry">
                  <label htmlFor="planner-budget">Total trip budget</label>
                  <div className="wr-budget-entry__control">
                    <span aria-hidden="true">{sym}</span>
                    <input
                      id="planner-budget"
                      type="number"
                      min="0"
                      inputMode="decimal"
                      value={budget}
                      onChange={(event) => setBudget(Math.max(0, Number(event.target.value)))}
                      aria-describedby="planner-budget-help"
                    />
                    <small>{currency}</small>
                  </div>
                  <p id="planner-budget-help">Choose a quick amount or enter your own.</p>
                </div>

                <div className="wr-budget-presets" aria-label="Budget suggestions">
                  {USD_BUDGET_PRESETS.map((usd) => {
                    const value = presetAmount(usd);
                    return (
                      <button
                        type="button"
                        key={usd}
                        className={budget === value ? "is-selected" : ""}
                        onClick={() => setBudget(value)}
                        aria-pressed={budget === value}
                      >
                        {sym}{value.toLocaleString()}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="wr-planner__step" key="length">
                <p className="wr-planner__lead">
                  Pick the number of full travel days and who the budget needs to cover.
                </p>
                <fieldset className="wr-fieldset">
                  <legend>Trip duration</legend>
                  <div className="wr-day-grid">
                    {DAY_OPTIONS.map((item) => (
                      <button
                        type="button"
                        key={item}
                        className={days === item ? "is-selected" : ""}
                        onClick={() => setDays(item)}
                        aria-pressed={days === item}
                      >
                        <strong>{item}</strong>
                        <span>days</span>
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="wr-fieldset wr-travellers">
                  <legend>Travellers</legend>
                  <div className="wr-travellers__control">
                    <button
                      type="button"
                      onClick={() => setPeople(Math.max(1, people - 1))}
                      disabled={people <= 1}
                      aria-label="Remove one traveller"
                    >
                      <Minus size={18} aria-hidden="true" />
                    </button>
                    <output aria-live="polite">
                      <strong>{people}</strong>
                      <span>{people === 1 ? "traveller" : "travellers"}</span>
                    </output>
                    <button
                      type="button"
                      onClick={() => setPeople(Math.min(12, people + 1))}
                      disabled={people >= 12}
                      aria-label="Add one traveller"
                    >
                      <Plus size={18} aria-hidden="true" />
                    </button>
                  </div>
                </fieldset>
              </div>
            )}

            {step === 2 && (
              <div className="wr-planner__step" key="start">
                <p className="wr-planner__lead">
                  Your first stop anchors the route. Most international arrivals begin near Colombo or Negombo.
                </p>
                <fieldset className="wr-fieldset">
                  <legend>Starting city</legend>
                  <div className="wr-city-grid">
                    {START_CITIES.map(({ name, icon: Icon, note }) => {
                      const selected = startCity === name;
                      return (
                        <button
                          type="button"
                          key={name}
                          className={selected ? "is-selected" : ""}
                          onClick={() => setStartCity(name)}
                          aria-pressed={selected}
                        >
                          <Icon size={21} strokeWidth={1.7} aria-hidden="true" />
                          <span>
                            <strong>{name}</strong>
                            {note && <small>{note}</small>}
                          </span>
                          {selected && <Check size={15} strokeWidth={2.5} aria-hidden="true" />}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              </div>
            )}

            {step === 3 && (
              <div className="wr-planner__step" key="interests">
                <p className="wr-planner__lead">
                  Select everything that matters. The generator uses these choices to prioritise stops and activities.
                </p>
                <fieldset className="wr-fieldset">
                  <legend>Interests — choose one or more</legend>
                  <div className="wr-interest-grid">
                    {INTERESTS.map(({ key, label, icon: Icon }) => {
                      const selected = interests.includes(key);
                      return (
                        <button
                          type="button"
                          key={key}
                          className={selected ? "is-selected" : ""}
                          onClick={() => toggleInterest(key)}
                          aria-pressed={selected}
                        >
                          <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
                          <span>{label}</span>
                          {selected && <Check size={14} strokeWidth={2.6} aria-hidden="true" />}
                        </button>
                      );
                    })}
                  </div>
                  {interests.length === 0 && (
                    <p className="wr-field-error" role="alert">Choose at least one interest to continue.</p>
                  )}
                </fieldset>
              </div>
            )}

            {step === 4 && (
              <div className="wr-planner__step" key="style">
                <p className="wr-planner__lead">
                  This changes accommodation, transport and dining choices throughout the itinerary.
                </p>
                <fieldset className="wr-fieldset">
                  <legend>Travel style</legend>
                  <div className="wr-style-list">
                    {STYLES.map(({ key, label, icon: Icon, desc, range }) => {
                      const selected = travelStyle === key;
                      return (
                        <button
                          type="button"
                          key={key}
                          className={selected ? "is-selected" : ""}
                          onClick={() => setTravelStyle(key)}
                          aria-pressed={selected}
                        >
                          <span className="wr-style-list__icon" aria-hidden="true">
                            <Icon size={21} strokeWidth={1.7} />
                          </span>
                          <span className="wr-style-list__copy">
                            <strong>{label}</strong>
                            <small>{desc}</small>
                          </span>
                          <span className="wr-style-list__range">{range}</span>
                          {selected && <Check className="wr-style-list__check" size={15} strokeWidth={2.6} aria-hidden="true" />}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              </div>
            )}
          </div>

          <div className="wr-planner__actions">
            <button type="button" className="wr-button wr-button--quiet" onClick={handleBack}>
              <ArrowLeft size={16} aria-hidden="true" />
              {step === 0 ? "Back" : "Previous"}
            </button>
            <button
              type="submit"
              className="wr-button wr-button--primary"
              disabled={!canNext() || generating}
            >
              {generating ? (
                <>
                  <span className="wr-spinner" aria-hidden="true" />
                  Building your route…
                </>
              ) : step < STEPS.length - 1 ? (
                <>
                  Continue
                  <ArrowRight size={16} aria-hidden="true" />
                </>
              ) : (
                <>
                  Generate my itinerary
                  <Route size={17} aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </form>

        <aside className="wr-planner__summary" aria-label="Current trip choices">
          <div className="wr-planner__summary-map" aria-hidden="true">
            <span className="wr-map-ring wr-map-ring--one" />
            <span className="wr-map-ring wr-map-ring--two" />
            <Route size={31} strokeWidth={1.25} />
          </div>
          <p className="wr-kicker">Your route brief</p>
          <h2>{startCity} is the first pin.</h2>
          <p className="wr-planner__summary-intro">
            We will build outward from here, balancing travel time with the budget you set.
          </p>

          <dl className="wr-planner__summary-list">
            {summary.map(({ label, value }) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>

          <div className="wr-planner__route-line" aria-hidden="true">
            <span><MapPin size={14} /></span>
            <i />
            <span><PlaneLanding size={14} /></span>
            <i />
            <span><BedDouble size={14} /></span>
          </div>

          {interests.length > 0 && (
            <div className="wr-planner__summary-interests">
              <span>Prioritising</span>
              <p>{interests.join(" · ")}</p>
            </div>
          )}

          <div className="wr-planner__summary-note">
            <Compass size={17} strokeWidth={1.8} aria-hidden="true" />
            <p>No account is required to create a route.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
