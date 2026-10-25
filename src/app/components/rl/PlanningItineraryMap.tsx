import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import type { DetailedPlanningResult } from "../../lib/planningV2Itinerary";
import type { TripBriefV1 } from "../../lib/planningTypes";
import { fetchRoadRoute } from "../../lib/osrmRoute";
import { resolvePlanningEndpoint } from "../../lib/planningV2Locations";
import { getCityCoords, SRI_LANKA_CENTER, TILE_LAYER } from "./mapConfig";
import { createCategoryPin, createStayPin, createStopPin, categoryForCity, ROUTE_UNDERLAY } from "./mapPins";

type Point = [number, number];
function MapViewport({ positions, fitKey }: { positions: Point[]; fitKey: string }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length) map.fitBounds(L.latLngBounds(positions), { padding: [45, 45], maxZoom: 13, animate: false });
    // Deliberate fit only. Selecting an activity must not reset a user's zoom.
  }, [map, fitKey]);
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

/** Shares Classic road geometry and atlas styling. Geometry never supplies schedule times. */
export function PlanningItineraryMap({ detail, brief, activeDay, selectedItemId, onDay, onItem }: {
  detail: DetailedPlanningResult; brief: TripBriefV1; activeDay: number; selectedItemId?: string;
  onDay: (day: number) => void; onItem: (id: string) => void;
}) {
  const [scope, setScope] = useState<"trip" | "day">("trip");
  useEffect(() => { if (selectedItemId) setScope("day"); }, [selectedItemId]);
  const [fit, setFit] = useState(0);
  const [tileError, setTileError] = useState(false);
  const { itinerary } = detail;
  const day = itinerary.days[activeDay - 1] ?? itinerary.days[0];
  const stops = itinerary.cities.map((city, index) => ({ city, index, coords: getCityCoords(city),
    nights: itinerary.days.filter(day => day.overnightCity === city).length }));
  const endpoints = [brief.arrival?.location, brief.departure?.location].map(location => {
    const endpoint = location ? resolvePlanningEndpoint(location) : undefined;
    return endpoint?.coordinates ? { name: endpoint.name, coords: [endpoint.coordinates.latitude, endpoint.coordinates.longitude] as Point }
      : location && getCityCoords(location) ? { name: location, coords: getCityCoords(location)! } : undefined;
  });
  const visits = itinerary.days.filter(day => day.visitCity).map(day => ({ day: day.day, city: day.visitCity!, base: day.city, coords: getCityCoords(day.visitCity!) }));
  const journey = itinerary.days.flatMap((day, index) => [
    ...(index === 0 || itinerary.days[index - 1].city !== day.city ? [getCityCoords(day.city)] : []),
    ...(day.visitCity ? [getCityCoords(day.visitCity), getCityCoords(day.city)] : []),
  ]);
  const route: Point[] = [endpoints[0]?.coords, ...journey, endpoints[1]?.coords].filter((p): p is Point => !!p);
  const activities = day.items.filter(item => item.coordinates);
  const stay = detail.places.find(place => place.databaseId === day.accommodationPlaceId);
  const stayPoint: Point | undefined = stay?.coordinates ? [stay.coordinates.latitude, stay.coordinates.longitude] : undefined;
  const dayPoints: Point[] = [...activities.map(item => [item.coordinates!.latitude, item.coordinates!.longitude] as Point),
    day.visitCity ? getCityCoords(day.visitCity) : undefined,
    stayPoint ?? getCityCoords(day.city)].filter((p): p is Point => !!p);
  const positions = scope === "trip" ? route : dayPoints;
  const fitKey = `${scope}:${scope === "day" ? `${day.day}:${day.visitCity ?? day.city}` : `${itinerary.cities.join("|")}:${visits.map(visit => `${visit.day}-${visit.city}`).join("|")}`}:${fit}`;
  const missing = day.items.filter(item => item.category === "activity" && !item.isFreeTime && !item.coordinates).length;
  const activityTracks = activities.map(item => [item.coordinates!.latitude, item.coordinates!.longitude] as Point);
  const tracks = scope === "trip" ? route : day.visitCity ? [stayPoint ?? getCityCoords(day.city),
    ...(activityTracks.length ? activityTracks : [getCityCoords(day.visitCity)]), stayPoint ?? getCityCoords(day.city)]
    .filter((point): point is Point => !!point) : activityTracks;
  const trackKey = JSON.stringify(tracks);
  const [routing, setRouting] = useState<{ key: string; geometry: Point[] | null }>();
  useEffect(() => {
    let current = true;
    const waypoints: Point[] = JSON.parse(trackKey);
    if (waypoints.length > 1) {
      fetchRoadRoute(waypoints).then(geometry => { if (current) setRouting({ key: trackKey, geometry }); });
    }
    return () => { current = false; };
  }, [trackKey]);
  const settled = routing?.key === trackKey;
  const roadGeometry = settled ? routing.geometry : null;
  const tileEvents = useMemo(() => ({ tileerror: () => setTileError(true) }), []);
  return <section className="wr-v2-map" aria-label="Interactive itinerary map">
    <div className="wr-v2-map__toolbar">
      <button type="button" aria-pressed={scope === "trip"} onClick={() => { setScope("trip"); setFit(value => value + 1); }}>Fit route</button>
      <button type="button" aria-pressed={scope === "day"} onClick={() => { setScope("day"); setFit(value => value + 1); }}>Fit day {day.day}</button>
    </div>
    <MapContainer center={SRI_LANKA_CENTER} zoom={7} className="wr-v2-map__canvas" scrollWheelZoom={false}>
      <TileLayer {...TILE_LAYER} eventHandlers={tileEvents} />
      <MapViewport positions={positions} fitKey={fitKey} />
      {roadGeometry && <><Polyline positions={roadGeometry} pathOptions={ROUTE_UNDERLAY} />
        <Polyline positions={roadGeometry} pathOptions={{ color: "#D4A64A", weight: 3, dashArray: "8 7", lineCap: "round" }} /></>}
      {stops.filter(stop => scope === "trip" || stop.city === day.city).map(stop => stop.coords && <Marker key={stop.city} title={stop.city} alt={stop.city} position={stop.coords}
        icon={createCategoryPin(categoryForCity(stop.city), { selected: stop.city === day.city })}
        eventHandlers={{ click: () => onDay(itinerary.days.find(day => day.city === stop.city)!.day) }}>
        <Tooltip permanent className="wr-pin-label">{stop.index + 1}. {stop.city}</Tooltip>
        <Popup><strong>{stop.city}</strong><p>{stop.nights} nights · Proposed base</p></Popup>
      </Marker>)}
      {scope === "trip" && endpoints.map((endpoint, index) => endpoint && <Marker key={`endpoint-${index}`} title={endpoint.name} alt={endpoint.name} position={endpoint.coords}
        icon={createCategoryPin("city", { icon: index === 0 ? "arrival" : "flag", color: "#D4A64A" })}>
        <Popup>{index === 0 ? "Arrival" : "Departure"}: {endpoint.name}</Popup>
      </Marker>)}
      {visits.filter(visit => scope === "trip" || visit.day === day.day).map(visit => visit.coords && <Marker key={`visit-${visit.day}`} title={`${visit.city} day visit`} alt={`${visit.city} day visit`} position={visit.coords}
        icon={createCategoryPin(categoryForCity(visit.city), { color: "#4F6F52", selected: visit.day === day.day })} eventHandlers={{ click: () => onDay(visit.day) }}>
        <Tooltip className="wr-pin-label">{visit.city} · day {visit.day}</Tooltip><Popup><strong>{visit.city}</strong><p>Day {visit.day} visit · return to {visit.base}. Transfers need confirmation.</p></Popup>
      </Marker>)}
      {scope === "day" && activities.map((item, index) => <Marker key={item.id} title={item.label} alt={item.label} position={[item.coordinates!.latitude, item.coordinates!.longitude]}
        icon={createStopPin(index + 1, "#4F6F52", { active: selectedItemId === item.id })}
        eventHandlers={{ click: () => onItem(item.id) }}><Popup><strong>{item.label}</strong><p>{item.time}</p></Popup></Marker>)}
      {scope === "day" && stayPoint && <Marker position={stayPoint} title={day.accommodation} alt={day.accommodation} icon={createStayPin()}><Popup>{day.accommodation} · Availability unconfirmed</Popup></Marker>}
    </MapContainer>
    <p role="status">{tracks.length < 2 ? "More mapped stops are needed to show a road track." : !settled ? "Finding the road route…" : roadGeometry ? "Road route connected. Dotted tracks are a driving-route overview, not confirmed rail, bus, walking services or journey times." : "Road geometry is unavailable. Mapped stops remain visible; no road track is shown."}{scope === "day" && missing > 0 ? ` ${missing} activities have no mapped coordinates.` : ""}</p>
    {tileError && <p role="status">Some map tiles could not load. Your itinerary remains available below.</p>}
  </section>;
}
