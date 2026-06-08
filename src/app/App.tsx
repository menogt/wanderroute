import { useState } from "react";
import { HomeScreen } from "./components/rl/HomeScreen";
import { PlannerScreen } from "./components/rl/PlannerScreen";
import { ItineraryScreen } from "./components/rl/ItineraryScreen";
import { CostBreakdownScreen } from "./components/rl/CostBreakdownScreen";
import { RoutesScreen } from "./components/rl/RoutesScreen";
import { HotelsScreen } from "./components/rl/HotelsScreen";
import { ShareScreen } from "./components/rl/ShareScreen";
import { BottomNav } from "./components/rl/BottomNav";
import { generateItineraryWithAI } from "./components/rl/claudeApi";
import { generateItinerary } from "./components/rl/data";
import type { Screen, TripInputs, GeneratedItinerary } from "./components/rl/types";

const NAVY = "#0B1340";
const GOLD = "#C9A227";

// Screens that show the share tab as active
const SHARE_SCREENS: Screen[] = ["share"];

const LOADING_MESSAGES = [
  "Scanning 50+ Sri Lanka destinations...",
  "Calculating real transport costs...",
  "Finding best stays for your budget...",
  "Building your day-by-day plan...",
  "Checking hidden fees & entry costs...",
  "Almost ready — adding local tips...",
];

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [itinerary, setItinerary] = useState<GeneratedItinerary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [error, setError] = useState<string | null>(null);

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
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleGenerate = async (inputs: TripInputs) => {
    setIsLoading(true);
    setError(null);

    // Cycle through loading messages while AI works
    let msgIndex = 0;
    const msgInterval = setInterval(() => {
      msgIndex = (msgIndex + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[msgIndex]);
    }, 2200);

    try {
      const generated = await generateItineraryWithAI(inputs);
      setItinerary(generated);
      setScreen("itinerary");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("AI generation failed, falling back to static:", err);
      // Fallback to static generator if API fails
      try {
        const fallback = generateItinerary(inputs);
        setItinerary(fallback);
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

  return (
    <div
      style={{
        background: "linear-gradient(160deg, #0B1340 0%, #1a3260 45%, #0D4A3A 100%)",
        minHeight: "100dvh",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 430,
          minHeight: "100dvh",
          background: "#EEF2FA",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 0 80px rgba(0,0,0,0.4)",
        }}
      >
        {/* ── AI Loading Overlay ── */}
        {isLoading && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 999,
            background: "linear-gradient(160deg, #0B1340 0%, #1D2E6B 50%, #0B3D3A 100%)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: "40px 32px",
          }}>
            {/* Animated compass */}
            <div style={{
              width: 80, height: 80, borderRadius: "50%",
              background: "rgba(201,162,39,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 32,
              animation: "pulse 2s ease-in-out infinite",
            }}>
              <div style={{ fontSize: "2.5rem" }}>🧭</div>
            </div>

            <h2 style={{
              color: "#fff",
              fontFamily: "'Playfair Display', serif",
              fontSize: "1.6rem", fontWeight: 800,
              textAlign: "center", marginBottom: 12,
            }}>
              Planning Your Trip
            </h2>

            <p style={{
              color: GOLD,
              fontSize: "0.85rem", fontWeight: 600,
              textAlign: "center", marginBottom: 40,
              minHeight: 24, transition: "opacity 0.4s",
            }}>
              {loadingMsg}
            </p>

            {/* Progress dots */}
            <div style={{ display: "flex", gap: 8 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: GOLD,
                  opacity: 0.3,
                  animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>

            <p style={{
              color: "rgba(255,255,255,0.3)",
              fontSize: "0.72rem", marginTop: 48,
              textAlign: "center",
            }}>
              AI is crafting your personalised itinerary
            </p>

            <style>{`
              @keyframes pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.08);opacity:0.8} }
              @keyframes bounce { 0%,100%{transform:translateY(0);opacity:0.3} 50%{transform:translateY(-8px);opacity:1} }
            `}</style>
          </div>
        )}

        {/* ── Error Toast ── */}
        {error && (
          <div style={{
            position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
            zIndex: 1000, background: "#EF4444", color: "#fff",
            borderRadius: 12, padding: "12px 20px",
            fontSize: "0.85rem", fontWeight: 600,
            boxShadow: "0 4px 20px rgba(239,68,68,0.4)",
            maxWidth: 360, textAlign: "center",
          }}>
            {error}
            <button
              onClick={() => setError(null)}
              style={{ marginLeft: 12, background: "none", border: "none", color: "#fff", cursor: "pointer", fontWeight: 700 }}
            >✕</button>
          </div>
        )}
        {/* Scrollable screen content */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
          {screen === "home" && <HomeScreen navigate={navigate} />}
          {screen === "planner" && <PlannerScreen onGenerate={handleGenerate} navigate={navigate} />}
          {screen === "itinerary" && itinerary && <ItineraryScreen itinerary={itinerary} navigate={navigate} />}
          {screen === "costs" && itinerary && <CostBreakdownScreen itinerary={itinerary} navigate={navigate} />}
          {screen === "routes" && <RoutesScreen navigate={navigate} />}
          {screen === "hotels" && <HotelsScreen navigate={navigate} />}
          {screen === "share" && itinerary && <ShareScreen itinerary={itinerary} navigate={navigate} />}

          {/* Fallback if navigating to itinerary/share without data */}
          {(screen === "itinerary" || screen === "costs" || screen === "share") && !itinerary && (
            <HomeScreen navigate={navigate} />
          )}
        </div>

        {/* Fixed bottom navigation */}
        <BottomNav screen={screen} navigate={navigate} />
      </div>
    </div>
  );
}
