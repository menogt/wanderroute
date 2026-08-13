import { useMemo, useState } from "react";
import {
  ArrowRight,
  BedDouble,
  CalendarDays,
  Camera,
  Check,
  Compass,
  Download,
  FileText,
  Landmark,
  MapPinned,
  Minus,
  Mountain,
  Navigation,
  Plus,
  Route,
  ShieldCheck,
  Sparkles,
  Users,
  UtensilsCrossed,
  WalletCards,
  Waves,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import hillCountryImage from "../../../assets/wanderroute-hill-country.jpg";
import { CURRENCY_SYMBOLS, POPULAR_ROUTES, generateItinerary } from "./data";
import type { Interest, Screen, TravelStyle, TripInputs } from "./types";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import "../../../styles/core-ui.css";

const ADMIN_TAP_THRESHOLD = 5;
const ADMIN_TAP_WINDOW_MS = 2500;

const QUICK_DAYS = [5, 7, 10, 14];
const QUICK_STARTS = ["Colombo", "Kandy", "Negombo", "Galle", "Sigiriya", "Ella"];
const QUICK_INTERESTS: Array<{ key: Interest; label: string; icon: LucideIcon }> = [
  { key: "beaches", label: "Beaches", icon: Waves },
  { key: "culture", label: "Culture", icon: Landmark },
  { key: "wildlife", label: "Wildlife", icon: Navigation },
  { key: "hiking", label: "Hiking", icon: Mountain },
  { key: "food", label: "Food", icon: UtensilsCrossed },
  { key: "temples", label: "Temples", icon: Landmark },
  { key: "adventure", label: "Adventure", icon: Compass },
  { key: "photography", label: "Photography", icon: Camera },
];

const QUICK_STYLES: Array<{ key: TravelStyle; label: string }> = [
  { key: "budget", label: "Budget" },
  { key: "comfort", label: "Comfort" },
  { key: "luxury", label: "Luxury" },
];

const STORY_STEPS = [
  { number: "01", label: "Set a real budget", icon: WalletCards },
  { number: "02", label: "Build a connected route", icon: Route },
  { number: "03", label: "Follow each day", icon: CalendarDays },
  { number: "04", label: "Take the plan offline", icon: Download },
];

export function HomeScreen({
  navigate,
  onGenerate,
}: {
  navigate: (s: Screen) => void;
  onGenerate?: (inputs: TripInputs) => void;
}) {
  const bp = useBreakpoint();
  const [tapCount, setTapCount] = useState(0);
  const [tapTimer, setTapTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [budget, setBudget] = useState(800);
  const [days, setDays] = useState(7);
  const [people, setPeople] = useState(2);
  const [startCity, setStartCity] = useState("Colombo");
  const [interests, setInterests] = useState<Interest[]>(["beaches", "culture"]);
  const [travelStyle, setTravelStyle] = useState<TravelStyle>("comfort");

  const quickInputs: TripInputs = {
    budget,
    currency: "USD",
    days,
    people,
    startCity,
    interests,
    travelStyle,
  };

  const preview = useMemo(
    () => generateItinerary(quickInputs),
    [budget, days, people, startCity, interests, travelStyle]
  );
  const previewDay = preview.days[0];
  const breakdownTotal = Object.values(preview.costBreakdown).reduce((sum, value) => sum + value, 0);
  const currencySymbol = CURRENCY_SYMBOLS[preview.currency];

  const budgetRows = [
    { label: "Accommodation", value: preview.costBreakdown.hotels, tone: "navy" },
    { label: "Food", value: preview.costBreakdown.food, tone: "gold" },
    { label: "Transport", value: preview.costBreakdown.transport, tone: "blue" },
    { label: "Activities", value: preview.costBreakdown.activities, tone: "tea" },
    { label: "Entry fees & misc.", value: preview.costBreakdown.entryFees + preview.costBreakdown.misc, tone: "sand" },
  ];

  const handleLogoTap = () => {
    if (bp !== "mobile") return;
    const next = tapCount + 1;
    if (next >= ADMIN_TAP_THRESHOLD) {
      setTapCount(0);
      if (tapTimer) clearTimeout(tapTimer);
      navigate("admin");
      return;
    }
    setTapCount(next);
    if (tapTimer) clearTimeout(tapTimer);
    const timer = setTimeout(() => setTapCount(0), ADMIN_TAP_WINDOW_MS);
    setTapTimer(timer);
  };

  const toggleQuickInterest = (interest: Interest) => {
    setInterests((current) =>
      current.includes(interest)
        ? current.filter((item) => item !== interest)
        : [...current, interest]
    );
  };

  const handleQuickGenerate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (interests.length === 0 || budget <= 0) return;
    if (onGenerate) {
      onGenerate(quickInputs);
      return;
    }
    navigate("planner");
  };

  return (
    <main className="wr-home">
      <header className="wr-home-hero">
        <img
          className="wr-home-hero__image"
          src={hillCountryImage}
          alt="A train crossing Sri Lanka's green central highlands"
        />
        <div className="wr-home-hero__wash" aria-hidden="true" />

        <div className="wr-home-mobilebar">
          <button
            type="button"
            className="wr-home-mobilebar__brand"
            onClick={handleLogoTap}
            aria-label="WanderRoute"
          >
            <span className="wr-brand-mark" aria-hidden="true"><Compass size={17} /></span>
            <span>Wander<strong>Route</strong></span>
          </button>
          <button type="button" onClick={() => navigate("routes")}>Routes</button>
        </div>

        <div className="wr-home-hero__content">
          <div className="wr-home-hero__copy">
            <p className="wr-kicker">The living Sri Lanka atlas</p>
            <h1>Plan Sri Lanka around your real budget.</h1>
            <p className="wr-home-hero__lead">
              Build a personalised day-by-day route with realistic local costs, places to stay and roads you can actually follow.
            </p>
            <div className="wr-home-hero__actions">
              <button
                type="button"
                className="wr-button wr-button--gold"
                onClick={() => navigate("planner")}
              >
                Plan My Free Trip
                <ArrowRight size={17} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="wr-button wr-button--glass"
                onClick={() => navigate("routes")}
              >
                Explore a Sample Route
              </button>
            </div>
            <p className="wr-home-hero__assurance">
              <Check size={14} aria-hidden="true" />
              Free to use · No account required
            </p>
          </div>

          <div className="wr-home-hero__preview" aria-label="Live route preview">
            <div className="wr-home-hero__preview-head">
              <span><Sparkles size={14} aria-hidden="true" /> Route preview</span>
              <small>{preview.totalDays} days</small>
            </div>
            <h2>{preview.routeName}</h2>
            <div className="wr-home-hero__route">
              {preview.cities.map((city, index) => (
                <span key={city}>
                  <i className={index === 0 ? "is-start" : index === preview.cities.length - 1 ? "is-end" : ""} />
                  <b>{city}</b>
                </span>
              ))}
            </div>
            <div className="wr-home-hero__preview-meta">
              <span><Users size={15} aria-hidden="true" /> {preview.totalPeople}</span>
              <span><WalletCards size={15} aria-hidden="true" /> {currencySymbol}{preview.estimatedTotalCost.toLocaleString()}</span>
              <span><Navigation size={15} aria-hidden="true" /> {preview.travelStyle}</span>
            </div>
          </div>
        </div>

        <span className="wr-coordinates wr-home-hero__coordinates" aria-hidden="true">
          Central Highlands · 06.8667° N · 81.0466° E
        </span>
      </header>

      <section className="wr-quick" id="quick-planner" aria-labelledby="quick-planner-title">
        <div className="wr-quick__intro">
          <p className="wr-kicker">Quick planner</p>
          <h2 id="quick-planner-title">Start with the choices that change the route.</h2>
          <p>Use the short form here, or open the full planner for more guidance at every step.</p>
        </div>

        <form className="wr-quick__form" onSubmit={handleQuickGenerate}>
          <div className="wr-quick__primary-fields">
            <label className="wr-quick__budget" htmlFor="quick-budget">
              <span>Total budget</span>
              <span className="wr-quick__budget-control">
                <b aria-hidden="true">$</b>
                <input
                  id="quick-budget"
                  type="number"
                  min="1"
                  inputMode="decimal"
                  value={budget}
                  onChange={(event) => setBudget(Math.max(0, Number(event.target.value)))}
                />
                <small>USD</small>
              </span>
            </label>

            <label>
              <span>Duration</span>
              <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
                {QUICK_DAYS.map((item) => <option key={item} value={item}>{item} days</option>)}
              </select>
            </label>

            <label>
              <span>Start in</span>
              <select value={startCity} onChange={(event) => setStartCity(event.target.value)}>
                {QUICK_STARTS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>

            <fieldset className="wr-quick__people">
              <legend>Travellers</legend>
              <div>
                <button
                  type="button"
                  onClick={() => setPeople(Math.max(1, people - 1))}
                  disabled={people <= 1}
                  aria-label="Remove one traveller"
                ><Minus size={16} aria-hidden="true" /></button>
                <output aria-live="polite">{people}</output>
                <button
                  type="button"
                  onClick={() => setPeople(Math.min(12, people + 1))}
                  disabled={people >= 12}
                  aria-label="Add one traveller"
                ><Plus size={16} aria-hidden="true" /></button>
              </div>
            </fieldset>
          </div>

          <fieldset className="wr-quick__options">
            <legend>What should shape the trip?</legend>
            <div>
              {QUICK_INTERESTS.map(({ key, label, icon: Icon }) => {
                const selected = interests.includes(key);
                return (
                  <button
                    type="button"
                    key={key}
                    className={selected ? "is-selected" : ""}
                    onClick={() => toggleQuickInterest(key)}
                    aria-pressed={selected}
                  >
                    <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
                    {label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="wr-quick__footer">
            <fieldset className="wr-quick__style">
              <legend>Travel style</legend>
              <div>
                {QUICK_STYLES.map(({ key, label }) => (
                  <button
                    type="button"
                    key={key}
                    className={travelStyle === key ? "is-selected" : ""}
                    onClick={() => setTravelStyle(key)}
                    aria-pressed={travelStyle === key}
                  >{label}</button>
                ))}
              </div>
            </fieldset>
            <div className="wr-quick__submit-wrap">
              {interests.length === 0 && <p role="alert">Choose at least one interest.</p>}
              <button
                type="submit"
                className="wr-button wr-button--gold"
                disabled={interests.length === 0 || budget <= 0}
              >
                Create My Route
                <ArrowRight size={17} aria-hidden="true" />
              </button>
              <small>Free to use · No account required</small>
            </div>
          </div>
        </form>
      </section>

      <section className="wr-home-story" aria-labelledby="story-title">
        <div className="wr-home-story__heading">
          <p className="wr-kicker">From question to field guide</p>
          <h2 id="story-title">A route you can understand before you travel.</h2>
        </div>
        <ol className="wr-home-story__line">
          {STORY_STEPS.map(({ number, label, icon: Icon }) => (
            <li key={number}>
              <span className="wr-home-story__number">{number}</span>
              <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
              <strong>{label}</strong>
            </li>
          ))}
        </ol>
      </section>

      <section className="wr-home-itinerary" aria-labelledby="itinerary-preview-title">
        <div className="wr-home-itinerary__route-panel">
          <p className="wr-kicker">A connected journey</p>
          <h2 id="itinerary-preview-title">{preview.routeName}</h2>
          <p>{preview.routeSlogan}</p>
          <div className="wr-atlas-route" aria-label={`Route through ${preview.cities.join(", ")}`}>
            {preview.cities.map((city, index) => (
              <div key={city}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{city}</strong>
                {index < preview.cities.length - 1 && <i aria-hidden="true" />}
              </div>
            ))}
          </div>
          <button type="button" className="wr-text-link" onClick={() => navigate("routes")}>
            Browse established routes <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>

        {previewDay && (
          <article className="wr-day-spread">
            <header>
              <span>Day {String(previewDay.day).padStart(2, "0")}</span>
              <div>
                <h3>{previewDay.city}</h3>
                <p>{currencySymbol}{previewDay.dailyCostPerPerson.toLocaleString()} per person</p>
              </div>
            </header>
            <ol>
              {previewDay.items.slice(0, 4).map((item, index) => (
                <li key={`${item.time}-${item.label}-${index}`}>
                  <time>{item.time}</time>
                  <span aria-hidden="true" />
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.detail}</p>
                  </div>
                  <b>{item.cost === 0 ? "Free" : `${currencySymbol}${item.cost}`}</b>
                </li>
              ))}
            </ol>
            <footer>
              <BedDouble size={17} strokeWidth={1.7} aria-hidden="true" />
              <span>
                <small>Tonight</small>
                <strong>{previewDay.accommodation}</strong>
              </span>
            </footer>
          </article>
        )}
      </section>

      <section className="wr-home-budget" aria-labelledby="budget-preview-title">
        <div className="wr-home-budget__copy">
          <p className="wr-kicker">Cost intelligence</p>
          <h2 id="budget-preview-title">See where the money goes — before it goes.</h2>
          <p>
            The estimate stays connected to the route, number of travellers and travel style you choose above.
          </p>
          <dl>
            <div>
              <dt>Trip budget</dt>
              <dd>{currencySymbol}{preview.inputBudget.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Route estimate</dt>
              <dd>{currencySymbol}{preview.estimatedTotalCost.toLocaleString()}</dd>
            </div>
            <div className={preview.remainingBudget < 0 ? "is-over" : ""}>
              <dt>{preview.remainingBudget < 0 ? "Over budget" : "Remaining"}</dt>
              <dd>{currencySymbol}{Math.abs(preview.remainingBudget).toLocaleString()}</dd>
            </div>
          </dl>
        </div>
        <div className="wr-home-budget__ledger" aria-label="Estimated cost categories">
          {budgetRows.map(({ label, value, tone }) => {
            const percent = breakdownTotal > 0 ? Math.round((value / breakdownTotal) * 100) : 0;
            return (
              <div key={label} className={`is-${tone}`}>
                <span><strong>{label}</strong><small>{percent}%</small></span>
                <i><b style={{ width: `${percent}%` }} /></i>
                <output>{currencySymbol}{value.toLocaleString()}</output>
              </div>
            );
          })}
        </div>
      </section>

      <section className="wr-home-map" aria-labelledby="map-preview-title">
        <div className="wr-home-map__visual" aria-hidden="true">
          <span className="wr-map-ring wr-map-ring--one" />
          <span className="wr-map-ring wr-map-ring--two" />
          <div className="wr-home-map__path">
            {preview.cities.slice(0, 4).map((city, index) => (
              <span key={city} className={`is-${index + 1}`}>
                <i>{index + 1}</i>
                <b>{city}</b>
              </span>
            ))}
          </div>
        </div>
        <div className="wr-home-map__copy">
          <p className="wr-kicker">Roads you can follow</p>
          <h2 id="map-preview-title">See the journey as a route, not a list.</h2>
          <p>
            Open the interactive atlas to explore destination markers, nearby stays and places along the way. Generated itineraries add road geometry when routing is available.
          </p>
          <button type="button" className="wr-button wr-button--outline-light" onClick={() => navigate("map")}>
            <MapPinned size={17} aria-hidden="true" />
            Open Interactive Map
          </button>
        </div>
      </section>

      <section className="wr-home-routes" aria-labelledby="route-library-title">
        <div className="wr-home-routes__heading">
          <div>
            <p className="wr-kicker">Route library</p>
            <h2 id="route-library-title">Start with a proven shape, then make it yours.</h2>
          </div>
          <button type="button" className="wr-text-link" onClick={() => navigate("routes")}>
            View all routes <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
        <div className="wr-home-routes__list">
          {POPULAR_ROUTES.slice(0, 3).map((routeItem, index) => (
            <article key={routeItem.key}>
              <span className="wr-home-routes__index">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <small>{routeItem.type} · {routeItem.duration}</small>
                <h3>{routeItem.name}</h3>
                <p>{routeItem.cities.join(" — ")}</p>
              </div>
              <button type="button" onClick={() => navigate("planner")} aria-label={`Plan the ${routeItem.name} route`}>
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="wr-home-pdf" aria-labelledby="pdf-preview-title">
        <div className="wr-home-pdf__document" aria-hidden="true">
          <div className="wr-home-pdf__document-head">
            <Compass size={16} />
            <span>WanderRoute</span>
            <small>Travel plan</small>
          </div>
          <h3>{preview.routeName}</h3>
          <p>{preview.cities.join(" · ")}</p>
          <div className="wr-home-pdf__document-rule" />
          <div className="wr-home-pdf__document-grid">
            <span><small>Days</small><strong>{preview.totalDays}</strong></span>
            <span><small>People</small><strong>{preview.totalPeople}</strong></span>
            <span><small>Estimate</small><strong>{currencySymbol}{preview.estimatedTotalCost.toLocaleString()}</strong></span>
          </div>
          <div className="wr-home-pdf__document-lines"><i /><i /><i /><i /></div>
        </div>
        <div className="wr-home-pdf__copy">
          <p className="wr-kicker">A plan that travels with you</p>
          <h2 id="pdf-preview-title">Turn the itinerary into a practical travel document.</h2>
          <p>
            Your generated route, daily plan, costs and local tips can be downloaded as a PDF for offline reference.
          </p>
          <ul>
            <li><FileText size={16} aria-hidden="true" /> Day-by-day schedule</li>
            <li><WalletCards size={16} aria-hidden="true" /> Cost breakdown</li>
            <li><ShieldCheck size={16} aria-hidden="true" /> Warnings and local tips</li>
          </ul>
        </div>
      </section>

      <section className="wr-home-final" aria-labelledby="final-cta-title">
        <span className="wr-coordinates" aria-hidden="true">Your next pin · Sri Lanka</span>
        <h2 id="final-cta-title">Start with the budget. Leave with the route.</h2>
        <p>Build a Sri Lanka itinerary you can price, follow and take offline.</p>
        <div>
          <button type="button" className="wr-button wr-button--gold" onClick={() => navigate("planner")}>
            Plan My Free Trip <ArrowRight size={17} aria-hidden="true" />
          </button>
          <button type="button" className="wr-button wr-button--glass" onClick={() => navigate("routes")}>
            Explore a Sample Route
          </button>
        </div>
      </section>
    </main>
  );
}
