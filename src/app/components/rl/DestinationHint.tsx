import { useState } from "react";
import "../../../styles/route-hint.css";
import { compareStopOrders, destinationHint } from "../../lib/destinationGuidance";
import { CMB_AIRPORT, resolvePlanningEndpoint } from "../../lib/planningV2Locations";
import { locations } from "../../lib/tripStudio/catalog";
import { knownPlanningDestinations } from "../../lib/routeCandidates";
import { fetchTravelMatrix, type MatrixLocation } from "../../lib/travelTimeMatrix";

const towns = [...knownPlanningDestinations(), ...Object.values(locations)];
const point = (name: string) => resolvePlanningEndpoint(name) ?? towns.find(town =>
  town.name.toLowerCase() === name.trim().toLowerCase() || town.id === name.trim());

type Props = { cities: string[]; days?: number; start?: string | null; end?: string | null; lockedOrder?: boolean };

export function DestinationHint(props: Props) {
  if (props.cities.length < 2) return null;
  return <SelectionHint key={JSON.stringify(props)} {...props} />;
}

function SelectionHint({ cities, days, start = CMB_AIRPORT.id, end = CMB_AIRPORT.id, lockedOrder }: Props) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const hint = destinationHint(cities, days);
  const first = start && point(start), last = end && point(end);
  const stops = cities.map(point);
  const comparable = first && last && cities.length <= 8 && stops.every(stop => stop?.coordinates);
  const label = (id: string) => id === CMB_AIRPORT.id ? "CMB airport" : id;
  async function compare() {
    if (!comparable || busy || !first || !last) return;
    setBusy(true);
    try {
      const route = stops as MatrixLocation[];
      const points = [...new Map([first, ...route, last].map(stop => [stop.id, stop])).values()];
      const matrix = await fetchTravelMatrix(points);
      const result = compareStopOrders(route.map(stop => stop.id), first.id, last.id, matrix);
      if (!result) setMessage("Road estimates are unavailable for part of this trip. You can keep planning.");
      else {
        const order = [label(first.id), ...cities, label(last.id)].filter((city, i, sequence) => !i || city !== sequence[i - 1]).join(" → ");
        const option = result.alternative;
        const comparison = option && !lockedOrder
          ? ` Going via ${option.order.map(label).join(" → ")} instead would save about ${Math.round(result.original - option.minutes)} minutes of driving with the same endpoints.` : "";
        const returnNote = result.finalDrive !== undefined && result.finalDrive >= 150
          ? ` The last leg to ${label(last.id)} is about ${Math.round(result.finalDrive / 6) / 10} hours by car. Consider keeping that part of your last day free.` : "";
        setMessage(`${order}: about ${Math.round(result.original / 6) / 10} hours by car between these places, excluding stops and live traffic.${comparison}${returnNote}`);
      }
    } catch { setMessage("Road estimates are unavailable. You can keep planning."); }
    finally { setBusy(false); }
  }
  if (!hint && !comparable) return null;
  return <aside className="wr-route-hint" aria-label="Route idea">
    {hint && <p>{hint.text} <a href={hint.source} target="_blank" rel="noreferrer">See an example itinerary</a></p>}
    {comparable && <button type="button" disabled={busy} onClick={compare}>{busy ? "Checking roads…" :
      first.id === last.id ? `Check the drive back to ${label(last.id)}` : `Check the drive to ${label(last.id)}`}</button>}
    <span role="status">{message}</span>
  </aside>;
}
