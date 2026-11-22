import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CalendarClock, CarFront, CheckCircle2, Clock3, HelpCircle, Map as MapIcon, Redo2, RefreshCw,
  Settings2, Undo2, WalletCards, X } from "lucide-react";
import { StudioGuide, studioGuideSeen } from "./StudioHelp";
import { PlanningReviewPanel } from "./PlanningReviewPanel";
import { sriLankaCalendarDate } from "../../lib/planningCalendar";
import { PlanningCustomizationPanel } from "./PlanningCustomizationPanel";
import type { PlanningV2Session } from "../../lib/planningV2Session";
import type { CustomizationDraft } from "../../lib/planningCustomization";
import { PlanningBudgetPanel } from "./PlanningBudgetPanel";
import { PlanningQuotePanel } from "./PlanningQuotePanel";
import type { DetailedPlanningResult } from "../../lib/planningV2Itinerary";
import type { PlanningV2Edit } from "../../lib/planningV2Editing";
import type { PlanningRouteConcept } from "../../lib/planningV2";
import type { TripBriefV1 } from "../../lib/planningTypes";
import type { TransportLeg } from "../../lib/transportTypes";
import { amountLabel, readableIssue } from "./board/boardFormat";
import { BoardDay } from "./board/BoardDay";
import { BoardDndProvider } from "./board/BoardDnd";
import { BoardMap } from "./board/BoardMap";
import { PlacesToVisit } from "./board/PlacesToVisit";
import { RouteEditor } from "./board/RouteEditor";
import "../../../styles/planning-v2.css";
import "../../../styles/planning-v2-itinerary.css";
import "../../../styles/studio-help.css";
import "../../../styles/itinerary-board.css";

const STATUS = { READY: "Ready", READY_WITH_WARNINGS: "Ready with warnings",
  NEEDS_CONFIRMATION: "Needs confirmation", INVALID: "Cannot use as a ready plan" } as const;

/**
 * The generated trip as one editable board (Trip Studio): the route, places waiting for a day, every
 * day as a list of place cards, then budget, quote and PDF, with the map beside it. Every change applies
 * at once, is saved in the browser and can be undone.
 */
export function PlanningV2ItineraryScreen({ initialStudio = false, detail, concept, brief, busy, error, editError,
  canUndo, canRedo, session, draftStored, onNewPlan, onCustomize, onFinalize, onRetry, onEdit, onUndo, onRedo }: {
  initialStudio?: boolean;
  session: PlanningV2Session;
  draftStored: boolean;
  onNewPlan: () => void;
  onFinalize: (revision: string) => void;
  onCustomize: (draft: CustomizationDraft) => Promise<boolean>;
  detail: DetailedPlanningResult;
  concept: PlanningRouteConcept;
  brief: TripBriefV1;
  busy: boolean;
  error?: string;
  editError?: string;
  canUndo: boolean;
  canRedo: boolean;
  onBack: () => void;
  onRetry: () => void;
  onEdit: (edit: PlanningV2Edit) => void;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const { itinerary, ledger, validation } = detail;
  const today = itinerary.days.find(day => day.date === sriLankaCalendarDate())?.day;
  const [guideOpen, setGuideOpen] = useState(() => initialStudio && !studioGuideSeen());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editorRevision, setEditorRevision] = useState(0);
  const [savedNotice, setSavedNotice] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [quoteSignal, setQuoteSignal] = useState(0);
  const [focusDay, setFocusDay] = useState<number | undefined>();
  const [highlightId, setHighlightId] = useState<string>();
  const [mapOpen, setMapOpen] = useState(false);
  // Phones start with only day 1 open; showing a day (map chip, pin, Today's plan) opens it.
  const [phone] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(max-width: 767px)").matches);
  const [reveal, setReveal] = useState<{ day: number; count: number }>();
  const revealDay = (day: number) => setReveal(previous => ({ day, count: (previous?.count ?? 0) + 1 }));
  const mapCloseRef = useRef<HTMLButtonElement>(null);
  const mapOpenRef = useRef<HTMLButtonElement>(null);
  const mapWasOpen = useRef(false);
  // Phone map overlay: focus its close button on open, Escape closes, focus returns to the Map button.
  useEffect(() => {
    if (mapOpen) {
      mapWasOpen.current = true;
      mapCloseRef.current?.focus();
      const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setMapOpen(false); };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
    if (mapWasOpen.current) { mapWasOpen.current = false; mapOpenRef.current?.focus({ preventScroll: true }); }
  }, [mapOpen]);
  // The map beside the list is a desktop layout; on smaller screens it only exists while opened.
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(min-width: 1024px)").matches);
  useEffect(() => {
    const query = window.matchMedia?.("(min-width: 1024px)");
    if (!query) return;
    const change = () => setWide(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  const dayElements = useRef(new Map<number, HTMLElement>());

  useEffect(() => {
    if (!savedNotice) return;
    const timer = window.setTimeout(() => setSavedNotice(""), 6000);
    return () => window.clearTimeout(timer);
  }, [savedNotice]);

  // The day being read (the one crossing the upper part of the screen) is the one the map highlights.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setFocusDay(Number((visible.target as HTMLElement).dataset.day));
    }, { rootMargin: "-30% 0px -60% 0px" });
    dayElements.current.forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [itinerary.days.length]);

  useEffect(() => { if (initialStudio) scrollToId("wr-board-route"); }, []);

  const commitEdit = (edit: PlanningV2Edit) => {
    onEdit(edit);
    setAnnouncement("Change applied. Check your days and any messages shown.");
  };
  const scrollToId = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const showDay = (day?: number) => {
    setFocusDay(day);
    if (day) { revealDay(day); scrollToId(`wr-day-${day}`); }
  };
  const showItem = (itemId: string) => {
    setMapOpen(false);
    setHighlightId(itemId);
    const owner = itinerary.days.find(day => day.items.some(item => item.id === itemId));
    if (owner) revealDay(owner.day);
    window.setTimeout(() => document.getElementById(`wr-card-${itemId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };

  const plan = detail.transport ?? concept.transport;
  const legs = useMemo(() => new Map([...plan.legs, plan.arrivalTransfer, plan.departureTransfer,
    ...(detail.transport?.excursions ?? []).flatMap(visit => [visit.outbound, visit.inbound])]
    .filter((leg): leg is TransportLeg => !!leg).map(leg => [leg.id, leg])), [plan, detail.transport]);
  const coveredCities = new Set([...itinerary.cities, ...itinerary.days.map(day => day.visitCity).filter(Boolean)]);
  const unarranged = brief.requestedCities.filter(city => !coveredCities.has(city));
  const visibleIssues = validation.issues.filter(issue => !issue.code.startsWith("COST_")).slice(0, 10);
  const waiting = (detail.unscheduledActivities?.length ?? 0) > 0;

  const days = <div className="wr-board-days">
    {itinerary.days.map(day => <BoardDay key={day.day} day={day} detail={detail} legs={legs} highlightId={highlightId}
      focused={focusDay === day.day} onEdit={commitEdit} onHighlight={setHighlightId}
      defaultOpen={!phone || day.day === 1} reveal={reveal?.day === day.day ? reveal.count : 0}
      sectionRef={element => { if (element) dayElements.current.set(day.day, element); else dayElements.current.delete(day.day); }} />)}
  </div>;

  return <section className="wr-v2 wr-v2-detail wr-board-page" aria-labelledby="wr-v2-detail-title">
    <div className="wr-v2__masthead"><div className="wr-v2__wrap">
      <p className="wr-kicker">Trip Studio · your editable trip</p>
      <h1 id="wr-v2-detail-title">{itinerary.routeName}</h1>
      <p>{itinerary.totalDays} days · {itinerary.totalPeople} {itinerary.totalPeople === 1 ? "traveller" : "travellers"} · Your Sri Lanka travel draft.</p>
    </div></div>

    <div className="wr-board">
      <BoardDndProvider onEdit={commitEdit}><div className="wr-board__list">
        <div className="wr-board__overview">
          <div><span className={`wr-v2__status wr-v2__status--${detail.readiness.toLowerCase().replace(/_/g, "-")}`}>{STATUS[detail.readiness]}</span>
            <h2 className="wr-sr-only">Your itinerary</h2>
            <p>{detail.generationMode === "LIMITED_DRAFT" ? "Limited draft from available place records." :
              "Activity choices were checked against available place records."} Transport and prices remain uncertain where marked.</p></div>
          <div className="wr-board__actions">
            {detail.generationMode === "LIMITED_DRAFT" && !canUndo && !canRedo && <button type="button" className="wr-button wr-button--primary" onClick={onRetry} disabled={busy}>
              <RefreshCw size={16} /> {busy ? "Retrying…" : "Retry suggestions"}</button>}
            <button type="button" className="wr-button wr-button--primary" onClick={() => setQuoteSignal(value => value + 1)}><CarFront size={16} aria-hidden="true" /> Get a driver quote</button>
            <button type="button" className="wr-board__plain" aria-expanded={settingsOpen} onClick={() => { setSettingsOpen(value => !value); if (!settingsOpen) window.setTimeout(() => scrollToId("wr-board-settings"), 50); }}>
              <Settings2 size={16} aria-hidden="true" /> Trip settings</button>
            <button type="button" className="wr-board__plain" aria-expanded={guideOpen} onClick={() => setGuideOpen(value => !value)}><HelpCircle size={16} aria-hidden="true" /> How to edit</button>
            {today && <button type="button" className="wr-board__plain" onClick={() => showDay(today)}><CalendarClock size={16} aria-hidden="true" /> Today's plan</button>}
            <button type="button" className="wr-v2__text-link" disabled={busy} onClick={onNewPlan}>Start another plan</button>
          </div>
        </div>
        {guideOpen && <StudioGuide onClose={() => setGuideOpen(false)} onOpen={id => { setGuideOpen(false); scrollToId(id); }} />}
        {savedNotice && <p className="wr-v2-detail__saved-notice" role="status"><CheckCircle2 size={17} aria-hidden="true" /> {savedNotice}</p>}
        {error && <div className="wr-v2__alert" role="alert"><AlertTriangle size={18} /> {error}</div>}

        <div className="wr-board__bar">
          <nav aria-label="Trip sections">
            <a href="#wr-board-route" onClick={event => { event.preventDefault(); scrollToId("wr-board-route"); }}>Route</a>
            {waiting && <a href="#wr-board-waiting" onClick={event => { event.preventDefault(); scrollToId("wr-board-waiting"); }}>To visit</a>}
            <a href="#wr-board-days" onClick={event => { event.preventDefault(); scrollToId("wr-board-days"); }}>Days</a>
            <a href="#wr-board-budget" onClick={event => { event.preventDefault(); scrollToId("wr-board-budget"); }}>Budget</a>
            <a href="#wr-driver-quote" onClick={event => { event.preventDefault(); setQuoteSignal(value => value + 1); }}>Quote</a>
          </nav>
          <div className="wr-board__history" aria-label="Editing history">
            <span className={`wr-edit-saved${draftStored ? "" : " wr-edit-saved--failed"}`}>{draftStored
              ? <><CheckCircle2 size={15} aria-hidden="true" /> <span className="wr-board__label">Saved</span></> : <><AlertTriangle size={15} aria-hidden="true" /> Not saved</>}</span>
            <button type="button" onClick={() => { onUndo(); setEditorRevision(value => value + 1); }} disabled={busy || !canUndo} aria-label="Undo"><Undo2 size={15} aria-hidden="true" /> <span className="wr-board__label">Undo</span></button>
            <button type="button" onClick={() => { onRedo(); setEditorRevision(value => value + 1); }} disabled={busy || !canRedo} aria-label="Redo"><Redo2 size={15} aria-hidden="true" /> <span className="wr-board__label">Redo</span></button>
          </div>
        </div>
        {!draftStored && <p className="wr-v2-draft-note" role="status">This browser could not save your latest draft. Keep this tab open and download a PDF before leaving.</p>}
        {editError && <div className="wr-v2__alert" role="alert"><AlertTriangle size={18} /> {editError}</div>}
        {validation.errors.length > 0 && <div className="wr-v2__alert" role="alert">This draft has conflicts to resolve: {validation.errors.map(issue => readableIssue(issue.code)).join(" · ")}. Keep editing to resolve them.</div>}
        <p className="wr-sr-only" role="status">{announcement}</p>

        <RouteEditor key={`route-${editorRevision}`} session={session} busy={busy} onCustomize={onCustomize} onFocusDay={showDay} />
        {settingsOpen && <section id="wr-board-settings" className="wr-board-section wr-board-settings" aria-label="Trip settings">
          <button type="button" className="wr-board-settings__close" onClick={() => setSettingsOpen(false)} aria-label="Close trip settings"><X size={18} aria-hidden="true" /></button>
          <PlanningCustomizationPanel key={editorRevision} session={session} busy={busy} onApply={onCustomize}
            onClose={applied => { setSettingsOpen(false); if (applied || canUndo) setSavedNotice("Your changes are saved in this browser."); }} />
        </section>}
        <PlacesToVisit detail={detail} brief={brief} onEdit={commitEdit} />
        {unarranged.length > 0 && <section className="wr-v2__alert"><strong>Visits still to arrange</strong><p>{unarranged.join(", ")} have not been scheduled. Add them under Your route, or keep them as requests.</p></section>}

        <section id="wr-board-days" className="wr-board-section wr-board-section--days" aria-labelledby="wr-days-title">
          <h2 id="wr-days-title">Your days</h2>
          <p className="wr-board-section__lead">Drag a place by its handle to reorder it or move it to another day in the same town, or use ⋯ to move, replace, time or remove it.</p>
          {days}
        </section>

        <section className="wr-board-section wr-board-checks" aria-label="Season and checks">
          <p><strong>Season:</strong> {concept.routeConcept.seasonalAssessment?.status === "SUITABLE" ? "No mapped seasonal warning." :
            concept.routeConcept.seasonalAssessment?.reasons.join(" · ") || "Seasonal conditions need confirmation."}</p>
          <details><summary>What needs checking ({visibleIssues.length})</summary>{visibleIssues.length ? <ul>{visibleIssues.map((issue, index) => <li key={`${issue.code}-${index}`}>
            <AlertTriangle size={15} /><span>{readableIssue(issue.code)}{issue.day ? ` · day ${issue.day}` : ""}{typeof issue.details?.place === "string" ? ` · ${issue.details.place}` : ""}</span></li>)}</ul> : <p>No validation issues found.</p>}</details>
        </section>

        <section id="wr-board-budget" className="wr-board-section" aria-labelledby="wr-budget-title">
          <h2 id="wr-budget-title">Budget</h2>
          <div className="wr-v2-detail__summary" aria-label="Trip costs and status">
            <div><WalletCards size={19} /><span>Whole trip</span><strong>{amountLabel(ledger.summary.trip, ledger.currency)}</strong></div>
            <div><WalletCards size={19} /><span>Per traveller</span><strong>{amountLabel(ledger.summary.perPerson, ledger.currency)}</strong></div>
            <div><WalletCards size={19} /><span>Your budget target</span><strong>{brief.budget.currency} {brief.budget.amount.toLocaleString()}</strong></div>
          </div>
          <PlanningBudgetPanel detail={detail} brief={brief} onAllowance={(group, allowance) => commitEdit({ type: "allowance", group, allowance })} />
        </section>
        <PlanningQuotePanel detail={detail} brief={brief} concept={concept} openSignal={quoteSignal} />
        <PlanningReviewPanel detail={detail} brief={brief} concept={concept} busy={busy} approvedRevision={session.preferredRevision} onFinalize={onFinalize} onRequestQuote={() => setQuoteSignal(value => value + 1)} />
        <p className="wr-v2-detail__footer"><Clock3 size={16} /> Activity durations are estimates. Train, bus and other unverified transfers have no invented timetable.</p>
      </div></BoardDndProvider>

      <div className={`wr-board__map${mapOpen ? " is-open" : ""}`} role={mapOpen ? "dialog" : undefined} aria-modal={mapOpen || undefined} aria-label={mapOpen ? "Trip map" : undefined}>
        <div className="wr-board__map-head">
          <strong>Trip map</strong>
          <button ref={mapCloseRef} type="button" className="wr-board__map-close" onClick={() => setMapOpen(false)} aria-label="Close map"><X size={22} aria-hidden="true" /></button>
        </div>
        {(wide || mapOpen) && <BoardMap detail={detail} brief={brief} focusDay={focusDay} highlightId={highlightId}
          onFocusDay={day => { if (day) showDay(day); else setFocusDay(undefined); }}
          onItem={itemId => showItem(itemId)} />}
      </div>
    </div>
    {!mapOpen && <button ref={mapOpenRef} type="button" className="wr-board__map-open" onClick={() => setMapOpen(true)}><MapIcon size={18} aria-hidden="true" /> Map</button>}
  </section>;
}
