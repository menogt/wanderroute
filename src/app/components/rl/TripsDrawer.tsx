import { useState, useEffect } from "react";
import { X, Trash2, MapPin, Calendar, Users, Wallet, Clock } from "lucide-react";
import type { GeneratedItinerary } from "./types";
import { getSavedTrips, deleteTrip, clearAllTrips, formatSavedDate } from "./tripStorage";
import { CURRENCY_SYMBOLS } from "./data";

const NAVY = "#0B1340";
const GOLD = "#C9A227";
const TEAL = "#0D9488";

export function TripsDrawer({
  isOpen,
  onClose,
  onSelectTrip,
  currentTripId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectTrip: (trip: GeneratedItinerary) => void;
  currentTripId: string | null;
}) {
  const [trips, setTrips] = useState<GeneratedItinerary[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);

  // Reload trips whenever drawer opens
  useEffect(() => {
    if (isOpen) {
      setTrips(getSavedTrips());
      setConfirmClear(false);
    }
  }, [isOpen]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteTrip(id);
    setTrips(getSavedTrips());
  };

  const handleClearAll = () => {
    if (confirmClear) {
      clearAllTrips();
      setTrips([]);
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
    }
  };

  const sym = (trip: GeneratedItinerary) =>
    CURRENCY_SYMBOLS[trip.currency] ?? "$";

  const budgetColor = (status: string) => {
    switch (status) {
      case "great": return "#10B981";
      case "ok":    return TEAL;
      case "tight": return "#F59E0B";
      case "over":  return "#EF4444";
      default:      return TEAL;
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(11,19,64,0.5)",
            backdropFilter: "blur(2px)",
          }}
        />
      )}

      {/* Drawer panel */}
      <div
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: "min(360px, 92vw)",
          background: "#F8F9FD",
          zIndex: 201,
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          display: "flex", flexDirection: "column",
          boxShadow: "-8px 0 40px rgba(11,19,64,0.15)",
        }}
      >
        {/* Header */}
        <div style={{
          background: `linear-gradient(160deg, ${NAVY} 0%, #1D2E6B 100%)`,
          padding: "52px 20px 24px",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ color: GOLD, fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.1em", marginBottom: 6 }}>
                MY TRIPS
              </p>
              <h2 style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "1.6rem", fontWeight: 900,
                color: "#fff", lineHeight: 1.15, margin: 0,
              }}>
                Saved Itineraries
              </h2>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.78rem", marginTop: 6, margin: 0 }}>
                {trips.length} trip{trips.length !== 1 ? "s" : ""} saved
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,0.1)", border: "none",
                borderRadius: 10, padding: 8, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <X size={18} color="#fff" />
            </button>
          </div>
        </div>

        {/* Trip list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          {trips.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: "3rem", marginBottom: 16 }}>🗺️</div>
              <p style={{ color: NAVY, fontWeight: 700, fontSize: "1rem", marginBottom: 8 }}>
                No saved trips yet
              </p>
              <p style={{ color: "#6B7280", fontSize: "0.85rem", lineHeight: 1.6 }}>
                Generate an itinerary and it will automatically appear here.
              </p>
            </div>
          ) : (
            trips.map((trip) => {
              const isActive = trip.id === currentTripId;
              return (
                <div
                  key={trip.id}
                  onClick={() => {
                    onSelectTrip(trip);
                    onClose();
                  }}
                  style={{
                    background: "#fff",
                    borderRadius: 16,
                    marginBottom: 12,
                    cursor: "pointer",
                    border: isActive
                      ? `2px solid ${GOLD}`
                      : "2px solid transparent",
                    boxShadow: isActive
                      ? `0 4px 20px rgba(201,162,39,0.2)`
                      : "0 2px 12px rgba(11,19,64,0.07)",
                    overflow: "hidden",
                    transition: "all 0.2s",
                  }}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <div style={{
                      background: GOLD,
                      padding: "4px 12px",
                      display: "flex", alignItems: "center", gap: 6,
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: NAVY }} />
                      <span style={{ color: NAVY, fontSize: "0.65rem", fontWeight: 800 }}>
                        CURRENTLY VIEWING
                      </span>
                    </div>
                  )}

                  <div style={{ padding: "14px 16px" }}>
                    {/* Route name + time */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <h3 style={{
                        color: NAVY, fontFamily: "'Playfair Display', serif",
                        fontWeight: 800, fontSize: "0.95rem",
                        lineHeight: 1.3, flex: 1, paddingRight: 8, margin: 0,
                      }}>
                        {trip.routeName}
                      </h3>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                        <Clock size={11} color="#9CA3AF" />
                        <span style={{ color: "#9CA3AF", fontSize: "0.68rem" }}>
                          {formatSavedDate(trip.id)}
                        </span>
                      </div>
                    </div>

                    {/* Cities */}
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
                      <MapPin size={11} color={TEAL} />
                      <span style={{ color: "#4B5563", fontSize: "0.75rem" }}>
                        {trip.cities.join(" → ")}
                      </span>
                    </div>

                    {/* Stats row */}
                    <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Calendar size={11} color="#9CA3AF" />
                        <span style={{ color: "#6B7280", fontSize: "0.72rem" }}>
                          {trip.totalDays} days
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Users size={11} color="#9CA3AF" />
                        <span style={{ color: "#6B7280", fontSize: "0.72rem" }}>
                          {trip.totalPeople} {trip.totalPeople === 1 ? "person" : "people"}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Wallet size={11} color="#9CA3AF" />
                        <span style={{ color: budgetColor(trip.budgetStatus), fontSize: "0.72rem", fontWeight: 700 }}>
                          {sym(trip)}{trip.estimatedTotalCost.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Travel style badge + delete */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{
                        background: "rgba(11,19,64,0.06)",
                        color: NAVY, borderRadius: 100,
                        padding: "3px 10px",
                        fontSize: "0.68rem", fontWeight: 700,
                        textTransform: "capitalize",
                      }}>
                        {trip.travelStyle === "budget" ? "🎒" : trip.travelStyle === "comfort" ? "✨" : "👑"} {trip.travelStyle}
                      </span>
                      <button
                        onClick={(e) => handleDelete(trip.id, e)}
                        style={{
                          background: "none", border: "none",
                          cursor: "pointer", padding: "4px 6px",
                          borderRadius: 6,
                          color: "#D1D5DB",
                          display: "flex", alignItems: "center",
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {trips.length > 0 && (
          <div style={{
            padding: "12px 16px 24px",
            borderTop: "1px solid rgba(11,19,64,0.07)",
            flexShrink: 0,
          }}>
            <button
              onClick={handleClearAll}
              style={{
                width: "100%", padding: "10px",
                borderRadius: 12, cursor: "pointer",
                background: confirmClear ? "#FEE2E2" : "transparent",
                color: confirmClear ? "#EF4444" : "#9CA3AF",
                border: `1px solid ${confirmClear ? "#EF4444" : "rgba(11,19,64,0.1)"}`,
                fontSize: "0.8rem", fontWeight: 600,
                transition: "all 0.2s",
              }}
            >
              {confirmClear ? "Tap again to confirm clear all" : "Clear all trips"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
