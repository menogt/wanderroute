import { useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import type { GenerationPhase } from "../../lib/generationRequest";
import "../../../styles/generation.css";

export type GenerationView = { kind: "v2" | "classic"; phase: GenerationPhase;
  days: number; people: number; cities: string[]; interests: string[]; budget: number; currency: string };
const phases: Record<GenerationPhase, { title: string; detail: string }> = {
  route: { title: "Finding a route that fits", detail: "Matching your destinations and trip length to a practical journey." },
  places: { title: "Finding places for your days", detail: "Looking through place records along your route." },
  suggestions: { title: "Shaping your day-by-day plan", detail: "Requesting personalized suggestions for your journey." },
  assembling: { title: "Putting your itinerary together", detail: "Arranging your days and keeping details that need checking visible." },
};

function SriLankaLoadingMark() {
  return (
    <div className="wr-loading-mark" aria-hidden="true">
      <svg viewBox="0 0 180 240" role="img">
        <path
          className="wr-island-fill"
          d="M93 9c22 5 43 20 53 42 8 18 8 39 2 58-5 18-16 32-22 49-7 17-8 40-23 56-6 7-14 14-23 15-12 1-20-9-25-19-8-17-9-36-14-54-5-20-14-39-13-61 1-19 8-40 21-55C59 23 75 11 93 9Z"
        />
        <path className="wr-loading-route" d="M66 181c15-13 7-30 22-43 14-12 35-13 35-34 0-15-13-21-22-29-9-7-13-19-7-31" />
        <circle className="wr-loading-pin wr-loading-pin-one" cx="66" cy="181" r="5" />
        <circle className="wr-loading-pin wr-loading-pin-two" cx="92" cy="135" r="5" />
        <circle className="wr-loading-pin wr-loading-pin-three" cx="101" cy="44" r="5" />
      </svg>
    </div>
  );
}

export function GenerationScreen({ view, onCancel }: { view: GenerationView; onCancel: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);
  return <section className="wr-generation" aria-labelledby="generation-title">
    <div className="wr-generation-inner">
      <div className="wr-generation-art"><span className="wr-loading-kicker">WanderRoute · Sri Lanka</span><SriLankaLoadingMark /></div>
      <div className="wr-generation-copy">
        <p className="wr-loading-kicker">Your journey is taking shape</p>
        <h1 id="generation-title" ref={heading} tabIndex={-1}>Plotting your journey.</h1>
        <p className="wr-generation-summary">{view.days} days · {view.people} {view.people === 1 ? "traveler" : "travelers"} · {view.currency} {view.budget.toLocaleString()} budget target</p>
        <p className="wr-generation-choices">{view.cities.length ? view.cities.join(" · ") : "A route inspired by your interests"}</p>
        <div className="wr-generation-interests" aria-label="Your interests">{view.interests.map(interest => <span key={interest}>{interest}</span>)}</div>
        <div className="wr-generation-status" role="status" aria-live="polite" aria-atomic="true">
          <h2>{phases[view.phase].title}</h2><p>{phases[view.phase].detail}</p>
        </div>
        <p className="wr-generation-note">{view.kind === "v2" ? "If AI suggestions are unavailable, you’ll get a clearly marked limited draft to review and edit." : "If AI suggestions are unavailable, you’ll get a clearly marked standard draft to review."} Your itinerary opens as soon as it’s ready.</p>
        <button type="button" className="wr-generation-back" onClick={onCancel}><ArrowLeft size={17} aria-hidden="true" /> Return to my choices</button>
        <p className="wr-generation-hint">Stops this request. Your choices stay here.</p>
      </div>
    </div>
  </section>;
}
