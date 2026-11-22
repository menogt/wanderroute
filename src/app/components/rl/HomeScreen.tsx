import { useMemo, useRef, useState } from "react";
import { ArrowRight, Camera, CirclePlay, Compass, Landmark, Minus, Mountain, Navigation, Plus, UtensilsCrossed, Waves, X } from "lucide-react";
import { PLACE_PHOTOS } from "../../lib/placePhotoCatalog";
import type { LucideIcon } from "lucide-react";
import { CURRENCY_SYMBOLS, generateItinerary } from "./data";
import { citiesFromPlaces, type RequestedPlace } from "../../lib/requestedPlaces";
import { quickTripEstimate } from "../../lib/indicativePrices";
import { DestinationHint } from "./DestinationHint";
import { PlacePicker } from "./PlacePicker";
import { MONTH_NAMES } from "../../lib/seasonData";
import type { Interest, Screen, TravelStyle, TripInputs } from "./types";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import "../../../styles/core-ui.css";
import "../../../styles/home-journey.css";

const ADMIN_TAP_THRESHOLD = 5;
const ADMIN_TAP_WINDOW_MS = 2500;

const QUICK_DAYS = [5, 7, 10, 14];
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

const stops = [
  { city: "Sigiriya", place: "Sigiriya Rock Fortress", photo: "sigiriya", title: "Walk the water gardens", detail: "Sleep in Sigiriya and leave the next morning for the climb above the gardens." },
  { city: "Ella", place: "Nine Arches Bridge", photo: "ella", title: "Stay another night in Ella", detail: "Move a night here in Trip Studio to visit Nine Arches Bridge the morning after you arrive." },
  { city: "Mirissa", place: "Mirissa Beach", photo: "mirissa", title: "Take the coast slowly", detail: "Leave a day for the beach. Check the drive back to the airport against your flight time." },
];

function PhotoCredit({ index }: { index: number }) {
  const stop = stops[index];
  const photo = PLACE_PHOTOS[stop.city + "|" + stop.place];
  return <a href={photo.page} target="_blank" rel="noreferrer">{photo.credit} · {photo.licence}</a>;
}

export function HomeScreen({
  navigate,
  onQuickPlan,
  initialInputs, initialMonth,
}: {
  navigate: (s: Screen) => void;
  onQuickPlan?: (inputs: TripInputs, travelMonth?: number | null) => void;
  initialInputs?: TripInputs | null;
  initialMonth?: number | null;
}) {
  const bp = useBreakpoint();
  const filmDialog = useRef<HTMLDialogElement>(null);
  const [filmOpen, setFilmOpen] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [tapTimer, setTapTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [budget, setBudget] = useState(initialInputs?.budget ?? 800);
  const [days, setDays] = useState(initialInputs?.days ?? 7);
  const [people, setPeople] = useState(initialInputs?.people ?? 2);
  const [places, setPlaces] = useState<RequestedPlace[]>(initialInputs?.places ?? []);
  // Towns picked directly; the towns of chosen places are added below.
  const [towns, setTowns] = useState<string[]>((initialInputs?.cities ?? [])
    .filter(city => !(initialInputs?.places ?? []).some(place => place.city === city)));
  const cities = citiesFromPlaces(places, towns);
  const [interests, setInterests] = useState<Interest[]>(initialInputs?.interests ?? ["beaches", "culture"]);
  const [travelStyle, setTravelStyle] = useState<TravelStyle>(initialInputs?.travelStyle ?? "comfort");
  // Optional, 1-12. Kept out of TripInputs so it never reaches generation.
  const [travelMonth, setTravelMonth] = useState<number | null>(initialMonth ?? null);

  const quickInputs: TripInputs = {
    budget,
    currency: "USD",
    days,
    people,
    cities,
    ...(places.length ? { places } : {}),
    interests,
    travelStyle,
  };

  const preview = useMemo(
    () => generateItinerary(quickInputs),
    [budget, days, people, cities.join("|"), interests, travelStyle]
  );

  const currencySymbol = CURRENCY_SYMBOLS[preview.currency];
  // Same published price tables as the planner, so the homepage and the plan never disagree in kind.
  const estimate = useMemo(() => quickTripEstimate({ days, people, tier: travelStyle,
    month: travelMonth ?? undefined, stops: preview.cities.length }), [days, people, travelStyle, travelMonth, preview.cities.length]);
  const money = (value: number) => `${currencySymbol}${value.toLocaleString()}`;
  const estimateText = `${money(estimate.min)}–${estimate.max.toLocaleString()}`;
  const fit = estimate.min > budget ? "over" : estimate.max > budget ? "risk" : "fits";
  const breakdownTotal = estimate.rows.reduce((sum, row) => sum + (row.min + row.max) / 2, 0);
  const ROW_LABELS = { stays: ["Accommodation", "navy"], food: ["Food", "gold"], transport: ["Transport", "blue"],
    activities: ["Sights and entry fees", "tea"], misc: ["SIM, tips and extras", "sand"] } as const;
  const budgetRows = estimate.rows.map(row => ({ label: ROW_LABELS[row.key][0], tone: ROW_LABELS[row.key][1],
    value: (row.min + row.max) / 2, text: `${money(row.min)}–${row.max.toLocaleString()}` }));

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
    if (onQuickPlan) {
      onQuickPlan(quickInputs, travelMonth);
      return;
    }
    navigate("planner");
  };

  return (
    <main className="wr-home journey-home">
      <header className="journey-hero">
        <img className="journey-hero-photo" src="/journey/ella.webp" fetchPriority="high" alt="Nine Arches Bridge curving through forest near Ella" />
        <div className="wr-home-mobilebar">
          <button
            type="button"
            className="wr-home-mobilebar__brand"
            onClick={handleLogoTap}
            aria-label="WanderRoute"
          >
            <span className="wr-brand-mark" aria-hidden="true"><img src="/logo-mark.png" alt="" /></span>
            <span>Wander<strong>Route</strong></span>
          </button>
          <button type="button" onClick={() => navigate("routes")}>Routes</button>
        </div>

        <div className="journey-hero-copy">
          <h1>Take the long way<br /><em>through Sri Lanka.</em></h1>
          <p>Pick the places you dream of seeing. Build a day-by-day trip around your time and budget.</p>
          <div className="journey-actions">
            <button className="wr-button wr-button--gold" onClick={() => navigate("planner")}>Plan Your Trip <ArrowRight size={18} /></button>
            <button className="journey-play" onClick={() => { setFilmOpen(true); filmDialog.current?.showModal(); }}><CirclePlay size={22} /> Watch the island <small>0:09</small></button>
          </div>
          <small>Free to plan · No account needed</small>
        </div>
        <div className="journey-caption">Nine Arches Bridge, Ella <PhotoCredit index={1} /></div>
      </header>
      <dialog ref={filmDialog} className="journey-dialog" aria-label="Nine seconds in Sri Lanka" onClose={() => setFilmOpen(false)}>
        <button aria-label="Close film" onClick={() => filmDialog.current?.close()} autoFocus><X size={22} /></button>
        {filmOpen && <video controls autoPlay muted playsInline aria-label="A silent photographic journey from Sigiriya to Ella and Mirissa" src="/journey/island.mp4" />}
        <p>Sigiriya · Ella · Mirissa</p><small>Photo film · cropped and animated · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a><br />{stops.map((stop, index) => <span key={stop.city}><PhotoCredit index={index} /> </span>)}</small>
      </dialog>
      <section className="journey-story" aria-labelledby="journey-title">
        <div className="journey-story-head"><div><h2 id="journey-title">From rock fortress<br />to rolling surf.</h2><p>Three stops you could build a trip around.</p></div>
        <button className="journey-link" onClick={() => navigate("routes")}>Browse sample routes <ArrowRight size={16} /></button></div>
        <div className="journey-stops">{stops.map((stop, index) => <article key={stop.city}>
          <figure><img src={`/journey/${stop.photo}.webp`} alt={stop.place} loading="lazy" /><figcaption>{stop.city}</figcaption></figure>
          <small className="journey-credit"><PhotoCredit index={index} /></small>
          <h3>{stop.title}</h3><p>{stop.detail}</p>
        </article>)}</div>
        <a className="journey-link" href="#quick-planner">Build a quick route <ArrowRight size={16} /></a>
      </section>
      <section className="wr-quick" id="quick-planner" aria-labelledby="quick-planner-title">
        <div className="wr-quick__intro">

          <h2 id="quick-planner-title">Make the route yours.</h2>
          <p>Choose your days and budget. Add the places you already have in mind, or let us suggest a route.</p>
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
              <span>When are you travelling? (optional)</span>
              <select
                value={travelMonth ?? ""}
                onChange={(event) => setTravelMonth(event.target.value ? Number(event.target.value) : null)}
              >
                <option value="">Not sure yet</option>
                {MONTH_NAMES.map((name, index) => (
                  <option key={name} value={index + 1}>{name}</option>
                ))}
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

          <details className="journey-picker"><summary>Choose places {places.length + towns.length > 0 ? `(${places.length + towns.length} selected)` : "(optional)"}</summary><fieldset className="wr-quick__places">
            <legend>What do you want to see?</legend>
            <PlacePicker places={places} onPlaces={setPlaces} towns={towns} onTowns={setTowns} />
            <DestinationHint cities={cities} days={days} />
          </fieldset></details>

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

      <section className="wr-home-budget" aria-labelledby="budget-preview-title">
        <div className="wr-home-budget__copy">

          <h2 id="budget-preview-title">What might this trip cost?</h2>
          <p>
            A rough guide from published Sri Lanka price ranges for your days, travellers, travel style and month.
            These estimates cover the categories shown for your group. Flights are excluded. Confirm prices before booking.
          </p>
          <dl>
            <div>
              <dt>Trip budget</dt>
              <dd>{money(budget)}</dd>
            </div>
            <div>
              <dt>Rough estimate</dt>
              <dd>{estimateText}</dd>
            </div>
            <div className={fit === "over" ? "is-over" : ""}>
              <dt>Budget fit</dt>
              <dd>{fit === "fits" ? "Likely fits" : fit === "risk" ? "Could go over" : "Over budget"}</dd>
            </div>
          </dl>
        </div>
        <div className="wr-home-budget__ledger" aria-label="Estimated cost categories">
          {budgetRows.map(({ label, value, tone, text }) => {
            const percent = breakdownTotal > 0 ? Math.round((value / breakdownTotal) * 100) : 0;
            return (
              <div key={label} className={`is-${tone}`}>
                <span><strong>{label}</strong><small>{percent}%</small></span>
                <i><b style={{ width: `${percent}%` }} /></i>
                <output>{text}</output>
              </div>
            );
          })}
        </div>
      </section>

      <nav className="journey-more" aria-label="More ways to plan">
        <button onClick={() => navigate("map")}>Explore the island <ArrowRight size={16} /></button>
        <a href="/trip-studio">Open Trip Studio <ArrowRight size={16} /></a>
        <button onClick={() => navigate("classic-planner")}>Classic Planner <ArrowRight size={16} /></button>
      </nav>
    </main>
  );
}
