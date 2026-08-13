import { ArrowRight, Clock3, MapPinned } from "lucide-react";
import { MapContainer, TileLayer, Marker, Polyline } from "react-leaflet";
import { POPULAR_ROUTES } from "./data";
import { getCityCoords, MARKER_COLORS } from "./mapConfig";
import { createColorMarker } from "./leafletSetup";
import type { Screen } from "./types";
import "../../../styles/secondary-screens.css";

function MiniRouteMap({ cities, routeName }: { cities: string[]; routeName: string }) {
  const positions = cities.map(getCityCoords).filter(Boolean) as [number, number][];
  if (positions.length < 2) return null;

  const centerLat = positions.reduce((sum, position) => sum + position[0], 0) / positions.length;
  const centerLng = positions.reduce((sum, position) => sum + position[1], 0) / positions.length;

  return (
    <div
      className="wr-route-mini-map"
      role="img"
      aria-label={`${routeName} map: ${cities.join(" to ")}`}
    >
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={6}
        zoomControl={false}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        touchZoom={false}
        keyboard={false}
        attributionControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <Polyline
          positions={positions}
          pathOptions={{ color: "#D4A64A", weight: 2.5, dashArray: "6 5", opacity: 0.95 }}
        />
        {cities.map((city, index) => {
          const coords = getCityCoords(city);
          if (!coords) return null;
          const color = index === 0
            ? MARKER_COLORS.ancient
            : index === cities.length - 1
              ? MARKER_COLORS.beach
              : MARKER_COLORS.city;
          return <Marker key={city} position={coords} icon={createColorMarker(color, 10)} />;
        })}
      </MapContainer>
    </div>
  );
}

export function RoutesScreen({ navigate }: { navigate: (s: Screen) => void }) {
  return (
    <main className="wr-screen wr-routes-screen">
      <header className="wr-editorial-header wr-routes-header">
        <div className="wr-header-grid">
          <div>
            <p className="wr-kicker">Field routes · Sri Lanka</p>
            <h1>Choose the shape of your journey.</h1>
          </div>
          <p className="wr-header-intro">
            {POPULAR_ROUTES.length} existing route ideas, each with a clear sequence of stops, trip length and planning budget.
          </p>
        </div>
      </header>

      <div className="wr-secondary-shell wr-routes-shell">
        <div className="wr-routes-intro">
          <div>
            <p className="wr-section-index">Route folio</p>
            <h2>From first landing to final coast.</h2>
          </div>
          <p>Use these circuits as a starting point, then set your own budget and preferences in the planner.</p>
        </div>

        <ol className="wr-route-folio">
          {POPULAR_ROUTES.map((route, index) => (
            <li key={route.key}>
              <article className="wr-route-entry">
                <div className="wr-route-number" aria-hidden="true">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </div>

                <div className="wr-route-copy">
                  <p className="wr-route-type">{route.type}</p>
                  <h2>{route.name}</h2>
                  <p className="wr-route-description">{route.description}</p>

                  <ol className="wr-route-stops" aria-label={`${route.name} destinations`}>
                    {route.cities.map((city, cityIndex) => (
                      <li key={`${route.key}-${city}`}>
                        <span className="wr-route-stop-dot" aria-hidden="true" />
                        <span>{city}</span>
                        {cityIndex < route.cities.length - 1 && <span className="wr-route-stop-line" aria-hidden="true" />}
                      </li>
                    ))}
                  </ol>

                  <div className="wr-route-meta">
                    <div>
                      <Clock3 aria-hidden="true" size={16} />
                      <span>{route.duration}</span>
                    </div>
                    <div>
                      <MapPinned aria-hidden="true" size={16} />
                      <span>{route.cities.length} stops</span>
                    </div>
                    <div className="wr-route-price">
                      <span>Budget estimate from</span>
                      <strong>${route.fromPrice} / person</strong>
                    </div>
                  </div>

                  <div className="wr-route-highlights">
                    <p>Along the way</p>
                    <ul>
                      {route.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
                    </ul>
                  </div>

                  <div className="wr-route-footer">
                    <div className="wr-route-tags" aria-label="Travel interests">
                      {route.tags.map((tag) => <span key={tag}>{tag}</span>)}
                    </div>
                    <button className="wr-route-cta" onClick={() => navigate("planner")}>
                      Plan a similar trip
                      <ArrowRight aria-hidden="true" size={17} />
                    </button>
                  </div>
                </div>

                <div className="wr-route-visual">
                  <div className="wr-route-wash" style={{ background: route.gradient }}>
                    <span className="wr-route-glyph" aria-hidden="true">{route.image}</span>
                    <span>Route {String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <MiniRouteMap cities={route.cities} routeName={route.name} />
                </div>
              </article>
            </li>
          ))}
        </ol>

        <section className="wr-routes-closing" aria-labelledby="routes-closing-title">
          <div>
            <p className="wr-section-index">Build your own</p>
            <h2 id="routes-closing-title">Your budget can redraw the route.</h2>
          </div>
          <button className="wr-primary-button" onClick={() => navigate("planner")}>
            Start planning
            <ArrowRight aria-hidden="true" size={17} />
          </button>
        </section>
      </div>
    </main>
  );
}
