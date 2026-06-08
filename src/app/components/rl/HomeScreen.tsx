import { ArrowRight, MapPin, Sparkles, Users, Clock, Star, ChevronRight, Zap, Shield, Compass } from "lucide-react";
import { POPULAR_ROUTES } from "./data";
import type { Screen } from "./types";

const NAVY = "#0B1340";
const GOLD = "#C9A227";
const GOLD_LIGHT = "#E8C547";
const TEAL = "#0D9488";

const howItWorks = [
  { icon: "💰", step: "01", title: "Set Your Budget", desc: "Enter your total trip budget and we crunch the numbers." },
  { icon: "📅", step: "02", title: "Choose Your Trip", desc: "Pick duration, group size, interests & travel style." },
  { icon: "🗺️", step: "03", title: "Get Your Itinerary", desc: "Instant day-by-day plan with real cost breakdowns." },
];

const stats = [
  { value: "4,200+", label: "Trips Generated" },
  { value: "98%", label: "Budget Accuracy" },
  { value: "50+", label: "Sri Lanka Destinations" },
  { value: "4.9 ★", label: "Traveller Rating" },
];

const testimonials = [
  {
    name: "Sarah M.", flag: "🇬🇧", rating: 5,
    text: "Used RouteLanka for my solo trip. Saved over $200 vs what travel agents quoted. The hidden cost warnings alone were worth it.",
  },
  {
    name: "Raj & Priya", flag: "🇮🇳", rating: 5,
    text: "Honeymoon trip to Ella and Mirissa. The itinerary was spot-on — even the tuk-tuk prices were accurate!",
  },
];

export function HomeScreen({ navigate }: { navigate: (s: Screen) => void }) {
  return (
    <div style={{ background: "#EEF2FA", minHeight: "100vh" }}>
      {/* ── Hero ─────────────────────────────────────── */}
      <div
        style={{
          background: `linear-gradient(160deg, ${NAVY} 0%, #1D2E6B 45%, #0B3D3A 100%)`,
          padding: "0 0 40px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative circles */}
        <div style={{ position: "absolute", top: -60, right: -60, width: 220, height: 220, borderRadius: "50%", background: "rgba(201,162,39,0.06)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 80, right: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(13,148,136,0.08)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -20, left: -40, width: 180, height: 180, borderRadius: "50%", background: "rgba(201,162,39,0.04)", pointerEvents: "none" }} />

        {/* Header bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 32, height: 32, background: GOLD, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Compass size={16} color={NAVY} strokeWidth={2.5} />
            </div>
            <span style={{ color: "#fff", fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: "1.2rem" }}>
              Route<span style={{ color: GOLD }}>Lanka</span>
            </span>
          </div>
          <button
            onClick={() => navigate("routes")}
            style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.8rem", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}
          >
            View Routes
          </button>
        </div>

        {/* Hero content */}
        <div style={{ padding: "40px 24px 0" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(201,162,39,0.15)", borderRadius: 100,
            padding: "5px 12px", marginBottom: 20,
          }}>
            <Sparkles size={12} color={GOLD} />
            <span style={{ color: GOLD, fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.05em" }}>AI-POWERED TRIP PLANNER</span>
          </div>

          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "2.4rem", fontWeight: 900,
            color: "#fff", lineHeight: 1.1,
            marginBottom: 16,
          }}>
            Your Perfect<br />
            Sri Lanka Trip,<br />
            <span style={{ color: GOLD }}>Planned in 60s</span>
          </h1>

          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: 32, maxWidth: 340 }}>
            Enter your budget & trip length. We generate a real day-by-day itinerary with honest cost breakdowns — no hidden fees, no agent markup.
          </p>

          {/* CTA */}
          <button
            onClick={() => navigate("planner")}
            style={{
              background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_LIGHT} 100%)`,
              color: NAVY, fontWeight: 800, fontSize: "1rem",
              border: "none", borderRadius: 14,
              padding: "16px 28px",
              display: "flex", alignItems: "center", gap: 10,
              cursor: "pointer", width: "100%",
              boxShadow: "0 8px 32px rgba(201,162,39,0.35)",
            }}
          >
            <Zap size={18} fill={NAVY} />
            Plan My Sri Lanka Trip
            <ArrowRight size={18} style={{ marginLeft: "auto" }} />
          </button>

          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.75rem", textAlign: "center", marginTop: 12 }}>
            Free · No signup required · Instant results
          </p>
        </div>

        {/* Stats bar */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
          gap: 0, margin: "32px 24px 0",
          background: "rgba(255,255,255,0.06)",
          borderRadius: 16, padding: "16px 0",
          border: "1px solid rgba(255,255,255,0.08)",
        }}>
          {stats.map((s, i) => (
            <div key={i} style={{ textAlign: "center", padding: "0 8px", borderRight: i < 3 ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
              <div style={{ color: GOLD, fontWeight: 800, fontSize: "1.1rem", fontFamily: "'Playfair Display', serif" }}>{s.value}</div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.65rem", marginTop: 2, lineHeight: 1.3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── How It Works ─────────────────────────────── */}
      <div style={{ padding: "36px 24px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ color: NAVY, fontFamily: "'Playfair Display', serif", fontSize: "1.4rem", fontWeight: 800 }}>How It Works</h2>
          <span style={{ color: TEAL, fontSize: "0.78rem", fontWeight: 700 }}>3 simple steps</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {howItWorks.map((h, i) => (
            <div
              key={i}
              style={{
                background: "#fff",
                borderRadius: 16, padding: "18px 20px",
                display: "flex", alignItems: "flex-start", gap: 16,
                boxShadow: "0 2px 12px rgba(11,19,64,0.06)",
                border: "1px solid rgba(11,19,64,0.05)",
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: i === 0 ? "rgba(201,162,39,0.1)" : i === 1 ? "rgba(13,148,136,0.1)" : "rgba(11,19,64,0.06)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem",
              }}>
                {h.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ color: GOLD, fontSize: "0.7rem", fontWeight: 800, fontFamily: "JetBrains Mono, monospace" }}>{h.step}</span>
                  <span style={{ color: NAVY, fontWeight: 700, fontSize: "0.95rem" }}>{h.title}</span>
                </div>
                <p style={{ color: "#6B7280", fontSize: "0.82rem", lineHeight: 1.5, margin: 0 }}>{h.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Popular Routes ────────────────────────────── */}
      <div style={{ padding: "36px 0 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", marginBottom: 16 }}>
          <h2 style={{ color: NAVY, fontFamily: "'Playfair Display', serif", fontSize: "1.4rem", fontWeight: 800 }}>Popular Routes</h2>
          <button
            onClick={() => navigate("routes")}
            style={{ color: TEAL, fontSize: "0.8rem", fontWeight: 700, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
          >
            See all <ChevronRight size={14} />
          </button>
        </div>

        <div style={{ display: "flex", gap: 14, overflowX: "auto", padding: "0 24px 4px", scrollbarWidth: "none" }}>
          {POPULAR_ROUTES.map((route) => (
            <div
              key={route.key}
              onClick={() => navigate("routes")}
              style={{
                minWidth: 240, borderRadius: 20, overflow: "hidden", cursor: "pointer",
                boxShadow: "0 4px 20px rgba(11,19,64,0.15)",
                flexShrink: 0,
              }}
            >
              {/* Card gradient header */}
              <div style={{ background: route.gradient, padding: "20px 18px 16px", position: "relative" }}>
                <div style={{ fontSize: "2rem", marginBottom: 8 }}>{route.image}</div>
                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 4 }}>
                  {route.type.toUpperCase()}
                </p>
                <h3 style={{ color: "#fff", fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: "1.1rem", lineHeight: 1.2, margin: 0 }}>
                  {route.name}
                </h3>
              </div>

              {/* Route cities strip */}
              <div style={{ background: "#fff", padding: "12px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 10, flexWrap: "nowrap", overflowX: "auto" }}>
                  {route.cities.map((city, ci) => (
                    <span key={ci} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ color: NAVY, fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap" }}>{city}</span>
                      {ci < route.cities.length - 1 && (
                        <svg width="16" height="8" viewBox="0 0 16 8" fill="none">
                          <path d="M0 4h12M12 4L9 1.5M12 4L9 6.5" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      )}
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ color: "#6B7280", fontSize: "0.72rem" }}>{route.duration} · </span>
                    <span style={{ color: TEAL, fontWeight: 700, fontSize: "0.8rem" }}>From ${route.fromPrice}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate("planner"); }}
                    style={{
                      background: GOLD, color: NAVY, border: "none",
                      borderRadius: 8, padding: "5px 10px",
                      fontSize: "0.72rem", fontWeight: 700, cursor: "pointer",
                    }}
                  >
                    Plan →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Testimonials ─────────────────────────────── */}
      <div style={{ padding: "36px 24px 0" }}>
        <h2 style={{ color: NAVY, fontFamily: "'Playfair Display', serif", fontSize: "1.4rem", fontWeight: 800, marginBottom: 16 }}>
          Real Travellers
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {testimonials.map((t, i) => (
            <div key={i} style={{ background: "#fff", borderRadius: 16, padding: "18px 20px", boxShadow: "0 2px 12px rgba(11,19,64,0.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: "50%",
                  background: `linear-gradient(135deg, ${NAVY}, ${TEAL})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.1rem",
                }}>
                  {t.flag}
                </div>
                <div>
                  <div style={{ color: NAVY, fontWeight: 700, fontSize: "0.85rem" }}>{t.name}</div>
                  <div style={{ display: "flex", gap: 2 }}>
                    {Array.from({ length: t.rating }).map((_, ri) => (
                      <Star key={ri} size={10} fill={GOLD} color={GOLD} />
                    ))}
                  </div>
                </div>
              </div>
              <p style={{ color: "#4B5563", fontSize: "0.83rem", lineHeight: 1.6, margin: 0 }}>"{t.text}"</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom CTA ────────────────────────────────── */}
      <div style={{ padding: "36px 24px 36px" }}>
        <div style={{
          background: `linear-gradient(135deg, ${NAVY} 0%, #1D3560 100%)`,
          borderRadius: 24, padding: "32px 24px",
          textAlign: "center",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(201,162,39,0.08)" }} />
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🇱🇰</div>
          <h3 style={{ color: "#fff", fontFamily: "'Playfair Display', serif", fontSize: "1.5rem", fontWeight: 800, marginBottom: 10 }}>
            Ready to Explore<br />Sri Lanka?
          </h3>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.85rem", lineHeight: 1.6, marginBottom: 24 }}>
            Join 4,200+ travellers who planned smarter with RouteLanka.
          </p>
          <button
            onClick={() => navigate("planner")}
            style={{
              background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`,
              color: NAVY, fontWeight: 800, fontSize: "0.95rem",
              border: "none", borderRadius: 12,
              padding: "14px 32px", cursor: "pointer",
              width: "100%",
            }}
          >
            Start Planning — It's Free
          </button>
        </div>
      </div>
    </div>
  );
}
