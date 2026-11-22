import type { DetailedPlanningResult } from "../../../lib/planningV2Itinerary";
import type { PlanningV2Edit } from "../../../lib/planningV2Editing";
import type { TripBriefV1 } from "../../../lib/planningTypes";
import { resolveRequestedPlaces } from "../../../lib/requestedPlaces";
import { MAX_PER_DAY } from "./BoardDay";
import { PlacePhoto } from "./PlacePhoto";
import { DraggableWaiting } from "./BoardDnd";

/**
 * Places waiting for a day: chosen places that didn't fit, and anything removed from a day.
 * Each can go back on a day in its town, from a list or by dragging it onto the day.
 */
export function PlacesToVisit({ detail, brief, onEdit }: {
  detail: DetailedPlanningResult; brief: TripBriefV1; onEdit: (edit: PlanningV2Edit) => void;
}) {
  const waiting = detail.unscheduledActivities ?? [];
  const missing = resolveRequestedPlaces(brief.requestedPlaces, detail.places).filter(entry => !entry.place);
  if (!waiting.length && !missing.length) return null;
  return <section id="wr-board-waiting" className="wr-board-section" aria-labelledby="wr-waiting-title">
    <h2 id="wr-waiting-title">Places to visit</h2>
    <p className="wr-board-section__lead">Not on a day yet. Add each to a day in its town, or drag it onto one.</p>
    <ul className="wr-waiting">
      {waiting.map(item => {
        const place = detail.places.find(entry => entry.databaseId === item.placeId);
        const days = detail.itinerary.days.filter(day => day.overnightCity && (day.visitCity ?? day.city).toLowerCase() === item.city.toLowerCase() &&
          day.items.filter(entry => entry.category === "activity").length < MAX_PER_DAY);
        const node = <div className="wr-waiting__item">
          <PlacePhoto name={item.label} city={item.city} category={place?.category} coordinates={place?.coordinates} className="wr-waiting__photo" />
          <div><strong>{item.label}</strong><span>{item.city}</span>
            {days.length ? <label>Add to a day<select value="" onChange={event => event.target.value && onEdit({ type: "restore", itemId: item.id, day: Number(event.target.value) })}>
              <option value="">Choose a day in {item.city}</option>{days.map(day => <option key={day.day} value={day.day}>Day {day.day}</option>)}
            </select></label> : <p>Add a night in {item.city} under Your route to fit this place.</p>}
          </div>
        </div>;
        return <li key={item.id}><DraggableWaiting id={item.id} label={item.label} city={item.city}>{node}</DraggableWaiting></li>;
      })}
      {missing.map(({ request }) => <li key={request.key}><div className="wr-waiting__item">
        <PlacePhoto name={request.name} city={request.city} className="wr-waiting__photo" />
        <div><strong>{request.name}</strong><span>{request.city}</span><p>We couldn't find this place's details just now. Try again later, or add it yourself to a day in {request.city}.</p></div>
      </div></li>)}
    </ul>
  </section>;
}
