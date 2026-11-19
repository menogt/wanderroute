import { useEffect, useRef } from "react";
import L from "leaflet";
import { SRI_LANKA_CENTER, SRI_LANKA_ZOOM, TILE_LAYER } from "../rl/mapConfig";
import { categoryForCity, createCategoryPin, createStopPin, ROUTE_UNDERLAY } from "../rl/mapPins";
import { locations, studioPlaces } from "../../lib/tripStudio/catalog";
import { formatEndpoint, type StudioPlan } from "../../lib/tripStudio/model";

export function StudioMap({ plan, geometry, browse }: {
  plan: StudioPlan;
  geometry?: [number, number][];
  browse: (town: string) => void;
}) {
  const node = useRef<HTMLDivElement>(null);
  const overlay = useRef<L.LayerGroup | undefined>(undefined);
  const browseHandler = useRef(browse);
  browseHandler.current = browse;
  useEffect(() => {
    if (!node.current) return;
    const current = L.map(node.current, { scrollWheelZoom: false }).setView(SRI_LANKA_CENTER, SRI_LANKA_ZOOM);
    L.tileLayer(TILE_LAYER.url, { attribution: TILE_LAYER.attribution, maxZoom: TILE_LAYER.maxZoom }).addTo(current);
    overlay.current = L.layerGroup().addTo(current);
    let hadVisibleSize = false;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry.contentRect.width || !entry.contentRect.height) return;
      current.invalidateSize({ pan: hadVisibleSize });
      if (!hadVisibleSize) {
        current.setView(SRI_LANKA_CENTER, SRI_LANKA_ZOOM, { animate: false });
        hadVisibleSize = true;
      }
    });
    observer.observe(node.current);
    return () => { observer.disconnect(); current.remove(); overlay.current = undefined; };
  }, []);

  const routeKey = JSON.stringify([plan.start, plan.end, plan.bases.map(base => base.place)]);
  useEffect(() => {
    const layer = overlay.current;
    if (!layer) return;
    layer.clearLayers();
    if (geometry && geometry.length >= 2) {
      L.polyline(geometry, ROUTE_UNDERLAY).addTo(layer);
      L.polyline(geometry, { color: "#70520d", weight: 4, dashArray: "1 9", lineCap: "round" }).addTo(layer);
    }
    const numbers = new Map(plan.bases.map((base, index) => [base.place, index + 1]));
    for (const place of studioPlaces.filter(item => item.kind === "destination")) {
      const coordinates = locations[place.id].coordinates!;
      const index = numbers.get(place.id);
      const icon = index ? createStopPin(index, "#17354a") : createCategoryPin(categoryForCity(place.id));
      const marker = L.marker([coordinates.latitude, coordinates.longitude], { icon, title: place.name, alt: place.name })
        .on("click", () => browseHandler.current(place.id)).addTo(layer);
      marker.getElement()?.setAttribute("aria-label", `Explore ${place.name}`);
    }
    for (const id of new Set([plan.start, plan.end])) {
      if (!id || numbers.has(id)) continue;
      const coords = locations[id]?.coordinates;
      if (!coords) continue;
      L.circleMarker([coords.latitude, coords.longitude], { radius: 9, weight: 2, color: "#071a2d",
        fillColor: "#d4a64a", fillOpacity: 1 }).bindTooltip(formatEndpoint(id)).addTo(layer);
    }
  }, [routeKey, geometry]);
  return <div ref={node} className="wr-studio__map" aria-label="Interactive map of Sri Lanka" />;
}
