import { useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, Zap, Check } from "lucide-react";
import type { TripInputs, Interest, TravelStyle, Currency, Screen } from "./types";
import { CURRENCY_SYMBOLS } from "./data";

const NAVY = "#0B1340";
const GOLD = "#C9A227";
const TEAL = "#0D9488";

// ─── Config ──────────────────────────────────────────────────────────────────
const CURRENCIES: Currency[] = ["USD", "EUR", "GBP", "AUD", "LKR"];
const START_CITIES = ["Colombo", "Kandy", "Negombo", "Galle", "Sigiriya", "Ella"];
const CITY_EMOJIS: Record<string, string> = {
  Colombo: "🏙️", Kandy: "🌿", Negombo: "🎣", Galle: "🏰", Sigiriya: "🏰", Ella: "🏔️",
};
const INTERESTS: { key: Interest; label: string; emoji: string }[] = [
  { key: "beaches", label: "Beaches", emoji: "🏖️" },
  { key: "culture", label: "Culture", emoji: "🏛️" },
  { key: "wildlife", label: "Wildlife", emoji: "🐘" },
  { key: "hiking", label: "Hiking", emoji: "🥾" },
  { key: "food", label: "Food & Spice", emoji: "🌶️" },
  { key: "temples", label: "Temples", emoji: "🕌" },
  { key: "adventure", label: "Adventure", emoji: "🪂" },
  { key: "photography", label: "Photography", emoji: "📸" },
];
const STYLES: { key: TravelStyle; label: string; emoji: string; desc: string; range: string }[] = [
  { key: "budget", label: "Budget Explorer", emoji: "🎒", desc: "Hostels, local buses, street food", range: "$30–55/day" },
  { key: "comfort", label: "Comfort Traveller", emoji: "✨", desc: "Boutique hotels, mix of local & tourist dining", range: "$85–170/day" },
  { key: "luxury", label: "Luxury Escape", emoji: "👑", desc: "Resorts, private transfers, fine dining", range: "$250–500/day" },
];
const DAY_OPTIONS = [4, 5, 6, 7, 8, 9, 10, 12, 14];

const STEPS = [
  "Budget & Currency",
  "Trip Length",
  "Starting City",
  "Your Interests",
  "Travel Style",
];

// ─── Component ───────────────────────────────────────────────────────────────
export function PlannerScreen({
  onGenerate,
  navigate,
}: {
  onGenerate: (inputs: TripInputs) => void;
  navigate: (s: Screen) => void;
}) {
  const [step, setStep] = useState(0);
  const [budget, setBudget] = useState(800);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [days, setDays] = useState(7);
  const [people, setPeople] = useState(2);
  const [startCity, setStartCity] = useState("Colombo");
  const [interests, setInterests] = useState<Interest[]>(["beaches", "culture"]);
  const [travelStyle, setTravelStyle] = useState<TravelStyle>("comfort");
  const [generating, setGenerating] = useState(false);

  const sym = CURRENCY_SYMBOLS[currency];

  const toggleInterest = (i: Interest) => {
    setInterests((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
    );
  };

  const canNext = () => {
    if (step === 0) return budget > 0;
    if (step === 2) return !!startCity;
    if (step === 3) return interests.length > 0;
    return true;
  };

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      onGenerate({ budget, currency, days, people, startCity, interests, travelStyle });
      setGenerating(false);
    }, 1600);
  };

  return (
    <div style={{ background: "#EEF2FA", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(160deg, ${NAVY} 0%, #1D3560 100%)`, padding: "20px 24px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button
            onClick={() => step === 0 ? navigate("home") : setStep(step - 1)}
            style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 10, padding: "8px", cursor: "pointer", display: "flex" }}
          >
            <ChevronLeft size={18} color="#fff" />
          </button>
          <div style={{ flex: 1 }}>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 2 }}>
              STEP {step + 1} OF {STEPS.length}
            </p>
            <p style={{ color: "#fff", fontWeight: 700, fontSize: "0.95rem" }}>{STEPS[step]}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 100, height: 4 }}>
          <div style={{
            height: "100%", borderRadius: 100,
            background: `linear-gradient(90deg, ${GOLD}, #E8C547)`,
            width: `${((step + 1) / STEPS.length) * 100}%`,
            transition: "width 0.4s ease",
          }} />
        </div>
      </div>

      {/* Step content */}
      <div style={{ flex: 1, padding: "28px 24px" }}>

        {/* ── STEP 0: Budget & Currency ── */}
        {step === 0 && (
          <div>
            <h2 style={{ color: NAVY, fontFamily: "'Playfair Display', serif", fontSize: "1.6rem", fontWeight: 800, marginBottom: 6 }}>
              What's your total budget?
            </h2>
            <p style={{ color: "#6B7280", fontSize: "0.85rem", lineHeight: 1.6, marginBottom: 28 }}>
              Enter the total you want to spend across your entire trip — including hotels, food, transport & activities.
            </p>

            {/* Currency selector */}
            <p style={{ color: NAVY, fontWeight: 700, fontSize: "0.8rem", marginBottom: 10 }}>Currency</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
              {CURRENCIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  style={{
                    padding: "8px 12px", borderRadius: 10, border: "none", cursor: "pointer",
                    fontWeight: 700, fontSize: "0.78rem",
                    background: currency === c ? NAVY : "#fff",
                    color: currency === c ? "#fff" : "#6B7280",
                    boxShadow: currency === c ? "0 4px 12px rgba(11,19,64,0.2)" : "0 1px 4px rgba(0,0,0,0.06)",
                    transition: "all 0.2s",
                  }}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* Budget input */}
            <p style={{ color: NAVY, fontWeight: 700, fontSize: "0.8rem", marginBottom: 10 }}>Total Budget</p>
            <div style={{
              background: "#fff", borderRadius: 16, padding: "20px",
              boxShadow: "0 4px 20px rgba(11,19,64,0.07)", marginBottom: 20,
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <span style={{ color: GOLD, fontFamily: "'Playfair Display', serif", fontSize: "1.8rem", fontWeight: 900, flexShrink: 0 }}>{sym}</span>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(Math.max(0, Number(e.target.value)))}
                style={{
                  flex: 1, border: "none", outline: "none", background: "transparent",
                  color: NAVY, fontFamily: "'Playfair Display', serif",
                  fontSize: "2rem", fontWeight: 900,
                }}
              />
            </div>

            {/* Budget presets */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[400, 800, 1500, 2500, 4000, 8000].map((v) => (
                <button
                  key={v}
                  onClick={() => setBudget(v)}
                  style={{
                    padding: "10px 0", borderRadius: 12, border: "none", cursor: "pointer",
                    fontWeight: 700, fontSize: "0.8rem",
                    background: budget === v ? GOLD : "#fff",
                    color: budget === v ? NAVY : "#6B7280",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  }}
                >
                  {sym}{v.toLocaleString()}
                </button>
              ))}
            </div>

            <div style={{ background: "rgba(13,148,136,0.08)", borderRadius: 12, padding: "12px 16px", marginTop: 20 }}>
              <p style={{ color: "#0D9488", fontSize: "0.78rem", lineHeight: 1.6, margin: 0 }}>
                💡 For a 7-day budget trip for 2 people: ~{sym}{currency === "USD" ? "560" : currency === "LKR" ? "179,200" : "520"}. Comfort: ~{sym}{currency === "USD" ? "1,400" : currency === "LKR" ? "448,000" : "1,300"}.
              </p>
            </div>
          </div>
        )}

        {/* ── STEP 1: Trip Length ── */}
        {step === 1 && (
          <div>
            <h2 style={{ color: NAVY, fontFamily: "'Playfair Display', serif", fontSize: "1.6rem", fontWeight: 800, marginBottom: 6 }}>
              How long is your trip?
            </h2>
            <p style={{ color: "#6B7280", fontSize: "0.85rem", lineHeight: 1.6, marginBottom: 28 }}>
              Sri Lanka is best explored over 7–10 days. Rushing it means missing the magic.
            </p>

            {/* Days selector */}
            <p style={{ color: NAVY, fontWeight: 700, fontSize: "0.8rem", marginBottom: 12 }}>Trip Duration</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 28 }}>
              {DAY_OPTIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  style={{
                    padding: "14px 0", borderRadius: 14, border: "none", cursor: "pointer",
                    fontWeight: 700, fontSize: "0.9rem",
                    background: days === d ? NAVY : "#fff",
                    color: days === d ? "#fff" : NAVY,
                    boxShadow: days === d ? "0 4px 16px rgba(11,19,64,0.2)" : "0 1px 4px rgba(0,0,0,0.06)",
                    transition: "all 0.2s",
                    position: "relative",
                  }}
                >
                  {d}
                  {days === d && (
                    <span style={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", color: GOLD, fontSize: "0.6rem" }}>days</span>
                  )}
                </button>
              ))}
            </div>

            {/* People selector */}
            <p style={{ color: NAVY, fontWeight: 700, fontSize: "0.8rem", marginBottom: 12 }}>Number of Travellers</p>
            <div style={{
              background: "#fff", borderRadius: 16, padding: "16px 20px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              boxShadow: "0 4px 20px rgba(11,19,64,0.07)",
            }}>
              <button
                onClick={() => setPeople(Math.max(1, people - 1))}
                style={{
                  width: 40, height: 40, borderRadius: 10, border: `2px solid ${NAVY}15`,
                  background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <Minus size={16} color={NAVY} />
              </button>
              <div style={{ textAlign: "center" }}>
                <span style={{ color: NAVY, fontFamily: "'Playfair Display', serif", fontSize: "2.4rem", fontWeight: 900 }}>{people}</span>
                <p style={{ color: "#6B7280", fontSize: "0.75rem", margin: 0 }}>{people === 1 ? "person" : "people"}</p>
              </div>
              <button
                onClick={() => setPeople(Math.min(12, people + 1))}
                style={{
                  width: 40, height: 40, borderRadius: 10, border: "none",
                  background: NAVY, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <Plus size={16} color="#fff" />
              </button>
            </div>

            <div style={{ background: "rgba(201,162,39,0.08)", borderRadius: 12, padding: "12px 16px", marginTop: 20 }}>
              <p style={{ color: "#92400E", fontSize: "0.78rem", lineHeight: 1.6, margin: 0 }}>
                ✈️ Recommended: <strong>7 days</strong> for first-timers. Add 2–3 days if you want beach time in Mirissa.
              </p>
            </div>
          </div>
        )}

        {/* ── STEP 2: Start City ── */}
        {step === 2 && (
          <div>
            <h2 style={{ color: NAVY, fontFamily: "'Playfair Display', serif", fontSize: "1.6rem", fontWeight: 800, marginBottom: 6 }}>
              Where do you start?
            </h2>
            <p style={{ color: "#6B7280", fontSize: "0.85rem", lineHeight: 1.6, marginBottom: 28 }}>
              Most international flights land in Colombo (BIA). Your starting city shapes the entire route.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {START_CITIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setStartCity(c)}
                  style={{
                    padding: "18px 16px", borderRadius: 16, border: "none", cursor: "pointer",
                    textAlign: "left",
                    background: startCity === c
                      ? `linear-gradient(135deg, ${NAVY}, #1D3560)`
                      : "#fff",
                    boxShadow: startCity === c
                      ? "0 4px 20px rgba(11,19,64,0.25)"
                      : "0 2px 10px rgba(11,19,64,0.06)",
                    transition: "all 0.2s",
                    position: "relative",
                  }}
                >
                  {startCity === c && (
                    <div style={{
                      position: "absolute", top: 10, right: 10,
                      width: 20, height: 20, borderRadius: "50%",
                      background: GOLD, display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Check size={11} color={NAVY} strokeWidth={3} />
                    </div>
                  )}
                  <div style={{ fontSize: "1.6rem", marginBottom: 8 }}>{CITY_EMOJIS[c]}</div>
                  <div style={{ color: startCity === c ? "#fff" : NAVY, fontWeight: 700, fontSize: "0.9rem", marginBottom: 2 }}>{c}</div>
                  {c === "Colombo" && (
                    <div style={{ color: startCity === c ? GOLD : TEAL, fontSize: "0.68rem", fontWeight: 600 }}>✈ Main airport</div>
                  )}
                  {c === "Negombo" && (
                    <div style={{ color: startCity === c ? GOLD : TEAL, fontSize: "0.68rem", fontWeight: 600 }}>Near BIA airport</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 3: Interests ── */}
        {step === 3 && (
          <div>
            <h2 style={{ color: NAVY, fontFamily: "'Playfair Display', serif", fontSize: "1.6rem", fontWeight: 800, marginBottom: 6 }}>
              What do you love?
            </h2>
            <p style={{ color: "#6B7280", fontSize: "0.85rem", lineHeight: 1.6, marginBottom: 28 }}>
              Select all that apply. We'll prioritise activities and destinations that match your style.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {INTERESTS.map(({ key, label, emoji }) => {
                const selected = interests.includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleInterest(key)}
                    style={{
                      padding: "16px 14px", borderRadius: 16, border: "none", cursor: "pointer",
                      textAlign: "left",
                      background: selected ? `linear-gradient(135deg, ${GOLD}20, ${GOLD}10)` : "#fff",
                      boxShadow: selected ? `0 4px 16px ${GOLD}30` : "0 2px 8px rgba(11,19,64,0.05)",
                      outline: selected ? `2px solid ${GOLD}` : "2px solid transparent",
                      transition: "all 0.2s",
                      position: "relative",
                    }}
                  >
                    {selected && (
                      <div style={{
                        position: "absolute", top: 8, right: 8,
                        width: 18, height: 18, borderRadius: "50%",
                        background: GOLD, display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Check size={10} color={NAVY} strokeWidth={3} />
                      </div>
                    )}
                    <div style={{ fontSize: "1.4rem", marginBottom: 6 }}>{emoji}</div>
                    <div style={{ color: NAVY, fontWeight: 700, fontSize: "0.85rem" }}>{label}</div>
                  </button>
                );
              })}
            </div>

            {interests.length === 0 && (
              <p style={{ color: "#EF4444", fontSize: "0.8rem", textAlign: "center", marginTop: 16 }}>
                Please select at least one interest
              </p>
            )}
          </div>
        )}

        {/* ── STEP 4: Travel Style ── */}
        {step === 4 && (
          <div>
            <h2 style={{ color: NAVY, fontFamily: "'Playfair Display', serif", fontSize: "1.6rem", fontWeight: 800, marginBottom: 6 }}>
              How do you travel?
            </h2>
            <p style={{ color: "#6B7280", fontSize: "0.85rem", lineHeight: 1.6, marginBottom: 28 }}>
              This shapes your accommodation picks, dining style, and transport choices.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {STYLES.map(({ key, label, emoji, desc, range }) => {
                const selected = travelStyle === key;
                const accentColors: Record<string, string> = { budget: TEAL, comfort: GOLD, luxury: "#8B5CF6" };
                const accent = accentColors[key];
                return (
                  <button
                    key={key}
                    onClick={() => setTravelStyle(key)}
                    style={{
                      padding: "20px", borderRadius: 18, border: "none", cursor: "pointer",
                      textAlign: "left",
                      background: selected ? "#fff" : "#fff",
                      boxShadow: selected ? `0 6px 24px ${accent}25` : "0 2px 10px rgba(11,19,64,0.05)",
                      outline: selected ? `2px solid ${accent}` : "2px solid transparent",
                      transition: "all 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{
                        width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                        background: selected ? `${accent}15` : "rgba(11,19,64,0.04)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.6rem",
                      }}>
                        {emoji}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <span style={{ color: NAVY, fontWeight: 800, fontSize: "0.95rem" }}>{label}</span>
                          <span style={{
                            background: selected ? accent : "rgba(11,19,64,0.05)",
                            color: selected ? (key === "comfort" ? NAVY : "#fff") : "#6B7280",
                            borderRadius: 100, padding: "3px 8px",
                            fontSize: "0.68rem", fontWeight: 700,
                          }}>
                            {range}
                          </span>
                        </div>
                        <p style={{ color: "#6B7280", fontSize: "0.8rem", margin: 0 }}>{desc}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Summary */}
            <div style={{
              background: `linear-gradient(135deg, ${NAVY}, #1D3560)`,
              borderRadius: 16, padding: "18px 20px", marginTop: 24,
            }}>
              <p style={{ color: GOLD, fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.06em", marginBottom: 10 }}>YOUR TRIP SUMMARY</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: "Budget", val: `${CURRENCY_SYMBOLS[currency]}${budget.toLocaleString()}` },
                  { label: "Duration", val: `${days} days` },
                  { label: "Travellers", val: `${people} ${people === 1 ? "person" : "people"}` },
                  { label: "Starting", val: startCity },
                ].map(({ label, val }) => (
                  <div key={label}>
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.7rem", margin: "0 0 2px" }}>{label}</p>
                    <p style={{ color: "#fff", fontWeight: 700, fontSize: "0.9rem", margin: 0 }}>{val}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div style={{ padding: "0 24px 32px", display: "flex", gap: 12 }}>
        {step > 0 && (
          <button
            onClick={() => setStep(step - 1)}
            style={{
              padding: "16px", borderRadius: 14, border: "1px solid rgba(11,19,64,0.1)",
              background: "#fff", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <ChevronLeft size={20} color={NAVY} />
          </button>
        )}

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => canNext() && setStep(step + 1)}
            disabled={!canNext()}
            style={{
              flex: 1, padding: "16px", borderRadius: 14, border: "none", cursor: canNext() ? "pointer" : "not-allowed",
              background: canNext() ? `linear-gradient(135deg, ${NAVY}, #1D3560)` : "rgba(11,19,64,0.1)",
              color: canNext() ? "#fff" : "#9CA3AF",
              fontWeight: 700, fontSize: "0.95rem",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            Continue
            <ChevronRight size={18} />
          </button>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              flex: 1, padding: "16px", borderRadius: 14, border: "none",
              cursor: generating ? "wait" : "pointer",
              background: generating ? GOLD + "80" : `linear-gradient(135deg, ${GOLD}, #E8C547)`,
              color: NAVY, fontWeight: 800, fontSize: "1rem",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              boxShadow: generating ? "none" : "0 8px 24px rgba(201,162,39,0.4)",
            }}
          >
            {generating ? (
              <>
                <div style={{
                  width: 18, height: 18, borderRadius: "50%",
                  border: `2px solid ${NAVY}40`, borderTopColor: NAVY,
                  animation: "spin 0.8s linear infinite",
                }} />
                Generating Your Trip...
              </>
            ) : (
              <>
                <Zap size={18} fill={NAVY} />
                Generate My Itinerary
              </>
            )}
          </button>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
