import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import type { GenerationPhase } from "../../lib/generationRequest";
import "../../../styles/generation.css";

export type GenerationView = { kind: "v2" | "classic"; phase: GenerationPhase;
  days: number; people: number; cities: string[]; interests: string[]; budget: number; currency: string };

const STEPS: { phase: GenerationPhase; label: string; working: string }[] = [
  { phase: "route", label: "Route", working: "Choosing a route that fits your days" },
  { phase: "places", label: "Places", working: "Finding places along your route" },
  { phase: "suggestions", label: "Day plans", working: "AI is planning each day" },
  { phase: "assembling", label: "Finishing", working: "Putting your trip together" },
];
/** Progress range for each step; within a step the bar eases towards the end of its range. */
const RANGE: Record<GenerationPhase, [number, number, number]> = {
  route: [4, 22, 4], places: [22, 40, 5], suggestions: [40, 90, 14], assembling: [90, 98, 3],
};
const SLOW_AFTER_SECONDS = 45;

function IslandMark() {
  return <svg className="wr-gen__island" viewBox="0 0 180 240" aria-hidden="true">
    <path className="wr-island-fill" d="M93 9c22 5 43 20 53 42 8 18 8 39 2 58-5 18-16 32-22 49-7 17-8 40-23 56-6 7-14 14-23 15-12 1-20-9-25-19-8-17-9-36-14-54-5-20-14-39-13-61 1-19 8-40 21-55C59 23 75 11 93 9Z" />
    <path className="wr-loading-route" d="M66 181c15-13 7-30 22-43 14-12 35-13 35-34 0-15-13-21-22-29-9-7-13-19-7-31" />
  </svg>;
}

/** One clear "working on it" screen: what step is running, a moving bar and a seconds counter. */
export function GenerationScreen({ view, onCancel }: { view: GenerationView; onCancel: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const started = useRef(Date.now());
  const phaseStarted = useRef(Date.now());
  const [now, setNow] = useState(Date.now());
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => { phaseStarted.current = Date.now(); }, [view.phase]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 500); return () => window.clearInterval(timer); }, []);

  const current = STEPS.findIndex(step => step.phase === view.phase);
  const [from, to, pace] = RANGE[view.phase];
  const inPhase = Math.max(0, now - phaseStarted.current) / 1000;
  const percent = Math.round(from + (to - from) * (1 - Math.exp(-inPhase / pace)));
  const seconds = Math.max(0, Math.floor((now - started.current) / 1000));
  const slow = seconds >= SLOW_AFTER_SECONDS;
  const places = view.cities.length > 3 ? `${view.cities.slice(0, 3).join(", ")} +${view.cities.length - 3} more` : view.cities.join(", ");

  return <section className="wr-generation" aria-labelledby="generation-title" aria-busy="true">
    <div className="wr-gen">
      <div className="wr-gen__mark"><span className="wr-gen__ring" aria-hidden="true" /><IslandMark /></div>
      <h1 id="generation-title" ref={heading} tabIndex={-1}>Building your {view.days}-day trip</h1>
      <p className="wr-gen__trip">{view.people} {view.people === 1 ? "traveller" : "travellers"}{places ? ` · ${places}` : ""}</p>

      <div className="wr-gen__progress">
        <div className="wr-gen__bar" role="progressbar" aria-label="Trip planning progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
          <span style={{ width: `${percent}%` }} />
        </div>
        <span className="wr-gen__time" aria-hidden="true">{seconds}s</span>
      </div>
      <p className="wr-gen__now" role="status" aria-live="polite">{STEPS[current]?.working ?? "Working"}…</p>

      <ol className="wr-gen__steps" aria-label="Steps">
        {STEPS.map((step, index) => {
          const state = index < current ? "done" : index === current ? "active" : "todo";
          return <li key={step.phase} className={`is-${state}`} aria-current={state === "active" ? "step" : undefined}>
            <span className="wr-gen__dot" aria-hidden="true">{state === "done" ? <Check size={13} strokeWidth={3} /> : null}</span>
            {step.label}<span className="wr-sr-only">{state === "done" ? " (done)" : state === "active" ? " (in progress)" : ""}</span>
          </li>;
        })}
      </ol>

      <p className="wr-gen__hint">{slow
        ? (view.kind === "v2" ? "Still working: the AI is busy right now. If it doesn’t answer, you’ll get a limited draft you can still edit." : "Still working: the AI is busy right now. If it doesn’t answer, you’ll get a standard draft.")
        : "This usually takes 20–40 seconds. Your trip opens as soon as it’s ready."}</p>
      <button type="button" className="wr-gen__cancel" onClick={onCancel}><X size={16} aria-hidden="true" /> Cancel and go back</button>
    </div>
  </section>;
}
