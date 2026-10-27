import { useEffect, useRef, useState } from "react";
import { AlertCircle, RefreshCw, X } from "lucide-react";
import { HomeScreen } from "./components/rl/HomeScreen";
import { PlannerScreen } from "./components/rl/PlannerScreen";
import { ItineraryScreen } from "./components/rl/ItineraryScreen";
import { CostBreakdownScreen } from "./components/rl/CostBreakdownScreen";
import { RoutesScreen } from "./components/rl/RoutesScreen";
import { HotelsScreen } from "./components/rl/HotelsScreen";
import { ShareScreen } from "./components/rl/ShareScreen";
import { AdminScreen } from "./components/rl/AdminScreen";
import { MapScreen } from "./components/rl/MapScreen";
import { PlanningV2BriefScreen } from "./components/rl/PlanningV2BriefScreen";
import { PlanningV2RoutesScreen } from "./components/rl/PlanningV2RoutesScreen";
import { PlanningV2ItineraryScreen } from "./components/rl/PlanningV2ItineraryScreen";
import { BottomNav } from "./components/rl/BottomNav";
import { TopNav } from "./components/rl/TopNav";
import { TripsDrawer } from "./components/rl/TripsDrawer";
import { saveTrip, loadCurrentTrip } from "./lib/tripsDb";
import { resolveCities } from "./lib/cityPlan";
import { generateItineraryWithAI } from "./components/rl/aiService";
import { generateItinerary } from "./components/rl/data";
import { useLiveRates } from "./components/rl/useLiveRates";
import { useBreakpoint } from "./hooks/useBreakpoint";
import { planRouteConcepts, PlanningBriefError, type PlanningV2Issue } from "./lib/planningV2";
import { emptyPlanningV2Session, returnToPlanningConcepts, selectPlanningConcept,
  showPlanningConcepts, showPlanningItinerary, selectedPlanningConcept,
  type PlanningV2Session } from "./lib/planningV2Session";
import { knownPlanningDestinations } from "./lib/routeCandidates";
import { previewPlanningCustomization, type CustomizationDraft } from "./lib/planningCustomization";
import { loadPlanningDraft, savePlanningDraft } from "./lib/planningDraft";
import { loadPlanningV2Places } from "./lib/planningV2Places";
import { generatePlanningV2Itinerary } from "./lib/planningV2Itinerary";
import { applyPlanningV2Edit, redoPlanningV2Edit, undoPlanningV2Edit } from "./lib/planningV2Editing";
import { canRestoreScreen, CLASSIC_PLANNER_SCREEN, PRIMARY_PLANNER_SCREEN,
  resolvePlannerScreen, restoreScreen } from "./lib/plannerNavigation";
import type { TripBriefV1 } from "./lib/planningTypes";
import type { Screen, TripInputs, GeneratedItinerary } from "./components/rl/types";
import { GenerationScreen, type GenerationView } from "./components/rl/GenerationScreen";
import { createGenerationGate, type GenerationPhase } from "./lib/generationRequest";
import "../styles/atlas-app.css";

const SCREEN_KEY = "wanderroute_screen";

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => {
    const saved = localStorage.getItem(SCREEN_KEY) as Screen | null;
    return restoreScreen(saved);
  });
  const [itinerary, setItinerary] = useState<GeneratedItinerary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [generation, setGeneration] = useState<GenerationView | null>(null);
  const generationGate = useRef(createGenerationGate());
  const [quickInputs, setQuickInputs] = useState<TripInputs>();
  const [quickMonth, setQuickMonth] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastInputs, setLastInputs] = useState<TripInputs | null>(null);
  const [lastMonth, setLastMonth] = useState<number | null>(null);
  const fallbackNotice = itinerary?.generationMode === "STANDARD"
    ? "Standard draft · AI suggestions are unavailable. Review this locally generated itinerary before relying on it." : null;
  const [cityToAdd, setCityToAdd] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [v2Session, setV2Session] = useState<PlanningV2Session>(() => loadPlanningDraft(localStorage) ?? emptyPlanningV2Session());
  const [draftStored, setDraftStored] = useState(true);
  useEffect(() => { setDraftStored(savePlanningDraft(localStorage, v2Session)); }, [v2Session]);
  const [v2Busy, setV2Busy] = useState(false);
  const [v2Issues, setV2Issues] = useState<PlanningV2Issue[]>([]);
  const [v2DetailBusy, setV2DetailBusy] = useState(false);
  const [v2DetailError, setV2DetailError] = useState<string>();
  const v2DetailRequest = useRef(0);

  const { rates } = useLiveRates();
  const bp = useBreakpoint();
  const isMobile = bp === "mobile";

  useEffect(() => {
    const saved = loadCurrentTrip();
    if (saved) setItinerary(saved);
  }, []);

  useEffect(() => () => generationGate.current.cancel(), []);

  const cancelGeneration = () => {
    generationGate.current.cancel();
    v2DetailRequest.current += 1;
    setGeneration(null); setIsLoading(false); setV2Busy(false); setV2DetailBusy(false);
  };
  const focusContent = () => requestAnimationFrame(() => {
    const heading = document.querySelector<HTMLElement>("#main-content h1");
    const target = heading ?? document.getElementById("main-content");
    target?.setAttribute("tabindex", "-1");
    target?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  const beginGeneration = (view: GenerationView) => {
    const ticket = generationGate.current.begin();
    if (!ticket) return;
    setGeneration(view);
    window.scrollTo({ top: 0, behavior: "instant" });
    return { ...ticket, onProgress: (phase: GenerationPhase) => {
      if (ticket.isCurrent()) setGeneration(current => current ? { ...current, phase } : current);
    } };
  };
  const v2GenerationView = (brief: TripBriefV1): GenerationView => ({ kind: "v2", phase: "route",
    days: brief.durationDays, people: brief.travellerCount, cities: brief.requestedCities,
    interests: brief.interests, budget: brief.budget.amount, currency: brief.budget.currency });

  const navigate = (next: Screen) => {
    cancelGeneration();
    const destination = resolvePlannerScreen(next);
    if ((next === "itinerary" || next === "costs" || next === "share") && !itinerary) {
      setScreen(CLASSIC_PLANNER_SCREEN);
      return;
    }
    setScreen(destination);
    if (canRestoreScreen(destination)) localStorage.setItem(SCREEN_KEY, destination);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleGenerate = async (rawInputs: TripInputs, travelMonth: number | null = null) => {
    const ticket = beginGeneration({ kind: "classic", phase: "places", days: rawInputs.days,
      people: rawInputs.people, cities: rawInputs.cities, interests: rawInputs.interests,
      budget: rawInputs.budget, currency: rawInputs.currency });
    if (!ticket) return;
    // Honour the route the form showed: canonical geographic order, capped to
    // what the trip length supports, over-long picks dropped. Before this, the
    // raw tap order went to the AI and the map drew whatever it sent back.
    const { cities: routeCities } = resolveCities(rawInputs.cities, rawInputs.days);
    const inputs: TripInputs = { ...rawInputs, cities: routeCities };
    setLastInputs(rawInputs);
    setLastMonth(travelMonth);
    // Pin the itinerary's city list to the resolved route so the route map and
    // day tabs always match, whatever the model echoes back. The month never
    // enters `inputs`, so it never reaches the AI or the serverless functions.
    const withMonth = (trip: GeneratedItinerary, generationMode: "AI" | "STANDARD"): GeneratedItinerary => ({
      ...trip, generationMode,
      cities: routeCities,
      ...(travelMonth ? { travelMonth } : {}),
    });
    setIsLoading(true);
    setError(null);

    try {
      const generated = withMonth(await generateItineraryWithAI(inputs, ticket), "AI");
      if (!ticket.isCurrent()) return;
      setItinerary(generated);
      saveTrip(generated);
      setScreen("itinerary");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (generationError) {
      if (!ticket.isCurrent()) return;
      console.warn("AI enhancements unavailable; using standard itinerary:", generationError);
      try {
        const fallback = withMonth(generateItinerary(inputs, rates), "STANDARD");
        setItinerary(fallback);
        saveTrip(fallback);
        setScreen("itinerary");
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch {
        setError("We couldn't build this itinerary. Your choices are still here, so you can try again.");
      }
    } finally {
      if (ticket.isCurrent()) { setIsLoading(false); setGeneration(null); focusContent(); }
      ticket.finish();
    }
  };

  const handleSelectTrip = (trip: GeneratedItinerary) => {
    cancelGeneration();
    setItinerary(trip);
    setScreen("itinerary");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleV2Plan = async (brief: TripBriefV1) => {
    const ticket = beginGeneration(v2GenerationView(brief));
    if (!ticket) return;
    const requestId = ++v2DetailRequest.current;
    setV2Session(previous => ({ ...previous, view: "brief", brief }));
    setV2DetailBusy(false);
    setV2DetailError(undefined);
    setV2Busy(true);
    setV2Issues([]);
    try {
      const result = await planRouteConcepts(brief);
      if (requestId !== v2DetailRequest.current) return;
      const first = result.concepts[0];
      if (first) {
        const selectedId = first.routeConcept.id;
        const selected = selectPlanningConcept(showPlanningConcepts(result), selectedId);
        setV2DetailBusy(true);
        const detailed = await generatePlanningV2Itinerary(result, selectedId, ticket);
        if (requestId !== v2DetailRequest.current) return;
        setV2Session(showPlanningItinerary(selected, selectedId, detailed));
      } else setV2Session(showPlanningConcepts(result));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (failure) {
      if (!ticket.isCurrent()) return;
      setV2Issues(failure instanceof PlanningBriefError ? failure.issues : [{ code: "PLANNING_ERROR", severity: "ERROR",
        detail: "We could not prepare your itinerary. Your trip details are still here; please try again." }]);
    } finally {
      if (ticket.isCurrent()) { setV2Busy(false); setV2DetailBusy(false); setGeneration(null); focusContent(); }
      ticket.finish();
    }
  };

  const handleV2Select = (id: string) => {
    v2DetailRequest.current += 1;
    setV2DetailBusy(false);
    setV2DetailError(undefined);
    setV2Session(previous => selectPlanningConcept(previous, id));
  };

  const handleV2Detail = async () => {
    const selectedId = v2Session.selectedConceptId;
    const result = v2Session.result;
    if (!selectedId || !result || v2DetailBusy) return;
    const ticket = beginGeneration({ ...v2GenerationView(result.brief), phase: "places" });
    if (!ticket) return;
    const requestId = ++v2DetailRequest.current;
    setV2DetailBusy(true);
    setV2DetailError(undefined);
    try {
      const detailed = await generatePlanningV2Itinerary(result, selectedId, ticket);
      if (requestId !== v2DetailRequest.current) return;
      setV2Session(previous => showPlanningItinerary(previous, selectedId, detailed));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      if (requestId === v2DetailRequest.current) setV2DetailError(
        "We could not build this route draft. Your selected route is safe; please try again.");
    } finally {
      if (ticket.isCurrent()) { setV2DetailBusy(false); setGeneration(null); focusContent(); }
      ticket.finish();
    }
  };

  const handleV2Customize = async (draft: CustomizationDraft): Promise<boolean> => {
    if (v2DetailBusy) return false;
    const proposal = previewPlanningCustomization(v2Session, draft);
    if (!proposal.session) { setV2DetailError(proposal.problems.join(" ")); return false; }
    const requestId = ++v2DetailRequest.current;
    setV2DetailBusy(true); setV2DetailError(undefined);
    try {
      const concept = selectedPlanningConcept(proposal.session)!;
      const visitCities = draft.wishlist.filter(item => item.day && item.requirement !== "EXCLUDED")
        .map(item => ({ ...(knownPlanningDestinations().find(place => place.name === item.city) ?? { id: item.city, name: item.city }), requested: true }));
      const added = [...concept.candidate.destinations, ...visitCities].filter(stop => !v2Session.detailed!.places.some(place => place.city === stop.name));
      const extra = added.length ? await loadPlanningV2Places({ ...concept.candidate, destinations: added }) : [];
      if (requestId !== v2DetailRequest.current) return false;
      const places = [...v2Session.detailed!.places, ...extra.filter(place => !v2Session.detailed!.places.some(old => old.databaseId === place.databaseId))];
      const completed = previewPlanningCustomization(v2Session, draft, places);
      if (!completed.session) { setV2DetailError(completed.problems.join(" ")); return false; }
      setV2Session(completed.session);
      return true;
    } catch { setV2DetailError("Your previous plan is safe. We could not apply these changes; please retry."); return false; }
    finally { if (requestId === v2DetailRequest.current) setV2DetailBusy(false); }
  };

  const handleV2Compare = () => {
    v2DetailRequest.current += 1;
    setV2DetailBusy(false);
    setV2DetailError(undefined);
    setV2Session(previous => returnToPlanningConcepts(previous));
  };

  const handleQuickV2Plan = (inputs: TripInputs, travelMonth?: number | null) => {
    if (generationGate.current.isActive()) return;
    setQuickInputs(inputs); setQuickMonth(travelMonth ?? null);
    const brief: TripBriefV1 = { schemaVersion: 1, durationDays: inputs.days,
      travellerCount: inputs.people, budget: { amount: inputs.budget, currency: inputs.currency },
      interests: inputs.interests, requestedCities: inputs.cities, comfortTier: inputs.travelStyle,
      ...(travelMonth ? { travelMonth } : {}) };
    navigate(PRIMARY_PLANNER_SCREEN);
    handleV2Plan(brief);
  };

  const screenContent = (
    <>
      {screen === "home" && <HomeScreen navigate={navigate} onQuickPlan={handleQuickV2Plan} initialInputs={quickInputs} initialMonth={quickMonth} />}
      {screen === CLASSIC_PLANNER_SCREEN && (
        <PlannerScreen onGenerate={handleGenerate} navigate={navigate} initialCity={cityToAdd} initialInputs={lastInputs} initialMonth={lastMonth} generating={isLoading} />
      )}
      {screen === "itinerary" && itinerary && (
        <ItineraryScreen key={itinerary.id} itinerary={itinerary} navigate={navigate} />
      )}
      {screen === "costs" && itinerary && <CostBreakdownScreen itinerary={itinerary} navigate={navigate} />}
      {screen === "routes" && <RoutesScreen navigate={navigate} />}
      {screen === "hotels" && <HotelsScreen navigate={navigate} />}
      {screen === "share" && itinerary && <ShareScreen itinerary={itinerary} navigate={navigate} />}
      {screen === "admin" && <AdminScreen navigate={navigate} />}
      {screen === "map" && (
        <MapScreen navigate={navigate} onCitySelect={(city) => setCityToAdd(city)} />
      )}
      {screen === "planning-v2" && (v2Session.view === "brief" || !v2Session.result) &&
        <PlanningV2BriefScreen initialBrief={v2Session.brief} busy={v2Busy} externalIssues={v2Issues}
          onPlan={handleV2Plan} onExit={() => navigate("home")}
          onClassic={() => navigate(CLASSIC_PLANNER_SCREEN)} />}
      {screen === "planning-v2" && v2Session.result &&
        (v2Session.view === "compare" || v2Session.view === "selected") &&
        <PlanningV2RoutesScreen session={v2Session} busy={v2Busy} externalIssues={v2Issues}
          detailBusy={v2DetailBusy} detailError={v2DetailError}
          onRetry={() => v2Session.brief && handleV2Plan(v2Session.brief)}
          onEdit={() => { v2DetailRequest.current += 1; setV2Session(previous => ({ ...previous, view: "brief" })); setV2Issues([]); }}
          onSelect={handleV2Select}
          onCompare={handleV2Compare}
          onGenerateDetail={handleV2Detail}
          onOpenDetail={() => setV2Session(previous => previous.detailed ? { ...previous, view: "itinerary" } : previous)}
          onExit={() => navigate("home")} />}
      {screen === "planning-v2" && v2Session.view === "itinerary" &&
        v2Session.detailed && selectedPlanningConcept(v2Session) &&
        <PlanningV2ItineraryScreen key="planning-workspace" detail={v2Session.detailed} session={v2Session} draftStored={draftStored} onNewPlan={() => setV2Session(previous => ({ ...previous, view: "brief" }))} onCustomize={handleV2Customize} onFinalize={revision => setV2Session(previous => ({ ...previous, preferredRevision: revision }))}
          concept={selectedPlanningConcept(v2Session)!} brief={v2Session.result!.brief}
          busy={v2DetailBusy} error={v2DetailError} editError={v2Session.editError}
          canUndo={!!v2Session.editPast?.length} canRedo={!!v2Session.editFuture?.length}
          onBack={handleV2Compare} onRetry={handleV2Detail}
          onEdit={edit => { if (!v2DetailBusy) setV2Session(previous => applyPlanningV2Edit(previous, edit)); }}
          onUndo={() => { if (!v2DetailBusy) setV2Session(undoPlanningV2Edit); }}
          onRedo={() => { if (!v2DetailBusy) setV2Session(redoPlanningV2Edit); }} />}
      {(screen === "itinerary" || screen === "costs" || screen === "share") && !itinerary && (
        <HomeScreen navigate={navigate} onQuickPlan={handleQuickV2Plan} initialInputs={quickInputs} initialMonth={quickMonth} />
      )}
    </>
  );

  return (
    <div className={`wr-app wr-breakpoint-${bp}`}>
      <a className="wr-skip-link" href="#main-content">Skip to main content</a>

      {error && (
        <div className="wr-toast wr-toast-error" role="alert">
          <AlertCircle size={19} aria-hidden="true" />
          <span>{error}</span>
          {lastInputs && (
            <button type="button" className="wr-toast-action" onClick={() => handleGenerate(lastInputs, lastMonth)}>
              <RefreshCw size={14} aria-hidden="true" /> Try again
            </button>
          )}
          <button type="button" className="wr-toast-close" onClick={() => setError(null)} aria-label="Dismiss error">
            <X size={17} />
          </button>
        </div>
      )}

      {!isMobile && (
        <TopNav
          screen={screen}
          navigate={navigate}
          showAdmin={bp === "desktop"}
          onOpenTrips={() => setDrawerOpen(true)}
        />
      )}

      <div id="main-content" className={`wr-main wr-main-${screen}`} tabIndex={-1}>
        {generation && <GenerationScreen view={generation} onCancel={() => { cancelGeneration(); focusContent(); }} />}
        <div hidden={!!generation} className="wr-screen-content">
          {fallbackNotice && screen === "itinerary" && <div className="wr-generation-notice" role="status">
            <AlertCircle size={20} aria-hidden="true" /><p>{fallbackNotice}</p>
            {lastInputs && <button type="button" onClick={() => handleGenerate(lastInputs, lastMonth)}>Retry suggestions</button>}
          </div>}
          {screenContent}
        </div>
      </div>

      {isMobile && (
        <BottomNav screen={screen} navigate={navigate} onOpenTrips={() => setDrawerOpen(true)} />
      )}

      <TripsDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSelectTrip={handleSelectTrip}
        currentTripId={itinerary?.id ?? null}
      />
    </div>
  );
}
