import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CalendarDays, Compass, Info, Map, WalletCards, X } from "lucide-react";
import type { StudioPanel } from "../tripStudio/StudioNavigation";
import "../../../styles/studio-help.css";

/** One help text per Trip Studio tab: a visible one-line summary and the step-by-step detail behind an info button. */
export const STUDIO_HELP: Record<StudioPanel, { title: string; summary: string; steps: string[] }> = {
  journey: { title: "My Journey", summary: "Change stops, nights, dates, travellers and transport.",
    steps: ["Add, remove or reorder overnight stops and set the nights at each.",
      "Open Trip settings for dates, travellers, budget, comfort and pace.",
      "Under Transport arrangements, choose how you travel each leg.",
      "Press Preview changes to see what moves, then Apply and save."] },
  places: { title: "My Places", summary: "Choose what you do each day.",
    steps: ["Pick a day from the day strip.",
      "Move an activity Earlier or Later, Remove it, or Replace it with another place.",
      "Use Add to day to add a place or free time.",
      "Every change saves automatically. Undo reverses the last one."] },
  route: { title: "My Route", summary: "See your trip on the map with each drive.",
    steps: ["The map shows every overnight stop in order and today's places.",
      "Each drive shows a road-time estimate for a car, including hill roads.",
      "To change the order or the stops, go to My Journey."] },
  budget: { title: "My Budget", summary: "See the estimated cost and whether it fits your budget.",
    steps: ["Costs come from published Sri Lankan price ranges, shown as estimates.",
      "Open Cost by category to see each part of the trip.",
      "Where a price is missing, add your own allowance.",
      "Get a driver quote to compare with a real price."] },
};

/** A small tap-friendly explanation; closes on Escape or a tap elsewhere. */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    const away = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("keydown", key); document.addEventListener("pointerdown", away);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("pointerdown", away); };
  }, [open]);
  return <span className="wr-infotip" ref={root}>
    <button type="button" className="wr-infotip__button" aria-expanded={open} aria-controls={id} aria-label={`How to use ${label}`}
      onClick={() => setOpen(value => !value)}><Info size={17} aria-hidden="true" /></button>
    {open && <span className="wr-infotip__body" id={id} role="note">{children}</span>}
  </span>;
}

/** The current tab's summary with its info button. */
export function StudioPanelHelp({ panel }: { panel: StudioPanel }) {
  const help = STUDIO_HELP[panel];
  return <div className="wr-studio-help">
    <p><strong>{help.title}</strong> {help.summary}</p>
    <InfoTip label={help.title}><strong>{help.title}</strong><ol>{help.steps.map(step => <li key={step}>{step}</li>)}</ol></InfoTip>
  </div>;
}

const GUIDE_KEY = "wanderroute_studio_guide_seen_v1";
export function studioGuideSeen(): boolean { try { return localStorage.getItem(GUIDE_KEY) === "1"; } catch { return true; } }
function markGuideSeen() { try { localStorage.setItem(GUIDE_KEY, "1"); } catch { /* Private browsing: show again next time. */ } }

const ICONS: Record<StudioPanel, typeof Compass> = { journey: CalendarDays, places: Compass, route: Map, budget: WalletCards };

/** First-visit guide to Trip Studio; reopened from the "How to edit" button. */
export function StudioGuide({ onClose, onOpen }: { onClose: () => void; onOpen: (panel: StudioPanel) => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const close = () => { markGuideSeen(); onClose(); };
  return <section className="wr-studio-guide" aria-labelledby="wr-studio-guide-title">
    <button type="button" className="wr-studio-guide__close" onClick={close} aria-label="Close the Trip Studio guide"><X size={18} aria-hidden="true" /></button>
    <p className="wr-kicker">New to Trip Studio?</p>
    <h2 id="wr-studio-guide-title" ref={heading} tabIndex={-1}>Edit your trip in four places</h2>
    <ol className="wr-studio-guide__steps">
      {/* Same order as the tab bar, so the step numbers match what the traveller sees. */}
      {(["places", "route", "journey", "budget"] as const).map((panel, index) => {
        const Icon = ICONS[panel];
        return <li key={panel}><span className="wr-studio-guide__number">{index + 1}</span>
          <div><strong><Icon size={16} aria-hidden="true" /> {STUDIO_HELP[panel].title}</strong><p>{STUDIO_HELP[panel].summary}</p>
            <button type="button" className="wr-v2__text-link" onClick={() => { markGuideSeen(); onOpen(panel); }}>Open {STUDIO_HELP[panel].title}</button></div></li>;
      })}
    </ol>
    <p className="wr-studio-guide__save"><strong>Saving is automatic.</strong> Every change is kept in this browser. Use Undo to step back, and Done when you have finished. Download the PDF to keep a copy.</p>
    <button type="button" className="wr-button wr-button--primary" onClick={close}>Got it</button>
  </section>;
}
