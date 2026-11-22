import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Camera, Compass, Landmark, MapPin, Minus, Mountain, Navigation, Plus, Sun, UtensilsCrossed, Waves } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CURRENCY_SYMBOLS, generateItinerary } from "./data";
import { citiesFromPlaces, MAX_REQUESTED_PLACES, pickablePlaces, placeKey, type RequestedPlace } from "../../lib/requestedPlaces";
import { quickTripEstimate } from "../../lib/indicativePrices";
import { DestinationHint } from "./DestinationHint";
import { PlacePicker } from "./PlacePicker";
import { MONTH_NAMES } from "../../lib/seasonData";
import type { Interest, Screen, TravelStyle, TripInputs } from "./types";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { HomeHero } from "./home/HomeHero";
import { HomeLoop, type LoopStop } from "./home/HomeLoop";
import { prefersReducedMotion, useLandingMotion } from "./home/useLandingMotion";
import "../../../styles/core-ui.css";
import "../../../styles/home-landing.css";

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

  const root = useRef<HTMLElement>(null);
  useLandingMotion(root);
  const scrollToId = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  const [addedNote, setAddedNote] = useState("");
  const catalogue = useMemo(() => pickablePlaces(), []);
  const isAdded = (town: string, name: string) => places.some(place => place.key === placeKey(town, name));
  // "Add Kandy to my trip" puts that stop's landmarks in the planner below; pressing again takes them out.
  const addStop = (stop: LoopStop) => {
    const keys = stop.landmarks.map(place => placeKey(place.town, place.name));
    if (keys.every(key => places.some(place => place.key === key))) {
      setPlaces(places.filter(place => !keys.includes(place.key)));
      setAddedNote(`${stop.town} removed from your trip.`);
      return;
    }
    const next = [...places];
    for (const key of keys) {
      const match = catalogue.find(place => place.key === key);
      if (match && !next.some(place => place.key === key) && next.length < MAX_REQUESTED_PLACES)
        next.push({ key: match.key, name: match.name, city: match.city, source: match.source, ...(match.category ? { category: match.category } : {}) });
    }
    setPlaces(next);
    setAddedNote(`${stop.town} added. ${next.length} ${next.length === 1 ? "place" : "places"} in your trip.`);
  };
  const [plannerVisible, setPlannerVisible] = useState(false);
  useEffect(() => {
    const planner = document.getElementById("quick-planner");
    if (!planner || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setPlannerVisible(entry.isIntersecting), { threshold: 0.05 });
    observer.observe(planner);
    return () => observer.disconnect();
  }, []);

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
    <main className="wr-home wr-landing" ref={root}>
      <HomeHero>
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
        <div className="wr-landing-hero__content">
          <h1>See Sri Lanka the way a local would plan it.</h1>
          <p className="wr-landing-hero__lead">Pick the places you dream about. WanderRoute shapes the route on real road times, prices it from published rates, and a local driver can quote it.</p>
          <div className="wr-landing-hero__actions">
            <button type="button" className="wr-button wr-button--gold" onClick={() => scrollToId("quick-planner")}>
              Plan my trip <ArrowRight size={17} aria-hidden="true" />
            </button>
            <button type="button" className="wr-landing-ghost" onClick={() => scrollToId("the-loop")}>See the classic loop</button>
          </div>
          <p className="wr-landing-hero__free">Free, no account needed.</p>
        </div>
      </HomeHero>

      <HomeLoop isAdded={isAdded} onAdd={addStop} />
      <p className="wr-sr-only" role="status">{addedNote}</p>

      <section className="wr-seasons" aria-labelledby="wr-seasons-title">
        <div className="wr-seasons__inner">
          <h2 id="wr-seasons-title">Two monsoons, so one coast is always in season.</h2>
          <div className="wr-seasons__grid">
            <article>
              <h3><Sun size={20} aria-hidden="true" /> December to April</h3>
              <p>The south and west coasts and the hill country are at their driest. The best months for Mirissa, Galle and the Kandy to Ella train.</p>
            </article>
            <article>
              <h3><Waves size={20} aria-hidden="true" /> May to September</h3>
              <p>The east coast has its turn: calm seas at Trincomalee and Pasikudah, and surf at Arugam Bay.</p>
            </article>
          </div>
          <p className="wr-seasons__note">Tell the planner your month and it checks the season for every stop.</p>
        </div>
      </section>

      <section className="wr-quick" id="quick-planner" aria-labelledby="quick-planner-title">
        <div className="wr-quick__intro">
          <h2 id="quick-planner-title">Plan it in a minute.</h2>
          <p>Pick places, set your days and a budget. You get a day-by-day plan you can change, with a map, costs and a local driver quote.</p>
          <ol className="wr-landing-steps">
            <li>Pick what you want to see</li>
            <li>Get a route on real Sri Lankan road times</li>
            <li>Change anything, then ask a local driver to quote it</li>
          </ol>
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

          <fieldset className="wr-quick__places">
            <legend>What do you want to see?</legend>
            <PlacePicker places={places} onPlaces={setPlaces} towns={towns} onTowns={setTowns} />
            <DestinationHint cities={cities} days={days} />
          </fieldset>

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
              <small>Rough estimate {estimateText} for the whole group. Free, no account needed.</small>
            </div>
          </div>
        </form>
      </section>

      <section className="wr-landing-final" aria-labelledby="final-cta-title">
        <div className="wr-landing-final__image" data-parallax="0.12" aria-hidden="true">
          <img src="/home/ussangoda-1000.webp" srcSet="/home/ussangoda-1000.webp 1000w, /home/ussangoda-2000.webp 2000w" sizes="100vw" alt="" loading="lazy" decoding="async" />
        </div>
        <div className="wr-landing-final__content">
          <h2 id="final-cta-title">Where will your Sri Lanka start?</h2>
          <p>Choose one place you have always wanted to see. WanderRoute builds the rest of the loop around it.</p>
          <div className="wr-landing-hero__actions">
            <button type="button" className="wr-button wr-button--gold" onClick={() => scrollToId("quick-planner")}>
              Plan my trip <ArrowRight size={17} aria-hidden="true" />
            </button>
            <button type="button" className="wr-landing-ghost" onClick={() => navigate("planner")}>Open the full planner</button>
          </div>
        </div>
        <p className="wr-landing-credits">
          Coast at Ussangoda: photo by <a href="https://commons.wikimedia.org/wiki/File:SL_Ussangoda_NP_asv2020-01_img06.jpg" target="_blank" rel="noopener noreferrer">A.Savin</a>, <a href="https://artlibre.org/licence/lal/en/" target="_blank" rel="noopener noreferrer">Free Art License</a>.
          Films: <a href="https://www.pexels.com/license/" target="_blank" rel="noopener noreferrer">Pexels</a> clips filmed in Sri Lanka.
        </p>
      </section>

      {places.length > 0 && !plannerVisible && <div className="wr-tripbar" role="region" aria-label="Your trip so far">
        <span><MapPin size={16} aria-hidden="true" /> {places.length} {places.length === 1 ? "place" : "places"} in your trip</span>
        <button type="button" onClick={() => scrollToId("quick-planner")}>Plan it <ArrowRight size={15} aria-hidden="true" /></button>
      </div>}
    </main>
  );
}
