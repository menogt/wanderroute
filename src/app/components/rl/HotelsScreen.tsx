import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Dumbbell,
  Hotel,
  List,
  Map as MapIcon,
  MapPin,
  Sparkles,
  Utensils,
  Wifi,
  Waves,
} from "lucide-react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import { fetchHotels } from "../../lib/placesDb";
import { HOTELS_BY_CITY } from "./data";
import {
  AGODA_ENABLED,
  agodaLink,
  bookingLink,
} from "../../lib/affiliates";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import {
  CITY_CATEGORIES,
  MARKER_COLORS,
  getCityCoords,
} from "./mapConfig";
import { createColorMarker } from "./leafletSetup";
import { useFoursquareGeocoding } from "../../hooks/useFoursquareGeocoding";
import type { Screen, TravelStyle } from "./types";
import "../../../styles/map-hotels.css";

type HotelResult = {
  name: string;
  city?: string;
  stars?: number;
  priceUSD?: number;
  type: TravelStyle;
  amenities?: string[];
  area?: string;
  tip?: string;
  bookingUrl?: string;
  agodaUrl?: string;
  location?: [number, number];
};

const CITIES = [
  "Colombo",
  "Kandy",
  "Ella",
  "Mirissa",
  "Galle",
  "Sigiriya",
  "Nuwara Eliya",
  "Trincomalee",
  "Negombo",
  "Dambulla",
];

const STYLES: TravelStyle[] = ["budget", "comfort", "luxury"];
const STYLE_LABELS: Record<TravelStyle, string> = {
  budget: "Budget",
  comfort: "Comfort",
  luxury: "Luxury",
};

const AMENITY_ICONS: Record<string, React.ReactNode> = {
  WiFi: <Wifi aria-hidden="true" size={13} />,
  Pool: <Waves aria-hidden="true" size={13} />,
  Breakfast: <Utensils aria-hidden="true" size={13} />,
  Gym: <Dumbbell aria-hidden="true" size={13} />,
  Spa: <Sparkles aria-hidden="true" size={13} />,
};

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function tomorrowStr() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().split("T")[0];
}

function fallbackHotels(city: string): HotelResult[] {
  return ((HOTELS_BY_CITY as Record<string, HotelResult[]>)[city] ?? []).map(
    (hotel) => ({ ...hotel, city }),
  );
}

export function HotelsScreen({
  navigate: _navigate,
}: {
  navigate: (screen: Screen) => void;
}) {
  const [city, setCity] = useState("Colombo");
  const [style, setStyle] = useState<TravelStyle>("comfort");
  const [checkIn, setCheckIn] = useState(todayStr());
  const [checkOut, setCheckOut] = useState(tomorrowStr());
  const [selectedHotelIndex, setSelectedHotelIndex] = useState<number | null>(null);
  const [hotels, setHotels] = useState<HotelResult[]>([]);
  const [loadingHotels, setLoadingHotels] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const breakpoint = useBreakpoint();

  // Keep the established data flow: fetch every hotel for a city, then filter
  // the merged Supabase + listed data by style in the browser.
  useEffect(() => {
    let active = true;
    setLoadingHotels(true);
    fetchHotels(city)
      .then((results) => {
        if (!active) return;
        setHotels(results.length ? results : fallbackHotels(city));
      })
      .finally(() => {
        if (active) setLoadingHotels(false);
      });
    return () => {
      active = false;
    };
  }, [city]);

  const cityHotels = hotels.filter((hotel) => hotel.type === style);
  const visibleHotels = loadingHotels ? [] : cityHotels;

  const selectCity = (nextCity: string) => {
    setCity(nextCity);
    setSelectedHotelIndex(null);
  };

  const selectStyle = (nextStyle: TravelStyle) => {
    setStyle(nextStyle);
    setSelectedHotelIndex(null);
  };

  // Marker -> card remains index-coupled by design. Keep the hotel-${index}
  // target in HotelCard aligned with the exact array passed to HotelMap.
  const handleSelectHotel = (index: number) => {
    setSelectedHotelIndex(index);
    if (breakpoint === "mobile") setMobileView("list");
    setTimeout(() => {
      document
        .getElementById(`hotel-${index}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  };

  const handleShowOnMap = (index: number) => {
    setSelectedHotelIndex(index);
    if (breakpoint === "mobile") setMobileView("map");
  };

  const buildBookingUrl = (name: string, existingUrl?: string) =>
    bookingLink(name, city, checkIn, checkOut, existingUrl);

  const buildAgodaUrl = (name: string, existingUrl?: string) =>
    agodaLink(name, city, existingUrl);

  return (
    <main className="wr-hotels-screen">
      <header className="wr-hotels-header">
        <div className="wr-hotels-title">
          <span className="wr-kicker">
            <Hotel aria-hidden="true" size={14} />
            Stay finder
          </span>
          <h1>Find a practical base for your route.</h1>
          <p>
            Compare listed stays by destination and planning tier, then continue
            on a booking partner site for current details.
          </p>
        </div>

        <div className="wr-hotel-controls" aria-label="Hotel search controls">
          <label className="wr-hotel-field wr-hotel-field--city">
            <span>Destination</span>
            <span className="wr-select-wrap">
              <MapPin aria-hidden="true" size={15} />
              <select
                value={city}
                onChange={(event) => selectCity(event.target.value)}
              >
                {CITIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </span>
          </label>

          <fieldset className="wr-hotel-field wr-tier-field">
            <legend>Planning tier</legend>
            <div className="wr-tier-control">
              {STYLES.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={style === option}
                  data-tier={option}
                  onClick={() => selectStyle(option)}
                >
                  {STYLE_LABELS[option]}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="wr-hotel-field">
            <span>Check in</span>
            <span className="wr-date-wrap">
              <CalendarDays aria-hidden="true" size={14} />
              <input
                type="date"
                value={checkIn}
                min={todayStr()}
                onChange={(event) => setCheckIn(event.target.value)}
              />
            </span>
          </label>

          <label className="wr-hotel-field">
            <span>Check out</span>
            <span className="wr-date-wrap">
              <CalendarDays aria-hidden="true" size={14} />
              <input
                type="date"
                value={checkOut}
                min={checkIn || todayStr()}
                onChange={(event) => setCheckOut(event.target.value)}
              />
            </span>
          </label>
        </div>
      </header>

      <div className="wr-hotels-view-toggle" aria-label="Hotel view">
        <button
          type="button"
          aria-pressed={mobileView === "list"}
          onClick={() => setMobileView("list")}
        >
          <List aria-hidden="true" size={16} />
          Results
        </button>
        <button
          type="button"
          aria-pressed={mobileView === "map"}
          onClick={() => setMobileView("map")}
        >
          <MapIcon aria-hidden="true" size={16} />
          Map
        </button>
      </div>

      <div className="wr-hotels-workspace" data-mobile-view={mobileView}>
        <section className="wr-hotel-results-pane" aria-labelledby="hotel-results-title">
          <div className="wr-hotel-results-heading">
            <div>
              <span className="wr-section-index">Stay list · {city}</span>
              <h2 id="hotel-results-title">
                {STYLE_LABELS[style]} stays
              </h2>
            </div>
            {!loadingHotels && (
              <span className="wr-result-count" aria-live="polite">
                {cityHotels.length} listed
              </span>
            )}
          </div>

          {loadingHotels ? (
            <HotelLoadingState city={city} />
          ) : cityHotels.length === 0 ? (
            <HotelEmptyState city={city} style={style} />
          ) : (
            <div className="wr-hotel-list">
              {cityHotels.map((hotel, index) => (
                <HotelCard
                  key={`${hotel.name}-${index}`}
                  hotel={hotel}
                  index={index}
                  selected={selectedHotelIndex === index}
                  bookingUrl={buildBookingUrl(hotel.name, hotel.bookingUrl)}
                  agodaUrl={buildAgodaUrl(hotel.name, hotel.agodaUrl)}
                  onShowMap={() => handleShowOnMap(index)}
                />
              ))}
            </div>
          )}

          <AffiliateDisclosure />
        </section>

        <aside className="wr-hotel-map-pane" aria-label={`Hotel map for ${city}`}>
          <HotelMap
            hotels={visibleHotels}
            city={city}
            style={style}
            selectedIndex={selectedHotelIndex}
            onSelect={handleSelectHotel}
          />
        </aside>
      </div>
    </main>
  );
}

function HotelMapFocus({ target }: { target: [number, number] | null }) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      map.setView(target, 15);
      return;
    }
    map.flyTo(target, 15, { duration: 0.55 });
  }, [map, target]);

  return null;
}

function HotelMap({
  hotels,
  city,
  style,
  selectedIndex,
  onSelect,
}: {
  hotels: HotelResult[];
  city: string;
  style: TravelStyle;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}) {
  // Only missing coordinates are resolved. Existing static/Supabase coordinates
  // retain priority and query keys continue to mirror the card indexes.
  const queries = hotels
    .map((hotel, index) => ({ hotel, index }))
    .filter(({ hotel }) => !hotel.location)
    .map(({ hotel, index }) => ({
      key: `hotel-${index}`,
      placeName: hotel.name,
      city,
    }));

  const { coords: geocodedCoords, loading } =
    useFoursquareGeocoding(queries);

  const hotelCoords = hotels.map(
    (hotel, index) =>
      hotel.location || geocodedCoords[`hotel-${index}`] || null,
  );

  const cityCoords = getCityCoords(city);
  if (!cityCoords) return null;

  const category = CITY_CATEGORIES[city] ?? "city";
  const baseColor = MARKER_COLORS[category];
  const selectedHotel =
    selectedIndex !== null ? hotels[selectedIndex] ?? null : null;
  const selectedCoords =
    selectedIndex !== null ? hotelCoords[selectedIndex] ?? null : null;
  const locatedCount = hotelCoords.filter(Boolean).length;

  return (
    <div className="wr-hotel-map-shell">
      <div className="wr-map-context">
        <span>{city}</span>
        <strong>{STYLE_LABELS[style]} map</strong>
      </div>

      {loading && (
        <div className="wr-map-geocoding-status" role="status" aria-live="polite">
          <span className="is-loading" />
          Locating listed stays…
        </div>
      )}

      <MapContainer
        key={`${city}-${style}`}
        center={cityCoords}
        zoom={13}
        className="wr-leaflet-map"
        zoomControl
        scrollWheelZoom={false}
        attributionControl
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors &copy; CARTO"
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <HotelMapFocus target={selectedCoords} />

        {hotels.map((hotel, index) => {
          const coords = hotelCoords[index];
          if (!coords) return null;
          const selected = selectedIndex === index;
          return (
            <Marker
              key={`${hotel.name}-${index}`}
              position={coords}
              icon={createColorMarker(
                selected ? "#D4A64A" : baseColor,
                selected ? 17 : 12,
              )}
              eventHandlers={{ click: () => onSelect(index) }}
            >
              <Popup>
                <div className="wr-map-popup">
                  <span className="wr-popup-eyebrow">
                    {STYLE_LABELS[hotel.type]} stay
                  </span>
                  <strong>{hotel.name}</strong>
                  {hotel.area && <p>{hotel.area}</p>}
                  {typeof hotel.priceUSD === "number" &&
                    Number.isFinite(hotel.priceUSD) &&
                    hotel.priceUSD > 0 && (
                      <p className="wr-popup-price">
                        From ${hotel.priceUSD} / night
                      </p>
                    )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {!loading && hotels.length > 0 && locatedCount === 0 && (
        <div className="wr-map-neutral-state" role="status">
          <MapPin aria-hidden="true" size={18} />
          <span>Map locations are not available for this selection yet.</span>
        </div>
      )}

      {!loading && hotels.length === 0 && (
        <div className="wr-map-neutral-state">
          <MapPin aria-hidden="true" size={18} />
          <span>The map is ready when matching stays are listed.</span>
        </div>
      )}

      {selectedHotel && (
        <div className="wr-selected-hotel-map-card" aria-live="polite">
          <span>{STYLE_LABELS[selectedHotel.type]} stay</span>
          <strong>{selectedHotel.name}</strong>
          {selectedHotel.area && <small>{selectedHotel.area}</small>}
        </div>
      )}
    </div>
  );
}

function HotelCard({
  hotel,
  index,
  selected,
  bookingUrl,
  agodaUrl,
  onShowMap,
}: {
  hotel: HotelResult;
  index: number;
  selected: boolean;
  bookingUrl: string;
  agodaUrl: string;
  onShowMap: () => void;
}) {
  const hasPrice =
    typeof hotel.priceUSD === "number" &&
    Number.isFinite(hotel.priceUSD) &&
    hotel.priceUSD > 0;
  const amenities = hotel.amenities?.filter(Boolean) ?? [];

  return (
    <article
      id={`hotel-${index}`}
      className="wr-hotel-card"
      data-selected={selected ? "true" : "false"}
      data-tier={hotel.type}
    >
      <div className="wr-hotel-card-topline" />
      <div className="wr-hotel-card-body">
        <div className="wr-hotel-card-heading">
          <div>
            <span className="wr-tier-label">
              {STYLE_LABELS[hotel.type]} stay
            </span>
            <h3>{hotel.name}</h3>
            {hotel.area && (
              <p>
                <MapPin aria-hidden="true" size={13} />
                {hotel.area}
              </p>
            )}
          </div>

          {hasPrice && (
            <div className="wr-hotel-price">
              <small>Planning price</small>
              <strong>${hotel.priceUSD}</strong>
              <span>per night</span>
            </div>
          )}
        </div>

        {amenities.length > 0 && (
          <ul className="wr-amenity-list" aria-label="Listed amenities">
            {amenities.map((amenity, amenityIndex) => (
              <li key={`${amenity}-${amenityIndex}`}>
                {AMENITY_ICONS[amenity] ?? null}
                {amenity}
              </li>
            ))}
          </ul>
        )}

        {hotel.tip && (
          <div className="wr-hotel-note">
            <Sparkles aria-hidden="true" size={14} />
            <p>
              <strong>Local note</strong>
              {hotel.tip}
            </p>
          </div>
        )}

        <div className="wr-hotel-actions">
          <button type="button" className="wr-map-link" onClick={onShowMap}>
            <MapIcon aria-hidden="true" size={14} />
            Show on map
          </button>
          <a
            className="wr-booking-link"
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Booking.com
            <ArrowRight aria-hidden="true" size={14} />
          </a>
          {AGODA_ENABLED && (
            <a
              className="wr-agoda-link"
              href={agodaUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Agoda
              <ArrowRight aria-hidden="true" size={14} />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function HotelLoadingState({ city }: { city: string }) {
  return (
    <div className="wr-hotel-state" role="status" aria-live="polite">
      <span className="wr-route-loader" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <div>
        <strong>Loading stays in {city}</strong>
        <p>Preparing the list and map locations.</p>
      </div>
    </div>
  );
}

function HotelEmptyState({
  city,
  style,
}: {
  city: string;
  style: TravelStyle;
}) {
  return (
    <div className="wr-hotel-state wr-hotel-state--empty">
      <Hotel aria-hidden="true" size={20} />
      <div>
        <strong>No {STYLE_LABELS[style].toLowerCase()} stays listed in {city}</strong>
        <p>Try another planning tier or destination.</p>
      </div>
    </div>
  );
}

function AffiliateDisclosure() {
  return (
    <p className="wr-affiliate-disclosure">
      WanderRoute may earn a commission from bookings made through these links,
      at no extra cost to you. Confirm current prices and details on the booking
      site.
    </p>
  );
}
