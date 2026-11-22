import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import type { DetailedPlanningResult } from "../../../lib/planningV2Itinerary";
import type { TripBriefV1 } from "../../../lib/planningTypes";
import { fetchRoadRoute } from "../../../lib/osrmRoute";
import { resolvePlanningEndpoint } from "../../../lib/planningV2Locations";
import { getCityCoords, SRI_LANKA_CENTER, TILE_LAYER } from "../mapConfig";
import { createCategoryPin, createStopPin, categoryForCity, ROUTE_UNDERLAY } from "../mapPins";

type Point = [number, number];
/** One colour per day, chosen to stay readable on the topographic tiles; repeats after ten days. */
export const DAY_COLOURS = ["#C2412D", "#2F6FB2", "#3E8E41", "#8E44AD", "#C77700", "#00838F", "#AD1457", "#5D6D7E", "#6D4C41", "#1565C0"];
export const dayColour = (day: number) => DAY_COLOURS[(day - 1) % DAY_COLOURS.length];

function Viewport({ positions, fitKey }: { positions: Point[]; fitKey: string }) {
  const map = useMap();
  useEffect(() => {
    if (!positions.length) return;
    // One point (a town with no mapped places) gets a town-level zoom rather than street level.
    const timer = window.setTimeout(() => positions.length === 1 ? map.flyTo(positions[0], 11, { duration: 0.6 })
      : map.flyToBounds(L.latLngBounds(positions), { padding: [50, 50], maxZoom: 13, duration: 0.6 }), 250);
    return () => window.clearTimeout(timer);
    // Fit only when the focus changes, never on unrelated re-renders.
  }, [map, fitKey]);
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

/** All days on one map, numbered per day as in the list; the day being read is highlighted. */
export function BoardMap({ detail, brief, focusDay, highlightId, onFocusDay, onItem }: {
  detail: DetailedPlanningResult; brief: TripBriefV1; focusDay?: number; highlightId?: string;
  onFocusDay: (day?: number) => void; onItem: (itemId: string, day: number) => void;
}) {
  const { itinerary } = detail;
  const [tileError, setTileError] = useState(false);
  const tileEvents = useMemo(() => ({ tileerror: () => setTileError(true) }), []);
  const endpoints = [brief.arrival?.location, brief.departure?.location].map(location => {
    const endpoint = location ? resolvePlanningEndpoint(location) : undefined;
    return endpoint?.coordinates ? { name: endpoint.name, coords: [endpoint.coordinates.latitude, endpoint.coordinates.longitude] as Point }
      : location && getCityCoords(location) ? { name: location, coords: getCityCoords(location)! } : undefined;
  });
  const towns = itinerary.cities.map((city, index) => ({ city, index, coords: getCityCoords(city),
    days: itinerary.days.filter(day => day.city === city).map(day => day.day) }));
  const journey = itinerary.days.flatMap((day, index) => [
    ...(index === 0 || itinerary.days[index - 1].city !== day.city ? [getCityCoords(day.city)] : []),
    ...(day.visitCity ? [getCityCoords(day.visitCity), getCityCoords(day.city)] : []),
  ]);
  const route: Point[] = [endpoints[0]?.coords, ...journey, endpoints[1]?.coords].filter((point): point is Point => !!point);
  const pins = itinerary.days.flatMap(day => day.items.filter(item => item.category === "activity" && !item.isFreeTime)
    .map((item, index) => ({ item, day: day.day, number: index + 1 })).filter(pin => pin.item.coordinates));
  const focus = focusDay ? itinerary.days[focusDay - 1] : undefined;
  const focusPoints: Point[] = focus ? [...pins.filter(pin => pin.day === focus.day)
    .map(pin => [pin.item.coordinates!.latitude, pin.item.coordinates!.longitude] as Point),
    getCityCoords(focus.visitCity ?? focus.city)].filter((point): point is Point => !!point) : [];
  const fitPoints = focus && focusPoints.length ? focusPoints : route;
  const fitKey = focus ? `day:${focus.day}:${focusPoints.length}` : `trip:${itinerary.cities.join("|")}`;

  // The town-to-town road, plus the road between the focused day's places (one request at a time).
  const routeKey = JSON.stringify(route);
  const dayTrack = focus ? pins.filter(pin => pin.day === focus.day).map(pin => [pin.item.coordinates!.latitude, pin.item.coordinates!.longitude] as Point) : [];
  const dayKey = JSON.stringify(dayTrack);
  const [roads, setRoads] = useState<{ route?: { key: string; line: Point[] | null }; day?: { key: string; line: Point[] | null } }>({});
  useEffect(() => {
    let live = true;
    const waypoints: Point[] = JSON.parse(routeKey);
    if (waypoints.length > 1) fetchRoadRoute(waypoints).then(line => { if (live) setRoads(previous => ({ ...previous, route: { key: routeKey, line } })); });
    return () => { live = false; };
  }, [routeKey]);
  const dayTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    let live = true;
    const waypoints: Point[] = JSON.parse(dayKey);
    window.clearTimeout(dayTimer.current);
    if (waypoints.length > 1) dayTimer.current = window.setTimeout(() => fetchRoadRoute(waypoints)
      .then(line => { if (live) setRoads(previous => ({ ...previous, day: { key: dayKey, line } })); }), 600);
    return () => { live = false; window.clearTimeout(dayTimer.current); };
  }, [dayKey]);
  const routeLine = roads.route?.key === routeKey ? roads.route.line : null;
  const dayLine = roads.day?.key === dayKey ? roads.day.line : null;
  const unmapped = itinerary.days.flatMap(day => day.items).filter(item => item.category === "activity" && !item.isFreeTime && !item.coordinates).length;

  return <section className="wr-board-map" aria-label="Trip map">
    <div className="wr-board-map__days" role="group" aria-label="Show on the map">
      <button type="button" aria-pressed={!focusDay} onClick={() => onFocusDay(undefined)}>All days</button>
      {itinerary.days.map(day => <button type="button" key={day.day} aria-pressed={focusDay === day.day} onClick={() => onFocusDay(day.day)}>
        <span className="wr-board-map__swatch" style={{ background: dayColour(day.day) }} aria-hidden="true" />Day {day.day}</button>)}
    </div>
    <MapContainer center={SRI_LANKA_CENTER} zoom={7} className="wr-board-map__canvas" scrollWheelZoom>
      <TileLayer {...TILE_LAYER} eventHandlers={tileEvents} />
      <Viewport positions={fitPoints} fitKey={fitKey} />
      {routeLine && <><Polyline positions={routeLine} pathOptions={ROUTE_UNDERLAY} />
        <Polyline positions={routeLine} pathOptions={{ color: "#D4A64A", weight: 3, dashArray: "8 7", lineCap: "round", opacity: focus ? 0.55 : 1 }} /></>}
      {focus && dayLine && <Polyline positions={dayLine} pathOptions={{ color: dayColour(focus.day), weight: 4, opacity: 0.85 }} />}
      {towns.map(town => town.coords && <Marker key={town.city} position={town.coords} title={town.city} alt={town.city}
        icon={createCategoryPin(categoryForCity(town.city), { selected: !!focus && (focus.city === town.city || focus.visitCity === town.city) })}
        eventHandlers={{ click: () => onFocusDay(town.days[0]) }}>
        <Tooltip permanent className="wr-pin-label">{town.index + 1}. {town.city}</Tooltip>
        <Popup><strong>{town.city}</strong><p>Days {town.days.join(", ")}</p></Popup>
      </Marker>)}
      {!focus && endpoints.map((endpoint, index) => endpoint && <Marker key={`endpoint-${index}`} position={endpoint.coords} title={endpoint.name} alt={endpoint.name}
        icon={createCategoryPin("city", { icon: index === 0 ? "arrival" : "flag", color: "#D4A64A" })}>
        <Popup>{index === 0 ? "Arrival" : "Departure"}: {endpoint.name}</Popup>
      </Marker>)}
      {pins.map(pin => {
        const dim = !!focus && pin.day !== focus.day;
        return <Marker key={pin.item.id} position={[pin.item.coordinates!.latitude, pin.item.coordinates!.longitude]}
          title={`Day ${pin.day}, ${pin.number}. ${pin.item.label}`} alt={pin.item.label} opacity={dim ? 0.35 : 1} zIndexOffset={dim ? 0 : 500}
          icon={createStopPin(pin.number, dayColour(pin.day), { active: highlightId === pin.item.id })}
          eventHandlers={{ click: () => onItem(pin.item.id, pin.day) }}>
          <Tooltip className="wr-pin-label">Day {pin.day} · {pin.item.label}</Tooltip>
        </Marker>;
      })}
    </MapContainer>
    <p className="wr-board-map__note" role="status">{focus ? `Day ${focus.day}: ${focus.visitCity ? `${focus.visitCity} from ${focus.city}` : focus.city}. ` : "All days. "}
      Numbers match the places in each day.{unmapped ? ` ${unmapped} ${unmapped === 1 ? "place has" : "places have"} no map position yet.` : ""} Dotted lines are a driving overview, not timetables.</p>
    {tileError && <p className="wr-board-map__note" role="status">Some map tiles could not load. Your itinerary is still complete.</p>}
  </section>;
}
