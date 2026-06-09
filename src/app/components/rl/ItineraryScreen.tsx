import { useState } from "react";
import {
  ChevronDown, ChevronUp, ArrowRight, Share2, BarChart2,
  AlertTriangle, Lightbulb, MapPin, Calendar, Users, Wallet, Download
} from "lucide-react";
import type { GeneratedItinerary, DayPlan, Screen } from "./types";
import { CURRENCY_SYMBOLS } from "./data";
import { downloadItineraryPDF } from "./generatePDF";

const NAVY = "#0B1340";
const GOLD = "#C9A227";
const TEAL = "#0D9488";
const RED = "#EF4444";
const GREEN = "#10B981";

const CATEGORY_ICONS: Record<string, string> = {
  transport: "🚌",
  activity: "🎯",
  meal: "🍽️",
  accommodation: "🏨",
};
const CATEGORY_COLORS: Record<string, string> = {
  transport: "#6366F1",
  activity: TEAL,
  meal: "#F59E0B",
  accommodation: NAVY,
};

function BudgetMeter({
  used, total, sym,
}: { used: number; total: number; sym: string }) {
  const pct = Math.min(100, (used / total) * 100);
  const over = used > total;
  const barColor = over ? RED : pct > 85 ? "#F59E0B" : GREEN;

  return (
    <div style={{ background: "#fff", borderRadius: 20, padding: "20px", boxShadow: "0 4px 20px rgba(11,19,64,0.08)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <p style={{ color: "#6B7280", fontSize: "0.75rem", fontWeight: 600, marginBottom: 4 }}>ESTIMATED TOTAL COST</p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{
              fontFamily: "'Playfair Display', serif", fontSize: "2rem", fontWeight: 900,
              color: over ? RED : NAVY,
            }}>
              {sym}{used.toLocaleString()}
            </span>
            <span style={{ color: "#9CA3AF", fontSize: "0.85rem" }}>/ {sym}{total.toLocaleString()}</span>
          </div>
        </div>
        <div style={{
          background: over ? `${RED}15` : pct > 85 ? "#FEF3C7" : `${GREEN}15`,
          borderRadius: 12, padding: "6px 12px",
          textAlign: "center",
        }}>
          <p style={{ color: over ? RED : pct > 85 ? "#92400E" : GREEN, fontWeight: 800, fontSize: "0.85rem", margin: 0 }}>
            {over ? "Over budget" : `${sym}${(total - used).toLocaleString()} left`}
          </p>
        </div>
      </div>

      <div style={{ background: "rgba(11,19,64,0.06)", borderRadius: 100, height: 8, overflow: "hidden", marginBottom: 10 }}>
        <div style={{
          height: "100%", borderRadius: 100,
          background: `linear-gradient(90deg, ${barColor}, ${barColor}CC)`,
          width: `${pct}%`, transition: "width 0.8s ease",
        }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "#6B7280", fontSize: "0.72rem" }}>{Math.round(pct)}% of budget used</span>
        <span style={{ color: "#6B7280", fontSize: "0.72rem" }}>
          {over ? "💸 Consider adjusting" : pct < 70 ? "🎉 Great value!" : "⚠️ Getting close"}
        </span>
      </div>
    </div>
  );
}

function RouteFlow({ cities }: { cities: string[] }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 20, padding: "18px 20px",
      boxShadow: "0 4px 20px rgba(11,19,64,0.06)",
    }}>
      <p style={{ color: "#9CA3AF", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 14 }}>YOUR ROUTE</p>
      <div style={{ display: "flex", alignItems: "center", gap: 0, flexWrap: "nowrap", overflowX: "auto" }}>
        {cities.map((city, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ textAlign: "center", minWidth: 52 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%", margin: "0 auto 6px",
                background: i === 0
                  ? `linear-gradient(135deg, ${GOLD}, #E8C547)`
                  : i === cities.length - 1
                  ? `linear-gradient(135deg, ${TEAL}, #14B8A6)`
                  : `linear-gradient(135deg, ${NAVY}, #1D3560)`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <MapPin size={14} color="#fff" />
              </div>
              <span style={{ color: NAVY, fontSize: "0.68rem", fontWeight: 700, whiteSpace: "nowrap" }}>{city}</span>
              {i === 0 && <div style={{ color: GOLD, fontSize: "0.6rem" }}>Start</div>}
              {i === cities.length - 1 && <div style={{ color: TEAL, fontSize: "0.6rem" }}>End</div>}
            </div>
            {i < cities.length - 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 3, padding: "0 4px", marginBottom: 20 }}>
                <div style={{ width: 16, height: 1.5, background: `${GOLD}60`, borderRadius: 1 }} />
                <ArrowRight size={10} color={GOLD} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DayCard({ day, sym }: { day: DayPlan; sym: string }) {
  const [expanded, setExpanded] = useState(day.day <= 2);
  return (
    <div style={{
      background: "#fff", borderRadius: 20,
      boxShadow: "0 4px 20px rgba(11,19,64,0.06)",
      overflow: "hidden", border: "1px solid rgba(11,19,64,0.04)",
    }}>
      {/* City gradient header */}
      <div
        style={{ background: day.heroGradient, padding: "16px 20px", cursor: "pointer", position: "relative" }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ position: "absolute", top: -10, right: -10, width: 60, height: 60, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "rgba(201,162,39,0.2)", border: "1px solid rgba(201,162,39,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ color: GOLD, fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: "0.9rem" }}>
                {day.day}
              </span>
            </div>
            <div>
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.05em" }}>DAY {day.day}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: "0.9rem" }}>{day.flag}</span>
                <h3 style={{ color: "#fff", fontWeight: 800, fontSize: "1rem", margin: 0 }}>{day.city}</h3>
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.65rem", margin: "0 0 2px" }}>per person</p>
            <p style={{ color: GOLD, fontWeight: 800, fontFamily: "'Playfair Display', serif", fontSize: "1.1rem", margin: 0 }}>
              {sym}{day.dailyCostPerPerson.toLocaleString()}
            </p>
            <div style={{ marginTop: 4 }}>
              {expanded ? <ChevronUp size={14} color="rgba(255,255,255,0.5)" /> : <ChevronDown size={14} color="rgba(255,255,255,0.5)" />}
            </div>
          </div>
        </div>
      </div>

      {/* Day items */}
      {expanded && (
        <div style={{ padding: "4px 0 8px" }}>
          {day.items.map((item, i) => (
            <div
              key={i}
              style={{
                padding: "12px 20px",
                borderBottom: i < day.items.length - 1 ? "1px solid rgba(11,19,64,0.04)" : "none",
              }}
            >
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                {/* Time */}
                <div style={{ minWidth: 44, flexShrink: 0 }}>
                  <span style={{ color: "#9CA3AF", fontSize: "0.68rem", fontFamily: "JetBrains Mono, monospace" }}>{item.time}</span>
                </div>

                {/* Icon circle */}
                <div style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  background: `${CATEGORY_COLORS[item.category]}12`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1rem",
                }}>
                  {item.icon}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                        <p style={{ color: NAVY, fontWeight: 700, fontSize: "0.85rem", margin: 0 }}>{item.label}</p>
                        {item.isHidden && (
                          <span style={{
                            background: `${TEAL}15`, color: TEAL,
                            borderRadius: 100, padding: "1px 6px", fontSize: "0.6rem", fontWeight: 700,
                          }}>
                            HIDDEN GEM
                          </span>
                        )}
                      </div>
                      <p style={{ color: "#6B7280", fontSize: "0.75rem", margin: 0, lineHeight: 1.4 }}>{item.detail}</p>
                    </div>
                    {item.cost > 0 && (
                      <span style={{
                        color: NAVY, fontWeight: 700, fontSize: "0.82rem",
                        fontFamily: "JetBrains Mono, monospace", flexShrink: 0,
                      }}>
                        {sym}{item.cost}
                      </span>
                    )}
                    {item.cost === 0 && (
                      <span style={{
                        background: `${GREEN}15`, color: GREEN,
                        borderRadius: 100, padding: "2px 8px", fontSize: "0.68rem", fontWeight: 700,
                        flexShrink: 0,
                      }}>
                        FREE
                      </span>
                    )}
                  </div>

                  {/* Tip */}
                  {item.tip && (
                    <div style={{
                      background: "rgba(201,162,39,0.08)", borderRadius: 8,
                      padding: "8px 10px", marginTop: 8,
                      display: "flex", gap: 6, alignItems: "flex-start",
                    }}>
                      <span style={{ fontSize: "0.8rem", flexShrink: 0 }}>💡</span>
                      <p style={{ color: "#92400E", fontSize: "0.72rem", lineHeight: 1.5, margin: 0 }}>{item.tip}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Local tip */}
          <div style={{
            margin: "8px 16px 8px",
            background: `linear-gradient(135deg, ${TEAL}08, ${TEAL}04)`,
            border: `1px solid ${TEAL}20`,
            borderRadius: 12, padding: "12px 14px",
            display: "flex", gap: 8, alignItems: "flex-start",
          }}>
            <Lightbulb size={14} color={TEAL} style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ color: "#0D6B60", fontSize: "0.75rem", lineHeight: 1.5, margin: 0 }}>
              <strong>Local tip:</strong> {day.localTip}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function ItineraryScreen({
  itinerary,
  navigate,
}: {
  itinerary: GeneratedItinerary;
  navigate: (s: Screen) => void;
}) {
  const sym = CURRENCY_SYMBOLS[itinerary.currency];
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleDownloadPDF = async () => {
    setPdfLoading(true);
    try {
      await downloadItineraryPDF(itinerary);
    } finally {
      setPdfLoading(false);
    }
  };

  const statusConfig = {
    great: { color: GREEN, label: "Great value!", bg: `${GREEN}12` },
    ok: { color: TEAL, label: "On budget", bg: `${TEAL}12` },
    tight: { color: "#F59E0B", label: "Tight budget", bg: "#FEF3C7" },
    over: { color: RED, label: "Over budget", bg: `${RED}10` },
  }[itinerary.budgetStatus];

  return (
    <div style={{ background: "#EEF2FA", minHeight: "100vh" }}>
      {/* ── Hero header ─────────────────────────────── */}
      <div style={{ background: `linear-gradient(160deg, ${NAVY} 0%, #1D2E6B 50%, #0B3D3A 100%)`, padding: "36px 24px 32px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", background: "rgba(201,162,39,0.06)" }} />
        <div style={{ position: "absolute", bottom: -20, left: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(13,148,136,0.08)" }} />

        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(201,162,39,0.15)", borderRadius: 100, padding: "4px 12px", marginBottom: 16 }}>
          <span style={{ color: GOLD, fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.06em" }}>✨ YOUR ITINERARY IS READY</span>
        </div>

        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.9rem", fontWeight: 900, color: "#fff", lineHeight: 1.15, marginBottom: 6 }}>
          {itinerary.routeName}
        </h1>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.82rem", lineHeight: 1.5, marginBottom: 20 }}>
          {itinerary.routeSlogan}
        </p>

        {/* Trip meta pills */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {[
            { icon: <Calendar size={11} />, label: `${itinerary.totalDays} days` },
            { icon: <Users size={11} />, label: `${itinerary.totalPeople} ${itinerary.totalPeople === 1 ? "person" : "people"}` },
            { icon: <Wallet size={11} />, label: itinerary.travelStyle.charAt(0).toUpperCase() + itinerary.travelStyle.slice(1) },
          ].map(({ icon, label }) => (
            <div key={label} style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "rgba(255,255,255,0.1)", borderRadius: 100,
              padding: "5px 12px",
            }}>
              <span style={{ color: "rgba(255,255,255,0.6)" }}>{icon}</span>
              <span style={{ color: "#fff", fontSize: "0.75rem", fontWeight: 600 }}>{label}</span>
            </div>
          ))}
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            background: statusConfig.bg, borderRadius: 100, padding: "5px 12px",
          }}>
            <span style={{ color: statusConfig.color, fontSize: "0.75rem", fontWeight: 700 }}>
              {statusConfig.label}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => navigate("costs")}
            style={{
              flex: 1, padding: "12px 16px", borderRadius: 12, border: "none", cursor: "pointer",
              background: `linear-gradient(135deg, ${GOLD}, #E8C547)`,
              color: NAVY, fontWeight: 700, fontSize: "0.82rem",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <BarChart2 size={14} />
            Cost Breakdown
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={pdfLoading}
            style={{
              padding: "12px 16px", borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.15)",
              background: pdfLoading ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)",
              cursor: pdfLoading ? "not-allowed" : "pointer",
              color: "#fff", fontWeight: 700, fontSize: "0.82rem",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              transition: "all 0.2s",
            }}
          >
            <Download size={14} />
            {pdfLoading ? "..." : "PDF"}
          </button>
          <button
            onClick={() => navigate("share")}
            style={{
              padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.08)", cursor: "pointer",
              color: "#fff", fontWeight: 700, fontSize: "0.82rem",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <Share2 size={14} />
            Share
          </button>
        </div>
      </div>

      <div style={{ padding: "24px" }}>
        {/* Budget meter */}
        <BudgetMeter
          used={itinerary.estimatedTotalCost}
          total={itinerary.inputBudget}
          sym={sym}
        />

        {/* Per person cost */}
        <div style={{
          background: `linear-gradient(135deg, ${TEAL}15, ${TEAL}05)`,
          border: `1px solid ${TEAL}25`,
          borderRadius: 14, padding: "14px 18px", marginTop: 12,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <p style={{ color: "#6B7280", fontSize: "0.72rem", fontWeight: 600, margin: "0 0 2px" }}>PER PERSON</p>
            <p style={{ color: NAVY, fontWeight: 800, fontFamily: "'Playfair Display', serif", fontSize: "1.3rem", margin: 0 }}>
              {sym}{itinerary.estimatedCostPerPerson.toLocaleString()}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ color: "#6B7280", fontSize: "0.72rem", fontWeight: 600, margin: "0 0 2px" }}>PER DAY / PERSON</p>
            <p style={{ color: TEAL, fontWeight: 700, fontSize: "1rem", margin: 0 }}>
              {sym}{Math.round(itinerary.estimatedCostPerPerson / itinerary.totalDays).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Route visualization */}
        <div style={{ marginTop: 16 }}>
          <RouteFlow cities={itinerary.cities} />
        </div>

        {/* Highlights */}
        <div style={{ background: "#fff", borderRadius: 20, padding: "18px 20px", marginTop: 16, boxShadow: "0 4px 16px rgba(11,19,64,0.05)" }}>
          <p style={{ color: "#9CA3AF", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 12 }}>TRIP HIGHLIGHTS</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {itinerary.highlights.map((h, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: GOLD, flexShrink: 0 }} />
                <span style={{ color: "#4B5563", fontSize: "0.82rem" }}>{h}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Warnings */}
        {itinerary.warnings.length > 0 && (
          <div style={{
            background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)",
            borderRadius: 16, padding: "16px 18px", marginTop: 16,
          }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
              <AlertTriangle size={15} color={RED} />
              <p style={{ color: RED, fontWeight: 700, fontSize: "0.82rem", margin: 0 }}>Watch Out For</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {itinerary.warnings.map((w, i) => (
                <p key={i} style={{ color: "#6B7280", fontSize: "0.78rem", lineHeight: 1.5, margin: 0 }}>{w}</p>
              ))}
            </div>
          </div>
        )}

        {/* Section header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "28px 0 16px" }}>
          <h2 style={{ color: NAVY, fontFamily: "'Playfair Display', serif", fontSize: "1.4rem", fontWeight: 800 }}>
            Day by Day
          </h2>
          <span style={{ color: "#9CA3AF", fontSize: "0.75rem" }}>{itinerary.totalDays} days</span>
        </div>

        {/* Day cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {itinerary.days.map((day) => (
            <DayCard key={day.day} day={day} sym={sym} />
          ))}
        </div>

        {/* Global budget tips */}
        <div style={{
          background: `linear-gradient(135deg, ${NAVY}, #1D3560)`,
          borderRadius: 20, padding: "22px 20px", marginTop: 24,
        }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
            <Lightbulb size={16} color={GOLD} />
            <p style={{ color: GOLD, fontWeight: 800, fontSize: "0.88rem", margin: 0 }}>Money-Saving Tips</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {itinerary.globalTips.map((tip, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{
                  width: 20, height: 20, borderRadius: 6, background: "rgba(201,162,39,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1,
                }}>
                  <span style={{ color: GOLD, fontSize: "0.65rem", fontWeight: 800 }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.78rem", lineHeight: 1.6, margin: 0 }}>{tip}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <button
            onClick={() => navigate("hotels")}
            style={{
              flex: 1, padding: "14px 16px", borderRadius: 14,
              background: "#fff", border: "1px solid rgba(11,19,64,0.08)",
              color: NAVY, fontWeight: 700, fontSize: "0.85rem", cursor: "pointer",
            }}
          >
            🏨 View Hotels
          </button>
          <button
            onClick={() => navigate("share")}
            style={{
              flex: 1, padding: "14px 16px", borderRadius: 14,
              background: `linear-gradient(135deg, ${GOLD}, #E8C547)`,
              border: "none", color: NAVY, fontWeight: 700, fontSize: "0.85rem", cursor: "pointer",
            }}
          >
            📤 Share Trip
          </button>
        </div>

        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}
