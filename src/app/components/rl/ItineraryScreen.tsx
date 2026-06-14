import { useState, useEffect } from "react";
import {
  ChevronDown, ChevronUp, Share2, BarChart2,
  AlertTriangle, Lightbulb, Calendar, Users, Wallet, Download
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import type { GeneratedItinerary, DayPlan, DayItem, Screen } from "./types";
import { CURRENCY_SYMBOLS } from "./data";
import { downloadItineraryPDF } from "./generatePDF";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { getCityCoords, MARKER_COLORS } from "./mapConfig";
import { createColorMarker, createNumberMarker } from "./leafletSetup";
import { useFoursquareGeocoding } from "../../hooks/useFoursquareGeocoding";
import { extractPlaceName } from "./placeExtractor";
import { getGeoCacheStats } from "./geocoder";

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

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length >= 2) {
      map.fitBounds(positions, { padding: [30, 30] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function RouteMap({ cities, days, onDaySelect }: {
  cities: string[];
  days: DayPlan[];
  onDaySelect: (dayNum: number) => void;
}) {
  const positions = cities
    .map(getCityCoords)
    .filter(Boolean) as [number, number][];

  if (positions.length < 2) return null;

  // Find which day(s) are spent in each city
  const cityDays: Record<string, number[]> = {};
  days.forEach(d => {
    const cityName = d.city.split("→").pop()?.trim() || d.city;
    if (!cityDays[cityName]) cityDays[cityName] = [];
    cityDays[cityName].push(d.day);
  });

  return (
    <div style={{ borderRadius: 16, overflow: "hidden", marginBottom: 16, boxShadow: "0 4px 20px rgba(11,19,64,0.1)" }}>
      <MapContainer
        center={positions[0]}
        zoom={7}
        style={{ height: 220, width: "100%" }}
        zoomControl={false}
        scrollWheelZoom={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap"
        />
        <FitBounds positions={positions} />

        {/* Dashed route polyline */}
        <Polyline
          positions={positions}
          pathOptions={{ color: "#C9A227", weight: 2.5, dashArray: "6 5", opacity: 0.8 }}
        />

        {/* City markers */}
        {cities.map((city, i) => {
          const coords = getCityCoords(city);
          if (!coords) return null;
          const color = i === 0
            ? MARKER_COLORS.ancient  // gold for start
            : i === cities.length - 1
            ? MARKER_COLORS.beach    // teal for end
            : MARKER_COLORS.city;    // navy for middle
          const daysHere = cityDays[city] || [];

          return (
            <Marker key={city} position={coords} icon={createColorMarker(color, 14)}>
              <Popup>
                <div style={{ fontFamily: "sans-serif", minWidth: 120 }}>
                  <strong style={{ color: "#0B1340" }}>{city}</strong>
                  {daysHere.length > 0 && (
                    <p style={{ margin: "4px 0 6px", color: "#6B7280", fontSize: 12 }}>
                      Day{daysHere.length > 1 ? "s" : ""} {daysHere.join(", ")}
                    </p>
                  )}
                  {daysHere.length > 0 && (
                    <button
                      onClick={() => onDaySelect(daysHere[0])}
                      style={{
                        background: "#C9A227", color: "#0B1340",
                        border: "none", borderRadius: 6, padding: "5px 10px",
                        fontSize: 11, fontWeight: 700, cursor: "pointer", width: "100%",
                      }}
                    >
                      View Day {daysHere[0]} →
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

// Helper — color by activity category
function getCategoryColor(category: string): string {
  switch (category) {
    case "activity":  return "#0D9488"; // teal
    case "meal":      return "#F59E0B"; // amber
    case "accommodation": return "#C9A227"; // gold
    default:          return "#0B1340"; // navy
  }
}

function DayActivityMap({ day, city }: { day: DayPlan; city: string }) {
  // The destination city — last leg of "Colombo → Kandy" — biases Foursquare search.
  const destCity = city.split("→").pop()?.trim() || city;

  // Locatable activities/meals (transport, check-ins, free time are filtered out).
  const itemQueries = day.items
    .map((item, index) => ({ item, index, place: extractPlaceName(item.label) }))
    .filter((x): x is { item: DayItem; index: number; place: string } => x.place !== null);

  // Build Foursquare queries — activities + the hotel, each with a stable key.
  const queries = [
    ...itemQueries.map(x => ({ key: `item-${x.index}`, placeName: x.place, city: destCity })),
    ...(day.accommodation ? [{ key: "hotel", placeName: day.accommodation, city: destCity }] : []),
  ];

  const { coords, loading, resolved, total } = useFoursquareGeocoding(queries);

  // Map geocoded coords back to the original items (matched by stable key).
  const locatedItems = itemQueries
    .map(x => ({ item: x.item, coords: coords[`item-${x.index}`] || null, index: x.index }))
    .filter((x): x is { item: DayItem; coords: [number, number]; index: number } => x.coords !== null);

  // Hotel coords
  const hotelCoords = day.accommodation ? coords["hotel"] || null : null;

  const allCoords = [
    ...locatedItems.map(x => x.coords),
    ...(hotelCoords ? [hotelCoords] : []),
  ];

  // Need at least 1 located point to show the map (or still loading).
  if (allCoords.length === 0 && !loading) return null;

  const centerLat = allCoords.length > 0 ? allCoords.reduce((s, c) => s + c[0], 0) / allCoords.length : 7.8731;
  const centerLng = allCoords.length > 0 ? allCoords.reduce((s, c) => s + c[1], 0) / allCoords.length : 80.7718;

  return (
    <div style={{ margin: "12px 16px" }}>
      {/* Loading progress bar */}
      {loading && (
        <div style={{
          background: "rgba(11,19,64,0.04)",
          borderRadius: 8, padding: "8px 12px",
          marginBottom: 8,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{ flex: 1, background: "rgba(11,19,64,0.08)", borderRadius: 100, height: 4, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 100,
              background: "#C9A227",
              width: `${total > 0 ? (resolved / total) * 100 : 0}%`,
              transition: "width 0.3s ease",
            }} />
          </div>
          <span style={{ color: "#6B7280", fontSize: "0.72rem", whiteSpace: "nowrap" }}>
            Pinpointing {resolved}/{total} places...
          </span>
        </div>
      )}

      {/* Map — show as soon as we have at least 1 pin */}
      {allCoords.length > 0 && (
        <div style={{
          borderRadius: 12, overflow: "hidden",
          border: "1px solid rgba(11,19,64,0.08)",
          boxShadow: "0 2px 12px rgba(11,19,64,0.08)",
        }}>
          <MapContainer
            center={[centerLat, centerLng]}
            zoom={13}
            style={{ height: 200, width: "100%" }}
            zoomControl={true}
            scrollWheelZoom={false}
            attributionControl={false}
          >
            <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />

            {/* Route line connecting activity pins in order */}
            {locatedItems.length >= 2 && (
              <Polyline
                positions={locatedItems.map(x => x.coords)}
                pathOptions={{ color: "#C9A227", weight: 2, dashArray: "4 4", opacity: 0.7 }}
              />
            )}

            {/* Activity markers — numbered in order */}
            {locatedItems.map((located, i) => (
              <Marker
                key={i}
                position={located.coords}
                icon={createNumberMarker(i + 1, getCategoryColor(located.item.category))}
              >
                <Popup>
                  <div style={{ fontFamily: "sans-serif", minWidth: 160 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 16 }}>{located.item.icon}</span>
                      <strong style={{ color: "#0B1340", fontSize: 13, lineHeight: 1.3 }}>
                        {located.item.label}
                      </strong>
                    </div>
                    <p style={{ color: "#6B7280", fontSize: 11, margin: "0 0 4px" }}>
                      {located.item.time} · {located.item.detail}
                    </p>
                    {located.item.cost > 0 && (
                      <p style={{ color: "#0D9488", fontSize: 11, fontWeight: 700, margin: 0 }}>
                        Cost: ${located.item.cost}
                      </p>
                    )}
                    {located.item.tip && (
                      <p style={{ color: "#92400E", fontSize: 11, margin: "4px 0 0", lineHeight: 1.4 }}>
                        💡 {located.item.tip}
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Hotel marker — special gold pin */}
            {hotelCoords && (
              <Marker position={hotelCoords} icon={createColorMarker("#C9A227", 16)}>
                <Popup>
                  <div style={{ fontFamily: "sans-serif" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 16 }}>🏨</span>
                      <strong style={{ color: "#0B1340", fontSize: 13 }}>
                        {day.accommodation}
                      </strong>
                    </div>
                    <p style={{ color: "#6B7280", fontSize: 11, margin: "4px 0 0" }}>
                      Tonight's stay · ${day.accommodationCostPerNight}/night
                    </p>
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        </div>
      )}

      {/* Legend */}
      {allCoords.length > 0 && (
        <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#0D9488", border: "1.5px solid white" }} />
            <span style={{ fontSize: "0.68rem", color: "#6B7280" }}>Activities</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#F59E0B", border: "1.5px solid white" }} />
            <span style={{ fontSize: "0.68rem", color: "#6B7280" }}>Meals</span>
          </div>
          {hotelCoords && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#C9A227", border: "1.5px solid white" }} />
              <span style={{ fontSize: "0.68rem", color: "#6B7280" }}>Hotel</span>
            </div>
          )}
          <span style={{ fontSize: "0.68rem", color: "#9CA3AF", marginLeft: "auto" }}>
            {allCoords.length} place{allCoords.length !== 1 ? "s" : ""} pinpointed
          </span>
        </div>
      )}
    </div>
  );
}

function GeocodingStatus() {
  const stats = getGeoCacheStats();
  if (stats.total === 0) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "6px 12px", margin: "0 0 12px",
      background: "rgba(13,148,136,0.06)", borderRadius: 8,
    }}>
      <span style={{ fontSize: "0.75rem" }}>📍</span>
      <span style={{ color: "#0D9488", fontSize: "0.72rem", fontWeight: 600 }}>
        {stats.fresh} places auto-pinpointed on map
      </span>
    </div>
  );
}

function DayCard({ day, sym }: { day: DayPlan; sym: string }) {
  const [expanded, setExpanded] = useState(day.day <= 2);
  return (
    <div id={`day-${day.day}`} style={{
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
          {/* Day activity mini-map (auto-geocoded) */}
          <DayActivityMap day={day} city={day.city} />

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
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const bp = useBreakpoint();
  const isDesktop = bp === "desktop";

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
          <RouteMap
            cities={itinerary.cities}
            days={itinerary.days}
            onDaySelect={(dayNum) => {
              setSelectedDay(dayNum);
              document.getElementById(`day-${dayNum}`)?.scrollIntoView({ behavior: "smooth" });
            }}
          />
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

        {/* Geocoding status */}
        <GeocodingStatus />

        {/* Day cards — desktop shows selector sidebar + single day content */}
        {isDesktop ? (
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
            {/* Day selector sidebar */}
            <div style={{ width: 160, flexShrink: 0, position: "sticky", top: 92 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {itinerary.days.map((day) => {
                  const active = (selectedDay ?? 1) === day.day;
                  return (
                    <button
                      key={day.day}
                      onClick={() => setSelectedDay(day.day)}
                      style={{
                        padding: "10px 14px", borderRadius: 12, border: "none", cursor: "pointer",
                        background: active ? NAVY : "#fff",
                        color: active ? "#fff" : "#4B5563",
                        fontWeight: active ? 700 : 500, fontSize: "0.8rem", textAlign: "left",
                        boxShadow: "0 2px 8px rgba(11,19,64,0.06)",
                        transition: "all 0.15s",
                      }}
                    >
                      <div style={{ color: active ? GOLD : "#9CA3AF", fontSize: "0.65rem", fontWeight: 700, marginBottom: 2 }}>DAY {day.day}</div>
                      <div style={{ fontSize: "0.78rem", lineHeight: 1.3 }}>{day.city}</div>
                      <div style={{ color: active ? "rgba(255,255,255,0.6)" : "#9CA3AF", fontSize: "0.68rem", marginTop: 2 }}>{sym}{day.dailyCostPerPerson}/p</div>
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Selected day content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {(() => {
                const day = itinerary.days.find(d => d.day === (selectedDay ?? 1)) ?? itinerary.days[0];
                return <DayCard key={day.day} day={day} sym={sym} />;
              })()}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {itinerary.days.map((day) => (
              <DayCard key={day.day} day={day} sym={sym} />
            ))}
          </div>
        )}

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
