import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, MapPin, Sun, Waves, X } from "lucide-react";
import { MAX_REQUESTED_PLACES, pickablePlaces, placeKey, type RequestedPlace } from "../../lib/requestedPlaces";
import type { Screen } from "./types";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { HomeHero } from "./home/HomeHero";
import { HomeLoop, type LoopStop } from "./home/HomeLoop";
import { prefersReducedMotion, useLandingMotion } from "./home/useLandingMotion";
import "../../../styles/core-ui.css";
import "../../../styles/home-landing.css";

const ADMIN_TAP_THRESHOLD = 5;
const ADMIN_TAP_WINDOW_MS = 2500;

/**
 * The landing page. Every "Plan my trip" opens the new planner (Planning V2) with the places added here;
 * the trip itself is planned there, so the homepage has no planning form of its own.
 */
export function HomeScreen({
  navigate,
  onStartPlanner,
  initialPlaces,
}: {
  navigate: (s: Screen) => void;
  onStartPlanner?: (places: RequestedPlace[]) => void;
  initialPlaces?: RequestedPlace[];
}) {
  const bp = useBreakpoint();
  const [tapCount, setTapCount] = useState(0);
  const [tapTimer, setTapTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [places, setPlaces] = useState<RequestedPlace[]>(initialPlaces ?? []);

  const root = useRef<HTMLElement>(null);
  useLandingMotion(root);
  const scrollToId = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  const startPlanning = () => (onStartPlanner ? onStartPlanner(places) : navigate("planner"));

  const [addedNote, setAddedNote] = useState("");
  const catalogue = useMemo(() => pickablePlaces(), []);
  const isAdded = (town: string, name: string) => places.some(place => place.key === placeKey(town, name));
  // "Add Kandy to my trip" collects that stop's landmarks for the planner; pressing again takes them out.
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
  const removePlace = (key: string) => setPlaces(current => current.filter(place => place.key !== key));

  const [planVisible, setPlanVisible] = useState(false);
  useEffect(() => {
    const section = document.getElementById("plan-your-trip");
    if (!section || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setPlanVisible(entry.isIntersecting), { threshold: 0.05 });
    observer.observe(section);
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

  const planLabel = places.length ? `Plan a trip with ${places.length} ${places.length === 1 ? "place" : "places"}` : "Plan my trip";

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
            <button type="button" className="wr-button wr-button--gold" onClick={startPlanning}>
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

      <section className="wr-landing-plan" id="plan-your-trip" aria-labelledby="plan-title">
        <div className="wr-landing-plan__inner">
          <div className="wr-landing-plan__intro">
            <h2 id="plan-title">Plan it in a few minutes.</h2>
            <p>Pick places, add your dates and flight times, and set a budget. You get a day-by-day plan you can change, with a map, costs and a local driver quote.</p>
            <ol className="wr-landing-steps">
              <li>Pick what you want to see</li>
              <li>Get a route on real Sri Lankan road times</li>
              <li>Change anything, then ask a local driver to quote it</li>
            </ol>
          </div>
          <div className="wr-landing-plan__card">
            <h3>Your trip so far</h3>
            {places.length ? <ul className="wr-landing-plan__places" aria-label="Places you added">
              {places.map(place => <li key={place.key}>
                <MapPin size={15} aria-hidden="true" /><span>{place.name}<small>{place.city}</small></span>
                <button type="button" onClick={() => removePlace(place.key)} aria-label={`Remove ${place.name}`}><X size={15} aria-hidden="true" /></button>
              </li>)}
            </ul> : <p className="wr-landing-plan__empty">Nothing added yet. Add stops from the loop above, or choose places in the planner.</p>}
            <button type="button" className="wr-button wr-button--gold wr-landing-plan__go" onClick={startPlanning}>
              {planLabel} <ArrowRight size={17} aria-hidden="true" />
            </button>
            <small>Opens the planner. Free, no account needed.</small>
          </div>
        </div>
      </section>

      <section className="wr-landing-final" aria-labelledby="final-cta-title">
        <div className="wr-landing-final__image" data-parallax="0.12" aria-hidden="true">
          <img src="/home/ussangoda-1000.webp" srcSet="/home/ussangoda-1000.webp 1000w, /home/ussangoda-2000.webp 2000w" sizes="100vw" alt="" loading="lazy" decoding="async" />
        </div>
        <div className="wr-landing-final__content">
          <h2 id="final-cta-title">Where will your Sri Lanka start?</h2>
          <p>Choose one place you have always wanted to see. WanderRoute builds the rest of the loop around it.</p>
          <div className="wr-landing-hero__actions">
            <button type="button" className="wr-button wr-button--gold" onClick={startPlanning}>
              {planLabel} <ArrowRight size={17} aria-hidden="true" />
            </button>
            <button type="button" className="wr-landing-ghost" onClick={() => navigate("routes")}>Browse sample routes</button>
          </div>
        </div>
        <p className="wr-landing-credits">
          Coast at Ussangoda: photo by <a href="https://commons.wikimedia.org/wiki/File:SL_Ussangoda_NP_asv2020-01_img06.jpg" target="_blank" rel="noopener noreferrer">A.Savin</a>, <a href="https://artlibre.org/licence/lal/en/" target="_blank" rel="noopener noreferrer">Free Art License</a>.
          Films: <a href="https://www.pexels.com/license/" target="_blank" rel="noopener noreferrer">Pexels</a> clips filmed in Sri Lanka.
        </p>
      </section>

      {places.length > 0 && !planVisible && <div className="wr-tripbar" role="region" aria-label="Your trip so far">
        <span><MapPin size={16} aria-hidden="true" /> {places.length} {places.length === 1 ? "place" : "places"} in your trip</span>
        <button type="button" onClick={startPlanning}>Plan it <ArrowRight size={15} aria-hidden="true" /></button>
      </div>}
    </main>
  );
}
