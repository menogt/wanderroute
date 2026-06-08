import { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { ArrowLeft } from "lucide-react";
import type { GeneratedItinerary, Screen } from "./types";
import { CURRENCY_SYMBOLS } from "./data";

const NAVY = "#0B1340";
const GOLD = "#C9A227";
const TEAL = "#0D9488";
const GREEN = "#10B981";

const CATEGORIES = [
  { key: "hotels" as const, label: "Accommodation", emoji: "🏨", color: NAVY },
  { key: "food" as const, label: "Food & Dining", emoji: "🍛", color: GOLD },
  { key: "transport" as const, label: "Transport", emoji: "🚌", color: "#6366F1" },
  { key: "activities" as const, label: "Activities", emoji: "🎯", color: TEAL },
  { key: "entryFees" as const, label: "Entry Fees", emoji: "🎟️", color: "#F59E0B" },
  { key: "misc" as const, label: "Miscellaneous", emoji: "🧾", color: "#8B5CF6" },
];

const SAVINGS_TIPS = [
  { cat: "🏨 Hotels", tip: "Book guesthouses directly instead of OTAs — save 15–25% on most Ella and Kandy properties." },
  { cat: "🚌 Transport", tip: "Local buses cost $0.50–3. The Colombo→Galle express bus is identical comfort to a private car at 5% of the cost." },
  { cat: "🍛 Food", tip: "A full rice & curry plate at a local joint costs $1–2. Tourist restaurants charge $8–15 for the same food." },
  { cat: "🎟️ Entry Fees", tip: "Sigiriya ($30) and Horton Plains ($20) are unavoidable. Budget accordingly. Temple of Tooth is just $6." },
  { cat: "📱 Data", tip: "Dialog/Mobitel SIM with 20GB = ~$5 at the airport. Skip expensive Wi-Fi plans at hotels." },
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: "#fff", borderRadius: 12, padding: "10px 14px", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
        <p style={{ color: NAVY, fontWeight: 700, fontSize: "0.85rem", margin: "0 0 2px" }}>{payload[0].name}</p>
        <p style={{ color: payload[0].payload.color, fontWeight: 800, fontSize: "1rem", margin: 0 }}>
          {payload[0].value}%
        </p>
      </div>
    );
  }
  return null;
};

export function CostBreakdownScreen({
  itinerary,
  navigate,
}: {
  itinerary: GeneratedItinerary;
  navigate: (s: Screen) => void;
}) {
  const [perPerson, setPerPerson] = useState(false);
  const sym = CURRENCY_SYMBOLS[itinerary.currency];
  const { costBreakdown, totalPeople } = itinerary;

  const divisor = perPerson ? totalPeople : 1;

  const total = Object.values(costBreakdown).reduce((s, v) => s + v, 0);
  const pieData = CATEGORIES.map((cat) => ({
    name: cat.label,
    value: Math.round((costBreakdown[cat.key] / total) * 100),
    amount: Math.round(costBreakdown[cat.key] / divisor),
    color: cat.color,
    emoji: cat.emoji,
  }));

  return (
    <div style={{ background: "#EEF2FA", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(160deg, ${NAVY} 0%, #1D2E6B 100%)`, padding: "36px 24px 32px" }}>
        <button
          onClick={() => navigate("itinerary")}
          style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 10, padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, marginBottom: 20 }}
        >
          <ArrowLeft size={16} color="#fff" />
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.8rem" }}>Back to Itinerary</span>
        </button>

        <p style={{ color: GOLD, fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.1em", marginBottom: 8 }}>WHERE YOUR MONEY GOES</p>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "2rem", fontWeight: 900, color: "#fff", lineHeight: 1.15, marginBottom: 16 }}>
          Cost Breakdown
        </h1>

        {/* Per person / Total toggle */}
        <div style={{ display: "flex", background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: 4 }}>
          <button
            onClick={() => setPerPerson(false)}
            style={{
              flex: 1, padding: "9px 0", borderRadius: 9, border: "none", cursor: "pointer",
              fontWeight: 700, fontSize: "0.82rem", transition: "all 0.2s",
              background: !perPerson ? "#fff" : "transparent",
              color: !perPerson ? NAVY : "rgba(255,255,255,0.5)",
            }}
          >
            Total ({sym}{Math.round(total).toLocaleString()})
          </button>
          <button
            onClick={() => setPerPerson(true)}
            style={{
              flex: 1, padding: "9px 0", borderRadius: 9, border: "none", cursor: "pointer",
              fontWeight: 700, fontSize: "0.82rem", transition: "all 0.2s",
              background: perPerson ? "#fff" : "transparent",
              color: perPerson ? NAVY : "rgba(255,255,255,0.5)",
            }}
          >
            Per Person ({sym}{Math.round(total / totalPeople).toLocaleString()})
          </button>
        </div>
      </div>

      <div style={{ padding: "24px" }}>
        {/* Pie chart */}
        <div style={{ background: "#fff", borderRadius: 20, padding: "24px 20px", boxShadow: "0 4px 20px rgba(11,19,64,0.07)", marginBottom: 20 }}>
          <p style={{ color: "#9CA3AF", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 4, textAlign: "center" }}>BUDGET DISTRIBUTION</p>
          <div style={{ position: "relative" }}>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div style={{
              position: "absolute", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              textAlign: "center", pointerEvents: "none",
            }}>
              <p style={{ color: NAVY, fontFamily: "'Playfair Display', serif", fontSize: "1.3rem", fontWeight: 900, margin: 0 }}>
                {sym}{Math.round(total / divisor).toLocaleString()}
              </p>
              <p style={{ color: "#9CA3AF", fontSize: "0.65rem", margin: 0 }}>{perPerson ? "per person" : "total"}</p>
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
            {pieData.map((item) => (
              <div key={item.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: item.color, flexShrink: 0 }} />
                <span style={{ color: "#6B7280", fontSize: "0.72rem" }}>{item.name}</span>
                <span style={{ color: item.color, fontWeight: 700, fontSize: "0.72rem", marginLeft: "auto" }}>{item.value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Category breakdown rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          {CATEGORIES.map((cat) => {
            const amount = Math.round(costBreakdown[cat.key] / divisor);
            const pct = Math.round((costBreakdown[cat.key] / total) * 100);
            return (
              <div
                key={cat.key}
                style={{
                  background: "#fff", borderRadius: 16, padding: "16px 18px",
                  boxShadow: "0 2px 12px rgba(11,19,64,0.05)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: `${cat.color}12`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "1.1rem",
                    }}>
                      {cat.emoji}
                    </div>
                    <div>
                      <p style={{ color: NAVY, fontWeight: 700, fontSize: "0.88rem", margin: "0 0 1px" }}>{cat.label}</p>
                      <p style={{ color: "#9CA3AF", fontSize: "0.72rem", margin: 0 }}>
                        {pct}% of total
                      </p>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ color: NAVY, fontWeight: 800, fontFamily: "'Playfair Display', serif", fontSize: "1.1rem", margin: 0 }}>
                      {sym}{amount.toLocaleString()}
                    </p>
                    {perPerson && (
                      <p style={{ color: "#9CA3AF", fontSize: "0.68rem", margin: 0 }}>
                        {sym}{Math.round(costBreakdown[cat.key]).toLocaleString()} total
                      </p>
                    )}
                  </div>
                </div>
                {/* Progress bar */}
                <div style={{ background: "rgba(11,19,64,0.06)", borderRadius: 100, height: 5, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 100,
                    background: cat.color,
                    width: `${pct}%`, transition: "width 0.6s ease",
                  }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Daily average */}
        <div style={{
          background: `linear-gradient(135deg, ${TEAL}12, ${TEAL}05)`,
          border: `1px solid ${TEAL}20`,
          borderRadius: 16, padding: "16px 18px", marginBottom: 24,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <p style={{ color: "#6B7280", fontSize: "0.75rem", margin: "0 0 2px" }}>Daily average {perPerson ? "per person" : "total"}</p>
            <p style={{ color: NAVY, fontWeight: 800, fontFamily: "'Playfair Display', serif", fontSize: "1.4rem", margin: 0 }}>
              {sym}{Math.round(total / divisor / itinerary.totalDays).toLocaleString()}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ color: "#6B7280", fontSize: "0.75rem", margin: "0 0 2px" }}>Vs. agency average</p>
            <p style={{ color: GREEN, fontWeight: 700, fontSize: "0.9rem", margin: 0 }}>
              Save ~25%
            </p>
          </div>
        </div>

        {/* Savings tips */}
        <div style={{ background: "#fff", borderRadius: 20, padding: "20px", boxShadow: "0 4px 20px rgba(11,19,64,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: "1.1rem" }}>💰</span>
            <h3 style={{ color: NAVY, fontWeight: 800, fontSize: "0.95rem", margin: 0 }}>Cost-Cutting Playbook</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {SAVINGS_TIPS.map((tip, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{
                  background: `${GOLD}15`, borderRadius: 8, padding: "4px 8px",
                  fontSize: "0.75rem", fontWeight: 700, color: "#92400E", flexShrink: 0,
                }}>
                  {tip.cat}
                </div>
                <p style={{ color: "#4B5563", fontSize: "0.78rem", lineHeight: 1.5, margin: 0 }}>{tip.tip}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}
