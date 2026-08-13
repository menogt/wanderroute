import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import {
  ArrowRight,
  Compass,
  Hotel,
  Landmark,
  MapPin,
  Search,
  Utensils,
  X,
} from "lucide-react";
import {
  CITY_CATEGORIES,
  CITY_COORDS,
  MARKER_COLORS,
  SRI_LANKA_CENTER,
  SRI_LANKA_ZOOM,
} from "./mapConfig";
import { createColorMarker, createHotelMarker } from "./leafletSetup";
import { HOTELS_BY_CITY } from "./data";
import { usePlaceDiscovery } from "../../hooks/usePlaceDiscovery";
import type {
  DiscoveredPlace,
  DiscoveryCategory,
} from "./foursquareDiscovery";
import type { Screen } from "./types";
import "../../../styles/map-hotels.css";

type Category = "all" | "city" | "beach" | "hill" | "ancient" | "wildlife";

type HotelPin = {
  city: string;
  name: string;
  priceUSD: number;
  type: string;
  bookingUrl?: string;
  location: [number, number];
};

type MapSelection =
  | { kind: "city"; city: string; location: [number, number] }
  | { kind: "hotel"; hotel: HotelPin }
  | { kind: "place"; place: DiscoveredPlace };

const FILTER_LABELS: Record<Category, string> = {
  all: "All places",
  city: "Cities",
  beach: "Coast",
  hill: "Highlands",
  ancient: "Heritage",
  wildlife: "Wildlife",
};

const CATEGORY_LABELS: Record<Exclude<Category, "all">, string> = {
  city: "City",
  beach: "Coast",
  hill: "Highlands",
  ancient: "Heritage",
  wildlife: "Wildlife",
};

const DISCOVERY_META: Record<
  DiscoveryCategory,
  { label: string; singular: string; icon: typeof Hotel; color: string }
> = {
  hotel: {
    label: "Hotels",
    singular: "Hotel",
    icon: Hotel,
    color: "#0D9488",
  },
  restaurant: {
    label: "Restaurants",
    singular: "Restaurant",
    icon: Utensils,
    color: "#B9513D",
  },
  attraction: {
    label: "Attractions",
    singular: "Attraction",
    icon: Landmark,
    color: "#70563D",
  },
};

function MapFocus({
  target,
  zoom,
}: {
  target: [number, number] | null;
  zoom: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      map.setView(target, zoom);
      return;
    }
    map.flyTo(target, zoom, { duration: 0.65 });
  }, [map, target, zoom]);

  return null;
}

export function MapScreen({
  navigate,
  onCitySelect,
}: {
  navigate: (s: Screen) => void;
  onCitySelect: (city: string) => void;
}) {
  const [filter, setFilter] = useState<Category>("all");
  const [search, setSearch] = useState("");
  const [showHotels, setShowHotels] = useState(false);
  const [discoveryCategory, setDiscoveryCategory] =
    useState<DiscoveryCategory | null>(null);
  const [selection, setSelection] = useState<MapSelection | null>(null);

  const visibleCityNames = useMemo(
    () =>
      Object.keys(CITY_COORDS).filter((city) => {
        const category = CITY_CATEGORIES[city] ?? "city";
        const matchesFilter = filter === "all" || category === filter;
        const matchesSearch = city.toLowerCase().includes(search.trim().toLowerCase());
        return matchesFilter && matchesSearch;
      }),
    [filter, search],
  );

  const {
    places: discoveredPlaces,
    loading: discoveringPlaces,
    resolvedCities,
    totalCities,
  } = usePlaceDiscovery(
    visibleCityNames,
    discoveryCategory ?? "hotel",
    discoveryCategory !== null,
    5,
  );

  const allHotelPins = useMemo(() => {
    const pins: HotelPin[] = [];
    Object.entries(HOTELS_BY_CITY).forEach(([city, hotels]) => {
      hotels.forEach((hotel) => {
        if (!hotel.location) return;
        pins.push({
          city,
          name: hotel.name,
          priceUSD: hotel.priceUSD,
          type: hotel.type,
          bookingUrl: hotel.bookingUrl,
          location: hotel.location,
        });
      });
    });
    return pins;
  }, []);

  const visibleCities = useMemo(
    () =>
      Object.entries(CITY_COORDS).filter(([city]) =>
        visibleCityNames.includes(city),
      ),
    [visibleCityNames],
  );

  const selectedTarget = useMemo<[number, number] | null>(() => {
    if (!selection) return null;
    if (selection.kind === "city") return selection.location;
    if (selection.kind === "hotel") return selection.hotel.location;
    return selection.place.location;
  }, [selection]);

  const selectedZoom = selection?.kind === "city" ? 10 : 14;

  const selectCityAndPlan = (city: string) => {
    // Preserve this order: PlannerScreen reads the city override set first.
    onCitySelect(city);
    navigate("planner");
  };

  const discoveryStatus = (() => {
    if (!discoveryCategory) return null;
    const label = DISCOVERY_META[discoveryCategory].label.toLowerCase();
    if (discoveringPlaces) {
      return `Mapping ${label} near visible destinations · ${resolvedCities}/${totalCities}`;
    }
    if (discoveredPlaces.length === 0) {
      return `No additional ${label} are available for this view.`;
    }
    return `${discoveredPlaces.length} additional ${label} mapped.`;
  })();

  return (
    <main className="wr-map-screen">
      <div className="wr-map-layout">
        <aside className="wr-map-panel" aria-label="Map explorer controls">
          <header className="wr-map-heading">
            <span className="wr-kicker">
              <Compass aria-hidden="true" size={14} />
              Island explorer
            </span>
            <h1>Explore Sri Lanka by place.</h1>
            <p>
              Filter destinations, reveal listed stays, or search nearby places on
              the live map.
            </p>
          </header>

          <div className="wr-map-search">
            <label className="wr-visually-hidden" htmlFor="map-city-search">
              Search destinations
            </label>
            <Search aria-hidden="true" size={17} />
            <input
              id="map-city-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search destinations"
              autoComplete="off"
            />
            {search && (
              <button
                type="button"
                className="wr-icon-button"
                onClick={() => setSearch("")}
                aria-label="Clear destination search"
              >
                <X aria-hidden="true" size={15} />
              </button>
            )}
          </div>

          <fieldset className="wr-control-group">
            <legend>Destination type</legend>
            <div className="wr-filter-grid">
              {(Object.keys(FILTER_LABELS) as Category[]).map((category) => (
                <button
                  key={category}
                  type="button"
                  className="wr-filter-button"
                  aria-pressed={filter === category}
                  onClick={() => setFilter(category)}
                >
                  {FILTER_LABELS[category]}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="wr-control-group">
            <legend>Map layers</legend>
            <button
              type="button"
              className="wr-layer-toggle"
              aria-pressed={showHotels}
              onClick={() => setShowHotels((visible) => !visible)}
            >
              <span className="wr-layer-icon wr-layer-icon--gold">
                <Hotel aria-hidden="true" size={16} />
              </span>
              <span>
                <strong>Listed hotels</strong>
                <small>
                  {showHotels
                    ? `${allHotelPins.length} locations visible`
                    : "Reveal hotel markers"}
                </small>
              </span>
              <span className="wr-switch" aria-hidden="true" />
            </button>

            <div className="wr-discovery-heading">
              <span>Nearby place search</span>
              <small>Runs only when selected</small>
            </div>
            <div className="wr-discovery-grid">
              {(Object.keys(DISCOVERY_META) as DiscoveryCategory[]).map(
                (category) => {
                  const meta = DISCOVERY_META[category];
                  const Icon = meta.icon;
                  const active = discoveryCategory === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      className="wr-discovery-button"
                      aria-pressed={active}
                      onClick={() =>
                        setDiscoveryCategory(active ? null : category)
                      }
                      style={{ "--marker-color": meta.color } as CSSProperties}
                    >
                      <Icon aria-hidden="true" size={15} />
                      {meta.label}
                    </button>
                  );
                },
              )}
            </div>
            {discoveryStatus && (
              <p className="wr-map-status" role="status" aria-live="polite">
                <span className={discoveringPlaces ? "is-loading" : ""} />
                {discoveryStatus}
              </p>
            )}
          </fieldset>

          <section className="wr-destination-results" aria-labelledby="map-results-title">
            <div className="wr-results-heading">
              <h2 id="map-results-title">Destinations</h2>
              <span>
                {visibleCities.length}/{Object.keys(CITY_COORDS).length}
              </span>
            </div>
            {visibleCities.length === 0 ? (
              <div className="wr-compact-empty">
                <MapPin aria-hidden="true" size={18} />
                <p>No destination matches this search and filter.</p>
              </div>
            ) : (
              <div className="wr-destination-list">
                {visibleCities.map(([city, location]) => {
                  const category = CITY_CATEGORIES[city] ?? "city";
                  const active = selection?.kind === "city" && selection.city === city;
                  return (
                    <button
                      type="button"
                      key={city}
                      className="wr-destination-row"
                      aria-current={active ? "location" : undefined}
                      onClick={() => setSelection({ kind: "city", city, location })}
                    >
                      <span
                        className="wr-destination-dot"
                        style={{ backgroundColor: MARKER_COLORS[category] }}
                      />
                      <span>
                        <strong>{city}</strong>
                        <small>{CATEGORY_LABELS[category]}</small>
                      </span>
                      <ArrowRight aria-hidden="true" size={14} />
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </aside>

        <section className="wr-map-stage" aria-label="Interactive Sri Lanka map">
          <div className="wr-map-frame wr-map-frame--explorer">
            <MapContainer
              center={SRI_LANKA_CENTER}
              zoom={SRI_LANKA_ZOOM}
              className="wr-leaflet-map"
              scrollWheelZoom
              attributionControl
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapFocus target={selectedTarget} zoom={selectedZoom} />

              {visibleCities.map(([city, location]) => {
                const category = CITY_CATEGORIES[city] ?? "city";
                const color = MARKER_COLORS[category];
                const selected = selection?.kind === "city" && selection.city === city;
                const hotelCount = (HOTELS_BY_CITY[city] || []).length;
                return (
                  <Marker
                    key={city}
                    position={location}
                    icon={createColorMarker(color, selected ? 18 : 14)}
                    eventHandlers={{
                      click: () => setSelection({ kind: "city", city, location }),
                    }}
                  >
                    <Popup>
                      <div className="wr-map-popup">
                        <span className="wr-popup-eyebrow">
                          {CATEGORY_LABELS[category]}
                        </span>
                        <strong>{city}</strong>
                        {hotelCount > 0 && (
                          <p>
                            {hotelCount} listed hotel{hotelCount === 1 ? "" : "s"}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => selectCityAndPlan(city)}
                        >
                          Plan from {city}
                          <ArrowRight aria-hidden="true" size={13} />
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

              {showHotels &&
                allHotelPins.map((hotel, index) => {
                  const selected =
                    selection?.kind === "hotel" &&
                    selection.hotel.city === hotel.city &&
                    selection.hotel.name === hotel.name;
                  return (
                    <Marker
                      key={`${hotel.city}-${hotel.name}-${index}`}
                      position={hotel.location}
                      icon={createHotelMarker(
                        hotel.type as "budget" | "comfort" | "luxury",
                      )}
                      opacity={selected ? 1 : 0.9}
                      eventHandlers={{ click: () => setSelection({ kind: "hotel", hotel }) }}
                    >
                      <Popup>
                        <div className="wr-map-popup">
                          <span className="wr-popup-eyebrow">Listed hotel</span>
                          <strong>{hotel.name}</strong>
                          <p>{hotel.city}</p>
                          {Number.isFinite(hotel.priceUSD) && hotel.priceUSD > 0 && (
                            <p className="wr-popup-price">From ${hotel.priceUSD} / night</p>
                          )}
                          {hotel.bookingUrl && (
                            <a
                              href={hotel.bookingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Open hotel page
                              <ArrowRight aria-hidden="true" size={13} />
                            </a>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

              {discoveryCategory &&
                discoveredPlaces.map((place) => (
                  <Marker
                    key={place.fsqId}
                    position={place.location}
                    icon={createColorMarker(
                      DISCOVERY_META[discoveryCategory].color,
                      selection?.kind === "place" &&
                        selection.place.fsqId === place.fsqId
                        ? 14
                        : 10,
                    )}
                    eventHandlers={{ click: () => setSelection({ kind: "place", place }) }}
                  >
                    <Popup>
                      <div className="wr-map-popup">
                        <span className="wr-popup-eyebrow">
                          {DISCOVERY_META[discoveryCategory].singular}
                        </span>
                        <strong>{place.name}</strong>
                        {(place.address || place.city) && (
                          <p>{place.address || place.city}</p>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                ))}
            </MapContainer>

            <div className="wr-map-legend" aria-label="Map marker legend">
              <span>
                <i className="is-start" /> Destination
              </span>
              {showHotels && (
                <span>
                  <i className="is-hotel" /> Hotel
                </span>
              )}
              {discoveryCategory && (
                <span>
                  <i
                    style={{
                      backgroundColor: DISCOVERY_META[discoveryCategory].color,
                    }}
                  />
                  Nearby {DISCOVERY_META[discoveryCategory].label.toLowerCase()}
                </span>
              )}
            </div>

            {selection && (
              <aside className="wr-map-selection" aria-live="polite">
                <button
                  type="button"
                  className="wr-icon-button wr-selection-close"
                  onClick={() => setSelection(null)}
                  aria-label="Close selected place details"
                >
                  <X aria-hidden="true" size={16} />
                </button>

                {selection.kind === "city" && (
                  <>
                    <span className="wr-selection-kicker">
                      {CATEGORY_LABELS[CITY_CATEGORIES[selection.city] ?? "city"]}
                    </span>
                    <h2>{selection.city}</h2>
                    <p>Select this destination as the starting point for a new route.</p>
                    <button
                      type="button"
                      className="wr-inline-cta"
                      onClick={() => selectCityAndPlan(selection.city)}
                    >
                      Plan from here
                      <ArrowRight aria-hidden="true" size={14} />
                    </button>
                  </>
                )}

                {selection.kind === "hotel" && (
                  <>
                    <span className="wr-selection-kicker">Listed hotel</span>
                    <h2>{selection.hotel.name}</h2>
                    <p>{selection.hotel.city}</p>
                    {selection.hotel.bookingUrl && (
                      <a
                        className="wr-inline-cta"
                        href={selection.hotel.bookingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open hotel page
                        <ArrowRight aria-hidden="true" size={14} />
                      </a>
                    )}
                  </>
                )}

                {selection.kind === "place" && (
                  <>
                    <span className="wr-selection-kicker">
                      {DISCOVERY_META[selection.place.category].singular}
                    </span>
                    <h2>{selection.place.name}</h2>
                    <p>{selection.place.address || selection.place.city}</p>
                  </>
                )}
              </aside>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
