import { useState } from "react";
import { Check, Link, Mail, ArrowLeft, Download, MessageCircle } from "lucide-react";
import type { GeneratedItinerary, Screen } from "./types";
import { CURRENCY_SYMBOLS } from "./data";

const NAVY = "#0B1340";
const GOLD = "#C9A227";
const TEAL = "#0D9488";
const GREEN = "#10B981";

export function ShareScreen({
  itinerary,
  navigate,
}: {
  itinerary: GeneratedItinerary;
  navigate: (s: Screen) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const sym = CURRENCY_SYMBOLS[itinerary.currency];

  const handleCopy = () => {
    const text = `🇱🇰 My Sri Lanka Trip — ${itinerary.routeName}\n📍 ${itinerary.cities.join(" → ")}\n📅 ${itinerary.totalDays} days · ${itinerary.totalPeople} ${itinerary.totalPeople === 1 ? "person" : "people"}\n💰 Est. ${sym}${itinerary.estimatedTotalCost.toLocaleString()} total\n\nPlanned with RouteLanka.app`;
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const shareButtons = [
    {
      label: "WhatsApp",
      emoji: "💬",
      color: "#25D366",
      textColor: "#fff",
      action: () => {},
    },
    {
      label: "Email",
      emoji: "📧",
      color: "#EA4335",
      textColor: "#fff",
      action: () => {},
    },
    {
      label: "Copy Link",
      emoji: copied ? "✅" : "🔗",
      color: copied ? GREEN : NAVY,
      textColor: "#fff",
      action: handleCopy,
    },
    {
      label: "Instagram",
      emoji: "📸",
      color: "#E1306C",
      textColor: "#fff",
      action: () => {},
    },
  ];

  return (
    <div style={{ background: "#EEF2FA", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(160deg, ${NAVY} 0%, #1D2E6B 100%)`, padding: "36px 24px 32px" }}>
        <button
          onClick={() => navigate("itinerary")}
          style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 10, padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, marginBottom: 20 }}
        >
          <ArrowLeft size={16} color="#fff" />
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.8rem" }}>Back</span>
        </button>

        <p style={{ color: GOLD, fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.1em", marginBottom: 8 }}>SHARE YOUR TRIP</p>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "2rem", fontWeight: 900, color: "#fff", lineHeight: 1.15 }}>
          Share Your<br />Itinerary
        </h1>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.85rem", lineHeight: 1.6, marginTop: 10 }}>
          Send your plan to travel buddies or save it for offline access.
        </p>
      </div>

      <div style={{ padding: "24px" }}>
        {/* Trip preview card */}
        <div style={{
          background: "#fff", borderRadius: 24, overflow: "hidden",
          boxShadow: "0 8px 32px rgba(11,19,64,0.12)",
          marginBottom: 24,
        }}>
          {/* Card header with gradient */}
          <div style={{
            background: `linear-gradient(135deg, ${NAVY} 0%, #1D3560 50%, #0B4040 100%)`,
            padding: "24px 22px", position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(201,162,39,0.08)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 26, height: 26, background: GOLD, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem" }}>🧭</div>
              <span style={{ color: "#fff", fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: "1rem" }}>
                Route<span style={{ color: GOLD }}>Lanka</span>
              </span>
            </div>

            <h2 style={{ color: "#fff", fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: "1.3rem", lineHeight: 1.2, marginBottom: 6 }}>
              {itinerary.routeName}
            </h2>
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.78rem", marginBottom: 16 }}>
              {itinerary.routeSlogan}
            </p>

            {/* Cities */}
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
              {itinerary.cities.map((city, i) => (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ color: "#fff", fontSize: "0.78rem", fontWeight: 600 }}>{city}</span>
                  {i < itinerary.cities.length - 1 && (
                    <span style={{ color: GOLD, fontSize: "0.8rem" }}>→</span>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* Card body */}
          <div style={{ padding: "20px 22px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
              {[
                { label: "Duration", value: `${itinerary.totalDays} days`, icon: "📅" },
                { label: "Travellers", value: `${itinerary.totalPeople} ${itinerary.totalPeople === 1 ? "person" : "people"}`, icon: "👥" },
                { label: "Total Cost", value: `${sym}${itinerary.estimatedTotalCost.toLocaleString()}`, icon: "💰" },
                { label: "Per Person", value: `${sym}${itinerary.estimatedCostPerPerson.toLocaleString()}`, icon: "🧍" },
              ].map(({ label, value, icon }) => (
                <div key={label} style={{
                  background: "rgba(11,19,64,0.03)", borderRadius: 12, padding: "12px 14px",
                }}>
                  <div style={{ fontSize: "0.9rem", marginBottom: 4 }}>{icon}</div>
                  <p style={{ color: "#9CA3AF", fontSize: "0.68rem", fontWeight: 600, margin: "0 0 2px" }}>{label}</p>
                  <p style={{ color: NAVY, fontWeight: 800, fontSize: "0.9rem", margin: 0, fontFamily: "'Playfair Display', serif" }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Highlights mini */}
            <div style={{ borderTop: "1px solid rgba(11,19,64,0.06)", paddingTop: 16 }}>
              <p style={{ color: "#9CA3AF", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.05em", marginBottom: 10 }}>HIGHLIGHTS</p>
              {itinerary.highlights.slice(0, 2).map((h, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: GOLD, flexShrink: 0 }} />
                  <span style={{ color: "#4B5563", fontSize: "0.78rem" }}>{h}</span>
                </div>
              ))}
            </div>

            {/* RouteLanka branding */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 6, marginTop: 16, paddingTop: 14,
              borderTop: "1px solid rgba(11,19,64,0.06)",
            }}>
              <span style={{ color: "#9CA3AF", fontSize: "0.72rem" }}>Generated by</span>
              <span style={{ color: NAVY, fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: "0.85rem" }}>
                Route<span style={{ color: GOLD }}>Lanka</span>
              </span>
            </div>
          </div>
        </div>

        {/* Share options */}
        <div style={{ background: "#fff", borderRadius: 20, padding: "20px", boxShadow: "0 4px 16px rgba(11,19,64,0.06)", marginBottom: 16 }}>
          <p style={{ color: "#9CA3AF", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 16 }}>SHARE VIA</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {shareButtons.map(({ label, emoji, color, textColor, action }) => (
              <button
                key={label}
                onClick={action}
                style={{
                  padding: "14px 16px", borderRadius: 14, border: "none", cursor: "pointer",
                  background: color, color: textColor,
                  fontWeight: 700, fontSize: "0.85rem",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  transition: "all 0.2s",
                }}
              >
                <span style={{ fontSize: "1.1rem" }}>{emoji}</span>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Download / Save options */}
        <div style={{ background: "#fff", borderRadius: 20, padding: "20px", boxShadow: "0 4px 16px rgba(11,19,64,0.06)", marginBottom: 24 }}>
          <p style={{ color: "#9CA3AF", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 16 }}>SAVE OFFLINE</p>

          <button
            onClick={handleDownload}
            style={{
              width: "100%", padding: "14px 16px", borderRadius: 14, border: "none", cursor: "pointer",
              background: saved ? `${GREEN}15` : `${NAVY}06`,
              color: saved ? GREEN : NAVY,
              fontWeight: 700, fontSize: "0.88rem",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              marginBottom: 10, outline: saved ? `1.5px solid ${GREEN}` : "none",
              transition: "all 0.3s",
            }}
          >
            {saved ? <Check size={16} /> : <Download size={16} />}
            {saved ? "Saved to My Trips!" : "Download PDF"}
          </button>

          <button
            onClick={handleCopy}
            style={{
              width: "100%", padding: "14px 16px", borderRadius: 14, cursor: "pointer",
              background: "transparent",
              color: "#6B7280",
              fontWeight: 600, fontSize: "0.85rem",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              border: "1px solid rgba(11,19,64,0.1)",
            }}
          >
            {copied ? <Check size={16} color={GREEN} /> : <Link size={16} />}
            {copied ? "Link copied!" : "Copy trip summary"}
          </button>
        </div>

        {/* Plan another trip */}
        <button
          onClick={() => navigate("planner")}
          style={{
            width: "100%", padding: "16px", borderRadius: 16, border: "none", cursor: "pointer",
            background: `linear-gradient(135deg, ${GOLD}, #E8C547)`,
            color: NAVY, fontWeight: 800, fontSize: "0.95rem",
            boxShadow: "0 6px 20px rgba(201,162,39,0.3)",
          }}
        >
          ✈️ Plan Another Trip
        </button>

        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}
