import { useState, useEffect } from "react";
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
import { MapPin, Calendar, Users, Wallet } from "lucide-react";

const NAVY = "#0B1340";
const GOLD = "#C9A227";
const TEAL = "#0D9488";

const LOADING_MESSAGES = [
  "Scanning 50+ Sri Lanka destinations...",
  "Calculating real transport costs...",
  "Finding best stays for your budget...",
  "Building your day-by-day plan...",
  "Checking hidden fees & entry costs...",
  "Almost ready — adding local tips...",
];

// Sidebar shown on these screens at desktop
const SIDEBAR_SCREENS: Screen[] = ["itinerary", "costs", "hotels", "routes"];

function DesktopSidebar({
  screen,
  itinerary,
  navigate,
}: {
  screen: Screen;
  itinerary: GeneratedItinerary | null;
  navigate: (s: Screen) => void;
}) {
  if (screen === "itinerary" || screen === "costs") {
    if (!itinerary) return null;
    const sym = itinerary.currency === "LKR" ? "LKR" : itinerary.currency === "EUR" ? "€" : itinerary.currency === "GBP" ? "£" : itinerary.currency === "AUD" ? "A$" : "$";
    return (
      <aside style={{ width: 280, flexShrink: 0, paddingTop: 32 }}>
        <div style={{ position: "sticky", top: 92, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Route summary */}
          <div style={{ background: "#fff", borderRadius: 20, padding: "20px", boxShadow: "0 4px 20px rgba(11,19,64,0.07)" }}>
            <p style={{ color: "#9CA3AF", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.07em", marginBottom: 12 }}>YOUR ROUTE</p>
            <h3 style={{ color: NAVY, fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: "1rem", marginBottom: 12, lineHeight: 1.3 }}>{itinerary.routeName}</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 14 }}>
              {itinerary.cities.map((city, i) => (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <span style={{ color: NAVY, fontSize: "0.72rem", fontWeight: 700 }}>{city}</span>
                  {i < itinerary.cities.length - 1 && <span style={{ color: GOLD, fontSize: "0.7rem" }}>→</span>}
                </span>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { icon: <Calendar size={12} />, label: `${itinerary.totalDays} days` },
                { icon: <Users size={12} />, label: `${itinerary.totalPeople} traveller${itinerary.totalPeople > 1 ? "s" : ""}` },
                { icon: <Wallet size={12} />, label: `${sym}${itinerary.estimatedTotalCost.toLocaleString()} total` },
                { icon: <MapPin size={12} />, label: itinerary.travelStyle },
              ].map(({ icon, label }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#9CA3AF" }}>{icon}</span>
                  <span style={{ color: "#4B5563", fontSize: "0.78rem" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div style={{ background: `linear-gradient(135deg, ${NAVY}, #1D3560)`, borderRadius: 20, padding: "20px" }}>
            <p style={{ color: GOLD, fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.07em", marginBottom: 12 }}>QUICK ACTIONS</p>
            {[
              { label: "📊 Cost Breakdown", screen: "costs" as Screen },
              { label: "🏨 Find Hotels", screen: "hotels" as Screen },
              { label: "📤 Share Trip", screen: "share" as Screen },
            ].map(({ label, screen: s }) => (
              <button key={s} onClick={() => navigate(s)} style={{
                display: "block", width: "100%", marginBottom: 8,
                padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.06)", color: "#fff",
                fontWeight: 600, fontSize: "0.8rem", cursor: "pointer", textAlign: "left",
              }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </aside>
    );
  }

  if (screen === "hotels") {
    return (
      <aside style={{ width: 280, flexShrink: 0, paddingTop: 32 }}>
        <div style={{ position: "sticky", top: 92 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: "20px", boxShadow: "0 4px 20px rgba(11,19,64,0.07)" }}>
            <p style={{ color: "#9CA3AF", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.07em", marginBottom: 14 }}>BOOKING TIPS</p>
            {[
              "Book guesthouses directly for 15–25% savings vs OTAs.",
              "Comfort hotels in Ella and Kandy sell out Dec–Mar — book 8+ weeks ahead.",
              "Agoda often beats Booking.com for Sri Lanka properties.",
              "Always check if the hotel offers free airport pickup.",
            ].map((tip, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "flex-start" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: GOLD, flexShrink: 0, marginTop: 5 }} />
                <p style={{ color: "#4B5563", fontSize: "0.78rem", lineHeight: 1.5, margin: 0 }}>{tip}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>
    );
  }

  if (screen === "routes") {
    return (
      <aside style={{ width: 280, flexShrink: 0, paddingTop: 32 }}>
        <div style={{ position: "sticky", top: 92 }}>
          <div style={{ background: `linear-gradient(135deg, ${TEAL}15, ${TEAL}05)`, border: `1px solid ${TEAL}25`, borderRadius: 20, padding: "20px" }}>
            <p style={{ color: TEAL, fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.07em", marginBottom: 14 }}>ROUTE FINDER</p>
            <p style={{ color: NAVY, fontWeight: 700, fontSize: "0.88rem", marginBottom: 8 }}>Not sure where to start?</p>
            <p style={{ color: "#4B5563", fontSize: "0.78rem", lineHeight: 1.6, marginBottom: 16 }}>
              First-time? Try Classic Sri Lanka (7 days). Beach + culture lovers: Southern Coast. Mountain fans: Tea Country.
            </p>
            <button onClick={() => navigate("planner")} style={{
              width: "100%", padding: "12px", borderRadius: 12, border: "none",
              background: `linear-gradient(135deg, ${GOLD}, #E8C547)`,
              color: NAVY, fontWeight: 700, fontSize: "0.85rem", cursor: "pointer",
            }}>
              Plan My Route →
            </button>
          </div>
        </div>
      </aside>
    );
  }

  return null;
}

// Screens that are safe to restore on reload — they don't require itinerary data.
const RESTORABLE_SCREENS: Screen[] = ["home", "planner", "routes", "hotels", "map"];
const SCREEN_KEY = "wanderroute_screen";

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => {
    const saved = localStorage.getItem(SCREEN_KEY) as Screen | null;
    return saved && RESTORABLE_SCREENS.includes(saved) ? saved : "home";
  });
  const [itinerary, setItinerary] = useState<GeneratedItinerary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [error, setError] = useState<string | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [startCityOverride, setStartCityOverride] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { rates } = useLiveRates();
  const bp = useBreakpoint();

  // Restore the last active trip on startup so a refresh keeps the user's place.
  useEffect(() => {
    const saved = loadCurrentTrip();
    if (saved) setItinerary(saved);
  }, []);

  useEffect(() => {
    if (!fallbackNotice) return;

    const timeout = window.setTimeout(() => {
      setFallbackNotice(null);
    }, 4500);

    return () => window.clearTimeout(timeout);
  }, [fallbackNotice]);

  const navigate = (s: Screen) => {
    if ((s === "itinerary" || s === "costs") && !itinerary) {
      setScreen("planner");
      return;
    }
    if (s === "share" && !itinerary) {
      setScreen("planner");
      return;
    }
    setScreen(s);
    if (RESTORABLE_SCREENS.includes(s)) localStorage.setItem(SCREEN_KEY, s);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleGenerate = async (inputs: TripInputs) => {
    setIsLoading(true);
    setError(null);
    setFallbackNotice(null);

    let msgIndex = 0;
    const msgInterval = setInterval(() => {
      msgIndex = (msgIndex + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[msgIndex]);
    }, 2200);

    try {
      const generated = await generateItineraryWithAI(inputs);
      setItinerary(generated);
      saveTrip(generated); // saves locally instantly, then syncs to Supabase
      setFallbackNotice(null);
      setScreen("itinerary");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.warn("AI enhancements unavailable; using standard itinerary:", err);
      try {
        const fallback = generateItinerary(inputs, rates);
        setItinerary(fallback);
        saveTrip(fallback); // saves locally instantly, then syncs to Supabase
        setFallbackNotice("Standard itinerary generated. AI enhancements are temporarily unavailable.");
        setScreen("itinerary");
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      clearInterval(msgInterval);
      setIsLoading(false);
    }
  };

  const showSidebar = bp === "desktop" && SIDEBAR_SCREENS.includes(screen);

  // ── Loading overlay (works at all breakpoints) ──
  const loadingOverlay = isLoading ? (
    <div style={{
      position: "fixed", inset: 0, zIndex: 999,
      background: "linear-gradient(160deg, #0B1340 0%, #1D2E6B 50%, #0B3D3A 100%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "40px 32px",
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: "50%",
        background: "rgba(201,162,39,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 32,
        animation: "pulse 2s ease-in-out infinite",
      }}>
        <div style={{ fontSize: "2.5rem" }}>🧭</div>
      </div>
      <h2 style={{ color: "#fff", fontFamily: "'Playfair Display', serif", fontSize: "1.6rem", fontWeight: 800, textAlign: "center", marginBottom: 12 }}>
        Planning Your Trip
      </h2>
      <p style={{ color: GOLD, fontSize: "0.85rem", fontWeight: 600, textAlign: "center", marginBottom: 40, minHeight: 24, transition: "opacity 0.4s" }}>
        {loadingMsg}
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: "50%",
            background: GOLD, opacity: 0.3,
            animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.72rem", marginTop: 48, textAlign: "center" }}>
        AI is crafting your personalised itinerary
      </p>
      <style>{`
        @keyframes pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.08);opacity:0.8} }
        @keyframes bounce { 0%,100%{transform:translateY(0);opacity:0.3} 50%{transform:translateY(-8px);opacity:1} }
      `}</style>
    </div>
  ) : null;

  // ── Error toast ──
  const errorToast = error ? (
    <div style={{
      position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
      zIndex: 1000, background: "#EF4444", color: "#fff",
      borderRadius: 12, padding: "12px 20px",
      fontSize: "0.85rem", fontWeight: 600,
      boxShadow: "0 4px 20px rgba(239,68,68,0.4)",
      maxWidth: 360, textAlign: "center",
    }}>
      {error}
      <button onClick={() => setError(null)} style={{ marginLeft: 12, background: "none", border: "none", color: "#fff", cursor: "pointer", fontWeight: 700 }}>✕</button>
    </div>
  ) : null;

  const fallbackNoticeToast = fallbackNotice ? (
    <div style={{
      position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
      zIndex: 1000, background: "#fff", color: NAVY,
      border: "1px solid rgba(11,19,64,0.12)",
      borderRadius: 12, padding: "12px 20px",
      fontSize: "0.85rem", fontWeight: 600,
      boxShadow: "0 4px 20px rgba(11,19,64,0.12)",
      maxWidth: 420, textAlign: "center",
    }}>
      {fallbackNotice}
      <button onClick={() => setFallbackNotice(null)} style={{ marginLeft: 12, background: "none", border: "none", color: NAVY, cursor: "pointer", fontWeight: 700 }}>×</button>
    </div>
  ) : null;

  // ── Saved-trips drawer (shared across all layouts) ──
  const handleSelectTrip = (trip: GeneratedItinerary) => {
    setItinerary(trip);
    setScreen("itinerary");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const tripsDrawer = (
    <TripsDrawer
      isOpen={drawerOpen}
      onClose={() => setDrawerOpen(false)}
      onSelectTrip={handleSelectTrip}
      currentTripId={itinerary?.id ?? null}
    />
  );

  // Floating "My Trips" button — used on mobile, where there's no TopNav.
  const tripsButtonFloating = (
    <button
      onClick={() => setDrawerOpen(true)}
      style={{
        position: "fixed", top: 16, right: 16, zIndex: 150,
        background: GOLD, border: "none", borderRadius: 12,
        padding: "8px 14px", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 6,
        boxShadow: "0 4px 16px rgba(201,162,39,0.35)",
      }}
    >
      <span style={{ fontSize: "1rem" }}>🗺️</span>
      <span style={{ color: NAVY, fontWeight: 800, fontSize: "0.78rem" }}>My Trips</span>
    </button>
  );

  // ── Screen content ──
  const screenContent = (
    <>
      {screen === "home" && <HomeScreen navigate={navigate} />}
      {screen === "planner" && <PlannerScreen onGenerate={handleGenerate} navigate={navigate} initialStartCity={startCityOverride} />}
      {screen === "itinerary" && itinerary && <ItineraryScreen itinerary={itinerary} navigate={navigate} />}
      {screen === "costs" && itinerary && <CostBreakdownScreen itinerary={itinerary} navigate={navigate} />}
      {screen === "routes" && <RoutesScreen navigate={navigate} />}
      {screen === "hotels" && <HotelsScreen navigate={navigate} />}
      {screen === "share" && itinerary && <ShareScreen itinerary={itinerary} navigate={navigate} />}
      {screen === "admin" && <AdminScreen navigate={navigate} />}
      {screen === "map" && <MapScreen navigate={navigate} onCitySelect={(city) => setStartCityOverride(city)} />}
      {(screen === "itinerary" || screen === "costs" || screen === "share") && !itinerary && <HomeScreen navigate={navigate} />}
    </>
  );

  // ── MOBILE layout (< 768px): original phone shell ──
  if (bp === "mobile") {
    return (
      <div style={{
        background: "linear-gradient(160deg, #0B1340 0%, #1a3260 45%, #0D4A3A 100%)",
        minHeight: "100dvh", display: "flex", justifyContent: "center", alignItems: "flex-start",
      }}>
        <div style={{
          width: "100%", maxWidth: 430, minHeight: "100dvh",
          background: "#EEF2FA", position: "relative",
          display: "flex", flexDirection: "column",
          boxShadow: "0 0 80px rgba(0,0,0,0.4)",
        }}>
          {loadingOverlay}
          {errorToast}
          {fallbackNoticeToast}
          {tripsButtonFloating}
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
            {screenContent}
          </div>
          <BottomNav screen={screen} navigate={navigate} />
          {tripsDrawer}
        </div>
      </div>
    );
  }

  // ── TABLET layout (768–1199px): full-width, top nav ──
  if (bp === "tablet") {
    return (
      <div style={{ background: "#EEF2FA", minHeight: "100dvh" }}>
        {loadingOverlay}
        {errorToast}
        {fallbackNoticeToast}
        <TopNav screen={screen} navigate={navigate} showAdmin={false} onOpenTrips={() => setDrawerOpen(true)} />
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 40px" }}>
          {screenContent}
        </div>
        {tripsDrawer}
      </div>
    );
  }

  // ── DESKTOP layout (≥ 1200px): full-width, top nav, optional sidebar ──
  return (
    <div style={{ background: "#EEF2FA", minHeight: "100dvh" }}>
      {loadingOverlay}
      {errorToast}
      {fallbackNoticeToast}
      <TopNav screen={screen} navigate={navigate} showAdmin={true} onOpenTrips={() => setDrawerOpen(true)} />
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 40px 60px", display: "flex", gap: 32, alignItems: "flex-start" }}>
        {showSidebar && (
          <DesktopSidebar screen={screen} itinerary={itinerary} navigate={navigate} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {screenContent}
        </div>
      </div>
      {tripsDrawer}
    </div>
  );
}
