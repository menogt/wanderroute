import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, RefreshCw, X } from "lucide-react";
import { HomeScreen } from "./components/rl/HomeScreen";
import { PlannerScreen } from "./components/rl/PlannerScreen";
import { ItineraryScreen } from "./components/rl/ItineraryScreen";
import { CostBreakdownScreen } from "./components/rl/CostBreakdownScreen";
import { RoutesScreen } from "./components/rl/RoutesScreen";
import { HotelsScreen } from "./components/rl/HotelsScreen";
import { ShareScreen } from "./components/rl/ShareScreen";
import { AdminScreen } from "./components/rl/AdminScreen";
import { MapScreen } from "./components/rl/MapScreen";
import { BottomNav } from "./components/rl/BottomNav";
import { TopNav } from "./components/rl/TopNav";
import { TripsDrawer } from "./components/rl/TripsDrawer";
import { saveTrip, loadCurrentTrip } from "./lib/tripsDb";
import { generateItineraryWithAI } from "./components/rl/claudeApi";
import { generateItinerary } from "./components/rl/data";
import { useLiveRates } from "./components/rl/useLiveRates";
import { useBreakpoint } from "./hooks/useBreakpoint";
import type { Screen, TripInputs, GeneratedItinerary } from "./components/rl/types";
import "../styles/atlas-app.css";

const LOADING_MESSAGES = [
  "Finding practical routes…",
  "Checking realistic local costs…",
  "Discovering stays and attractions…",
  "Balancing your daily budget…",
  "Building your itinerary…",
];

const RESTORABLE_SCREENS: Screen[] = ["home", "planner", "routes", "hotels", "map"];
const SCREEN_KEY = "wanderroute_screen";

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

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => {
    const saved = localStorage.getItem(SCREEN_KEY) as Screen | null;
    return saved && RESTORABLE_SCREENS.includes(saved) ? saved : "home";
  });
  const [itinerary, setItinerary] = useState<GeneratedItinerary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [error, setError] = useState<string | null>(null);
  const [lastInputs, setLastInputs] = useState<TripInputs | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [startCityOverride, setStartCityOverride] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { rates } = useLiveRates();
  const bp = useBreakpoint();
  const isMobile = bp === "mobile";

  useEffect(() => {
    const saved = loadCurrentTrip();
    if (saved) setItinerary(saved);
  }, []);

  useEffect(() => {
    if (!fallbackNotice) return;
    const timeout = window.setTimeout(() => setFallbackNotice(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [fallbackNotice]);

  const navigate = (next: Screen) => {
    if ((next === "itinerary" || next === "costs" || next === "share") && !itinerary) {
      setScreen("planner");
      return;
    }
    setScreen(next);
    if (RESTORABLE_SCREENS.includes(next)) localStorage.setItem(SCREEN_KEY, next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleGenerate = async (inputs: TripInputs) => {
    setLastInputs(inputs);
    setIsLoading(true);
    setLoadingMsg(LOADING_MESSAGES[0]);
    setError(null);
    setFallbackNotice(null);

    let msgIndex = 0;
    const msgInterval = window.setInterval(() => {
      msgIndex = (msgIndex + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[msgIndex]);
    }, 2200);

    try {
      const generated = await generateItineraryWithAI(inputs);
      setItinerary(generated);
      saveTrip(generated);
      setScreen("itinerary");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (generationError) {
      console.warn("AI enhancements unavailable; using standard itinerary:", generationError);
      try {
        const fallback = generateItinerary(inputs, rates);
        setItinerary(fallback);
        saveTrip(fallback);
        setFallbackNotice("A practical standard itinerary was created while enhanced planning is unavailable.");
        setScreen("itinerary");
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch {
        setError("We couldn't build this itinerary. Your choices are still here, so you can try again.");
      }
    } finally {
      window.clearInterval(msgInterval);
      setIsLoading(false);
    }
  };

  const handleSelectTrip = (trip: GeneratedItinerary) => {
    setItinerary(trip);
    setScreen("itinerary");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const screenContent = (
    <>
      {screen === "home" && <HomeScreen navigate={navigate} onGenerate={handleGenerate} />}
      {screen === "planner" && (
        <PlannerScreen onGenerate={handleGenerate} navigate={navigate} initialStartCity={startCityOverride} />
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
        <MapScreen navigate={navigate} onCitySelect={(city) => setStartCityOverride(city)} />
      )}
      {(screen === "itinerary" || screen === "costs" || screen === "share") && !itinerary && (
        <HomeScreen navigate={navigate} onGenerate={handleGenerate} />
      )}
    </>
  );

  return (
    <div className={`wr-app wr-breakpoint-${bp}`}>
      <a className="wr-skip-link" href="#main-content">Skip to main content</a>

      {isLoading && (
        <div className="wr-loading-overlay" role="status" aria-live="polite" aria-label="Building your itinerary">
          <div className="wr-loading-atlas">
            <p className="wr-loading-kicker">WanderRoute · Sri Lanka</p>
            <SriLankaLoadingMark />
            <h2>Plotting your journey</h2>
            <p className="wr-loading-message">{loadingMsg}</p>
            <div className="wr-loading-track" aria-hidden="true"><span /></div>
            <p className="wr-loading-note">We’ll use a reliable standard plan if enhanced planning is unavailable.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="wr-toast wr-toast-error" role="alert">
          <AlertCircle size={19} aria-hidden="true" />
          <span>{error}</span>
          {lastInputs && (
            <button type="button" className="wr-toast-action" onClick={() => handleGenerate(lastInputs)}>
              <RefreshCw size={14} aria-hidden="true" /> Try again
            </button>
          )}
          <button type="button" className="wr-toast-close" onClick={() => setError(null)} aria-label="Dismiss error">
            <X size={17} />
          </button>
        </div>
      )}

      {fallbackNotice && (
        <div className="wr-toast wr-toast-status" role="status">
          <CheckCircle2 size={19} aria-hidden="true" />
          <span>{fallbackNotice}</span>
          <button type="button" className="wr-toast-close" onClick={() => setFallbackNotice(null)} aria-label="Dismiss notice">
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
        {screenContent}
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
