import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  BedDouble,
  BusFront,
  CalendarDays,
  Download,
  Landmark,
  Lightbulb,
  Map as MapIcon,
  MapPin,
  Share2,
  UtensilsCrossed,
  Users,
  WalletCards,
} from "lucide-react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import type { DayItem, DayPlan, GeneratedItinerary, Screen } from "./types";
import { CURRENCY_SYMBOLS } from "./data";
import { downloadItineraryPDF } from "./generatePDF";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { getCityCoords, MARKER_COLORS } from "./mapConfig";
import { createColorMarker, createNumberMarker } from "./leafletSetup";
import { useFoursquareGeocoding } from "../../hooks/useFoursquareGeocoding";
import { extractPlaceName } from "./placeExtractor";
import { fetchRoadRoute } from "../../lib/osrmRoute";
import "../../../styles/itinerary-atlas.css";

const CATEGORY_META: Record<DayItem["category"], { label: string; color: string; icon: typeof BusFront }> = {
  transport: { label: "Transport", color: "#477791", icon: BusFront },
  activity: { label: "Activity", color: "#4F6F52", icon: Landmark },
  meal: { label: "Meal", color: "#B96F42", icon: UtensilsCrossed },
  accommodation: { label: "Stay", color: "#D4A64A", icon: BedDouble },
};

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  const positionKey = positions.map(([lat, lng]) => `${lat},${lng}`).join("|");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      map.invalidateSize();
      if (positions.length >= 2) map.fitBounds(positions, { padding: [44, 44] });
    }, 60);
    return () => window.clearTimeout(timeout);
    // positions are represented by the stable scalar key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, positionKey]);

  return null;
}

function destinationName(day: DayPlan | undefined) {
  if (!day) return "";
  return day.city.split("→").pop()?.trim() || day.city;
}

function RouteMap({
  cities,
  days,
  selectedDay,
  onDaySelect,
}: {
  cities: string[];
  days: DayPlan[];
  selectedDay: number;
  onDaySelect: (dayNum: number) => void;
}) {
  const positions = cities.map(getCityCoords).filter(Boolean) as [number, number][];
  const cityKey = cities.join("|");
  const [roadRoute, setRoadRoute] = useState<[number, number][] | null>(null);
  const [routeSettled, setRouteSettled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRoadRoute(null);
    setRouteSettled(false);
    if (positions.length < 2) {
      setRouteSettled(true);
      return () => { cancelled = true; };
    }
    fetchRoadRoute(positions).then((route) => {
      if (!cancelled) {
        setRoadRoute(route);
        setRouteSettled(true);
      }
    });
    return () => { cancelled = true; };
    // cityKey intentionally represents the complete route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityKey]);

  if (positions.length < 2) {
    return (
      <div className="wr-route-map-unavailable" role="status">
        <MapIcon size={24} aria-hidden="true" />
        <strong>Route map unavailable</strong>
        <span>The written itinerary and costs are still ready to use.</span>
      </div>
    );
  }

  const cityDays: Record<string, number[]> = {};
  days.forEach((day) => {
    const city = destinationName(day);
    if (!cityDays[city]) cityDays[city] = [];
    cityDays[city].push(day.day);
  });
  const activeCity = destinationName(days.find((day) => day.day === selectedDay));

  return (
    <div className="wr-route-map">
      <MapContainer
        key={cityKey}
        center={positions[0]}
        zoom={7}
        style={{ height: "100%", width: "100%" }}
        zoomControl
        scrollWheelZoom
        attributionControl
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; OpenStreetMap contributors &copy; CARTO"
        />
        <FitBounds positions={positions} />
        <Polyline
          positions={roadRoute || positions}
          pathOptions={roadRoute
            ? { color: "#D4A64A", weight: 4, opacity: 0.94 }
            : { color: "#D4A64A", weight: 3, dashArray: "8 7", opacity: 0.88 }}
        />
        {cities.map((city, index) => {
          const coords = getCityCoords(city);
          if (!coords) return null;
          const active = city === activeCity;
          const color = active
            ? "#D4A64A"
            : index === 0
              ? MARKER_COLORS.ancient
              : index === cities.length - 1
                ? MARKER_COLORS.beach
                : MARKER_COLORS.city;
          const daysHere = cityDays[city] || [];

          return (
            <Marker key={`${city}-${index}`} position={coords} icon={createColorMarker(color, active ? 19 : 14)}>
              <Popup>
                <div className="wr-map-popup">
                  <strong>{city}</strong>
                  {daysHere.length > 0 && (
                    <span>Day{daysHere.length > 1 ? "s" : ""} {daysHere.join(", ")}</span>
                  )}
                  {daysHere.length > 0 && (
                    <button type="button" onClick={() => onDaySelect(daysHere[0])}>
                      Open day {daysHere[0]}
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      <div className="wr-map-route-status" role="status">
        <span className={roadRoute ? "is-live" : "is-fallback"} aria-hidden="true" />
        {!routeSettled ? "Finding the road route…" : roadRoute ? "Road route connected" : "Approximate route shown"}
      </div>
    </div>
  );
}

function DayActivityMap({ day, city, sym }: { day: DayPlan; city: string; sym: string }) {
  const destCity = city.split("→").pop()?.trim() || city;
  const itemQueries = day.items
    .map((item, index) => ({ item, index, place: extractPlaceName(item.label) }))
    .filter((entry): entry is { item: DayItem; index: number; place: string } => entry.place !== null);
  const queries = [
    ...itemQueries.map((entry) => ({ key: `item-${entry.index}`, placeName: entry.place, city: destCity })),
    ...(day.accommodation ? [{ key: "hotel", placeName: day.accommodation, city: destCity }] : []),
  ];
  const { coords, loading, resolved, total } = useFoursquareGeocoding(queries);
  const locatedItems = itemQueries
    .map((entry) => ({ item: entry.item, coords: coords[`item-${entry.index}`] || null, index: entry.index }))
    .filter((entry): entry is { item: DayItem; coords: [number, number]; index: number } => entry.coords !== null);
  const hotelCoords = day.accommodation ? coords.hotel || null : null;
  const allCoords = [...locatedItems.map((entry) => entry.coords), ...(hotelCoords ? [hotelCoords] : [])];
  const walkPositions = locatedItems.map((entry) => entry.coords);
  const walkKey = walkPositions.map(([lat, lng]) => `${lat.toFixed(4)},${lng.toFixed(4)}`).join(";");
  const [walkRoute, setWalkRoute] = useState<[number, number][] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setWalkRoute(null);
    if (walkPositions.length >= 2) {
      fetchRoadRoute(walkPositions, "foot").then((route) => {
        if (!cancelled) setWalkRoute(route);
      });
    }
    return () => { cancelled = true; };
    // walkKey represents the complete ordered point set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walkKey]);

  if (queries.length === 0) return null;
  if (allCoords.length === 0 && !loading) {
    return (
      <div className="wr-day-map-empty" role="status">
        <MapPin size={17} aria-hidden="true" />
        These places could not be pinpointed right now. The schedule below is still available.
      </div>
    );
  }

  const centerLat = allCoords.length
    ? allCoords.reduce((sum, coordsPair) => sum + coordsPair[0], 0) / allCoords.length
    : 7.8731;
  const centerLng = allCoords.length
    ? allCoords.reduce((sum, coordsPair) => sum + coordsPair[1], 0) / allCoords.length
    : 80.7718;

  return (
    <section className="wr-day-map-block" aria-label={`Places for day ${day.day}`}>
      <div className="wr-day-map-heading">
        <div>
          <span className="wr-eyebrow">Places & walking route</span>
          <strong>{destCity}</strong>
        </div>
        {loading && <span className="wr-geocode-progress">Pinpointing {resolved}/{total}</span>}
      </div>
      {allCoords.length > 0 && (
        <div className="wr-day-map-canvas">
          <MapContainer
            key={`${day.day}-${walkKey}`}
            center={[centerLat, centerLng]}
            zoom={13}
            style={{ height: "100%", width: "100%" }}
            zoomControl
            scrollWheelZoom={false}
            attributionControl
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution="&copy; OpenStreetMap contributors &copy; CARTO"
            />
            {locatedItems.length >= 2 && (
              <Polyline
                positions={walkRoute || locatedItems.map((entry) => entry.coords)}
                pathOptions={walkRoute
                  ? { color: "#D4A64A", weight: 3, opacity: 0.85 }
                  : { color: "#D4A64A", weight: 2, dashArray: "5 5", opacity: 0.76 }}
              />
            )}
            {locatedItems.map((located, index) => (
              <Marker
                key={`${located.index}-${located.item.label}`}
                position={located.coords}
                icon={createNumberMarker(index + 1, CATEGORY_META[located.item.category].color)}
              >
                <Popup>
                  <div className="wr-map-popup">
                    <strong>{located.item.label}</strong>
                    <span>{located.item.time} · {located.item.detail}</span>
                    {located.item.cost > 0 && <b>{sym}{located.item.cost.toLocaleString()}</b>}
                    {located.item.tip && <small>{located.item.tip}</small>}
                  </div>
                </Popup>
              </Marker>
            ))}
            {hotelCoords && (
              <Marker position={hotelCoords} icon={createColorMarker("#D4A64A", 17)}>
                <Popup>
                  <div className="wr-map-popup">
                    <strong>{day.accommodation}</strong>
                    <span>Tonight’s stay</span>
                    {day.accommodationCostPerNight > 0 && (
                      <b>{sym}{day.accommodationCostPerNight.toLocaleString()} / night</b>
                    )}
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        </div>
      )}
      {allCoords.length > 0 && (
        <p className="wr-day-map-caption">{allCoords.length} place{allCoords.length === 1 ? "" : "s"} located for this day.</p>
      )}
    </section>
  );
}

function DayCard({ day, sym, onViewHotels }: { day: DayPlan; sym: string; onViewHotels: () => void }) {
  return (
    <article id={`day-${day.day}`} className="wr-day-sheet" aria-labelledby={`day-title-${day.day}`}>
      <header className="wr-day-sheet-header">
        <div className="wr-day-number">
          <span>Day</span>
          <strong>{String(day.day).padStart(2, "0")}</strong>
        </div>
        <div>
          <p className="wr-coordinates">Daily field note · Sri Lanka</p>
          <h2 id={`day-title-${day.day}`}>{day.city}</h2>
        </div>
        <div className="wr-day-total">
          <span>Per person</span>
          <strong>{sym}{day.dailyCostPerPerson.toLocaleString()}</strong>
        </div>
      </header>

      <DayActivityMap day={day} city={day.city} sym={sym} />

      <ol className="wr-day-timeline">
        {day.items.length > 0 ? day.items.map((item, index) => {
          const meta = CATEGORY_META[item.category];
          const ItemIcon = meta.icon;
          return (
            <li key={`${item.time}-${item.label}-${index}`}>
              <time>{item.time || "Flexible"}</time>
              <span className="wr-timeline-marker" style={{ "--item-color": meta.color } as React.CSSProperties}>
                <ItemIcon size={16} aria-hidden="true" />
              </span>
              <div className="wr-timeline-copy">
                <div className="wr-timeline-title-row">
                  <div>
                    <span className="wr-item-category">{meta.label}</span>
                    <h3>{item.label || "Planned stop"}</h3>
                  </div>
                  <strong className="wr-item-cost">{item.cost > 0 ? `${sym}${item.cost.toLocaleString()}` : "No added cost"}</strong>
                </div>
                {item.detail && <p>{item.detail}</p>}
                {item.tip && <aside className="wr-item-note"><Lightbulb size={14} aria-hidden="true" /> {item.tip}</aside>}
              </div>
            </li>
          );
        }) : (
          <li className="wr-timeline-empty">No timed activities were supplied for this day.</li>
        )}
      </ol>

      {day.accommodation && (
        <section className="wr-day-stay" aria-label="Tonight's accommodation">
          <BedDouble size={19} aria-hidden="true" />
          <div>
            <span>Tonight’s stay</span>
            <strong>{day.accommodation}</strong>
            {day.accommodationCostPerNight > 0 && (
              <small>{sym}{day.accommodationCostPerNight.toLocaleString()} per night</small>
            )}
          </div>
          <button type="button" onClick={onViewHotels}>Explore stays</button>
        </section>
      )}

      {day.localTip && (
        <aside className="wr-local-note">
          <Lightbulb size={17} aria-hidden="true" />
          <div><span>Local note</span><p>{day.localTip}</p></div>
        </aside>
      )}
    </article>
  );
}

export function ItineraryScreen({
  itinerary,
  navigate,
}: {
  itinerary: GeneratedItinerary;
  navigate: (screen: Screen) => void;
}) {
  const sym = CURRENCY_SYMBOLS[itinerary.currency] ?? itinerary.currency;
  const days = itinerary.days ?? [];
  const [selectedDay, setSelectedDay] = useState(days[0]?.day ?? 1);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<"plan" | "map">("plan");
  const bp = useBreakpoint();
  const isMobile = bp === "mobile";
  const activeDay = days.find((day) => day.day === selectedDay) ?? days[0];
  const remaining = itinerary.remainingBudget ?? itinerary.inputBudget - itinerary.estimatedTotalCost;
  const averagePerDay = Math.round(itinerary.estimatedTotalCost / Math.max(1, itinerary.totalDays));
  const statusCopy = {
    great: { label: "Comfortably within budget", tone: "great" },
    ok: { label: "Within budget", tone: "ok" },
    tight: { label: "Close to budget", tone: "tight" },
    over: { label: "Over budget", tone: "over" },
  }[itinerary.budgetStatus] ?? { label: "Budget calculated", tone: "ok" };

  const selectDay = (dayNumber: number) => {
    setSelectedDay(dayNumber);
    if (isMobile) setMobilePane("plan");
    window.requestAnimationFrame(() => {
      document.getElementById(`day-tab-${dayNumber}`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    });
  };

  const handleDownloadPDF = async () => {
    setPdfLoading(true);
    setPdfError(null);
    try {
      await downloadItineraryPDF(itinerary);
    } catch {
      setPdfError("The PDF could not be prepared. Please try again.");
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <main className={`wr-itinerary wr-mobile-pane-${mobilePane}`}>
      <header className="wr-itinerary-hero">
        <div className="wr-itinerary-hero-inner">
          <div className="wr-itinerary-title-block">
            <p className="wr-coordinates">Route file · 07.8731° N, 80.7718° E</p>
            <span className={`wr-budget-status is-${statusCopy.tone}`}>{statusCopy.label}</span>
            <h1>{itinerary.routeName}</h1>
            {itinerary.routeSlogan && <p className="wr-route-slogan">{itinerary.routeSlogan}</p>}
            <div className="wr-route-path" aria-label={`Route: ${itinerary.cities.join(" to ")}`}>
              {(itinerary.cities ?? []).map((city, index) => (
                <span key={`${city}-${index}`}>
                  <i aria-hidden="true" />{city}
                </span>
              ))}
            </div>
          </div>

          <div className="wr-itinerary-actions" aria-label="Itinerary actions">
            <button type="button" className="wr-button wr-button-gold" onClick={() => navigate("costs")}>
              <BarChart3 size={17} aria-hidden="true" /> Costs
            </button>
            <button type="button" className="wr-button wr-button-quiet" onClick={handleDownloadPDF} disabled={pdfLoading}>
              <Download size={17} aria-hidden="true" /> {pdfLoading ? "Preparing…" : "Download PDF"}
            </button>
            <button type="button" className="wr-button wr-button-quiet" onClick={() => navigate("share")}>
              <Share2 size={17} aria-hidden="true" /> Share
            </button>
          </div>
        </div>

        <div className="wr-trip-ledger" aria-label="Trip summary">
          <div><CalendarDays size={17} aria-hidden="true" /><span>Duration<strong>{itinerary.totalDays} days</strong></span></div>
          <div><Users size={17} aria-hidden="true" /><span>Travellers<strong>{itinerary.totalPeople}</strong></span></div>
          <div><WalletCards size={17} aria-hidden="true" /><span>Total budget<strong>{sym}{itinerary.inputBudget.toLocaleString()}</strong></span></div>
          <div><span className="wr-ledger-mark" aria-hidden="true" /> <span>Estimated spend<strong>{sym}{itinerary.estimatedTotalCost.toLocaleString()}</strong></span></div>
          <div className={remaining < 0 ? "is-over" : ""}><span className="wr-ledger-mark" aria-hidden="true" /> <span>{remaining < 0 ? "Over by" : "Remaining"}<strong>{sym}{Math.abs(remaining).toLocaleString()}</strong></span></div>
          <div><span className="wr-ledger-mark" aria-hidden="true" /> <span>Average / day<strong>{sym}{averagePerDay.toLocaleString()}</strong></span></div>
        </div>
        {pdfError && <p className="wr-pdf-error" role="alert">{pdfError}</p>}
      </header>

      {isMobile && (
        <div className="wr-itinerary-view-switch" aria-label="Itinerary view">
          <button type="button" aria-pressed={mobilePane === "plan"} onClick={() => setMobilePane("plan")}>
            <CalendarDays size={16} aria-hidden="true" /> Itinerary
          </button>
          <button type="button" aria-pressed={mobilePane === "map"} onClick={() => setMobilePane("map")}>
            <MapIcon size={16} aria-hidden="true" /> Route map
          </button>
        </div>
      )}

      <div className="wr-itinerary-workspace">
        <section className="wr-itinerary-plan" aria-label="Day-by-day itinerary">
          <div className="wr-day-navigation-wrap">
            <div className="wr-day-navigation-heading">
              <div><span className="wr-eyebrow">Day by day</span><strong>Choose a day</strong></div>
              <span>{days.length} planned day{days.length === 1 ? "" : "s"}</span>
            </div>
            <div className="wr-day-navigation" role="tablist" aria-label="Itinerary days">
              {days.map((day) => (
                <button
                  id={`day-tab-${day.day}`}
                  key={day.day}
                  type="button"
                  role="tab"
                  aria-selected={selectedDay === day.day}
                  aria-controls={`day-${day.day}`}
                  onClick={() => selectDay(day.day)}
                >
                  <span>Day {String(day.day).padStart(2, "0")}</span>
                  <strong>{destinationName(day)}</strong>
                </button>
              ))}
            </div>
          </div>

          {days.length < itinerary.totalDays && (
            <div className="wr-itinerary-notice" role="status">
              <AlertTriangle size={16} aria-hidden="true" />
              This standard route currently includes {days.length} detailed day{days.length === 1 ? "" : "s"} for a {itinerary.totalDays}-day request.
            </div>
          )}

          {activeDay ? (
            <DayCard day={activeDay} sym={sym} onViewHotels={() => navigate("hotels")} />
          ) : (
            <div className="wr-itinerary-empty">
              <CalendarDays size={26} aria-hidden="true" />
              <h2>No daily schedule was returned</h2>
              <p>Your trip totals are still available. Try planning again to rebuild the daily route.</p>
              <button type="button" className="wr-button wr-button-gold" onClick={() => navigate("planner")}>Plan again</button>
            </div>
          )}

          {(itinerary.highlights?.length > 0 || itinerary.warnings?.length > 0) && (
            <div className="wr-trip-notes-grid">
              {itinerary.highlights?.length > 0 && (
                <section>
                  <span className="wr-eyebrow">Route highlights</span>
                  <ul>{itinerary.highlights.map((highlight, index) => <li key={`${highlight}-${index}`}>{highlight}</li>)}</ul>
                </section>
              )}
              {itinerary.warnings?.length > 0 && (
                <section className="wr-watch-notes">
                  <span className="wr-eyebrow"><AlertTriangle size={13} aria-hidden="true" /> Practical notes</span>
                  <ul>{itinerary.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul>
                </section>
              )}
            </div>
          )}

          {itinerary.globalTips?.length > 0 && (
            <section className="wr-money-notes">
              <div><Lightbulb size={20} aria-hidden="true" /><span><small>Useful on the road</small><strong>Budget notes</strong></span></div>
              <ol>{itinerary.globalTips.map((tip, index) => <li key={`${tip}-${index}`}><b>{String(index + 1).padStart(2, "0")}</b>{tip}</li>)}</ol>
            </section>
          )}

          <div className="wr-itinerary-footer-actions">
            <button type="button" className="wr-button wr-button-outline" onClick={() => navigate("hotels")}>
              <BedDouble size={17} aria-hidden="true" /> Explore hotels
            </button>
            <button type="button" className="wr-button wr-button-gold" onClick={() => navigate("share")}>
              <Share2 size={17} aria-hidden="true" /> Share this trip
            </button>
          </div>
        </section>

        {(!isMobile || mobilePane === "map") && (
          <aside className="wr-itinerary-map-panel" aria-label="Interactive route map">
            <div className="wr-map-panel-heading">
              <div><span className="wr-eyebrow">Real-road overview</span><strong>Your island route</strong></div>
              <span className="wr-coordinates">{itinerary.cities.length} stops</span>
            </div>
            <RouteMap cities={itinerary.cities ?? []} days={days} selectedDay={selectedDay} onDaySelect={selectDay} />
            {activeDay && (
              <div className="wr-map-day-summary">
                <span>Selected · Day {String(activeDay.day).padStart(2, "0")}</span>
                <strong>{activeDay.city}</strong>
                <small>{activeDay.items.length} scheduled stop{activeDay.items.length === 1 ? "" : "s"} · {sym}{activeDay.dailyCostPerPerson.toLocaleString()} per person</small>
              </div>
            )}
          </aside>
        )}
      </div>
    </main>
  );
}
