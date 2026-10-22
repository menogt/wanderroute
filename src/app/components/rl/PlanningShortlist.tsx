import type { DetailedPlanningResult } from "../../lib/planningV2Itinerary";
import type { PlanningV2Edit } from "../../lib/planningV2Editing";

export function PlanningShortlist({ detail, onEdit }: { detail: DetailedPlanningResult; onEdit: (edit: PlanningV2Edit) => void }) {
  if (!detail.unscheduledActivities?.length) return null;
  return <section className="wr-v2-customize" aria-label="Unscheduled activity shortlist">
    <h2>Saved for later</h2><p>These activities are outside the current schedule. Your choices are kept here so you can restore them.</p>
    <ul>{detail.unscheduledActivities.map(item => {
      const days = detail.itinerary.days.filter(day => day.city === item.city && day.items.filter(item => item.category === "activity").length < 6);
      return <li key={item.id}><strong>{item.label}</strong> · {item.city}
        {days.length ? <label>Restore {item.label} to a day<select value="" onChange={event => event.target.value && onEdit({ type: "restore", itemId: item.id, day: Number(event.target.value) })}>
          <option value="">Choose a day</option>{days.map(day => <option key={day.day} value={day.day}>Day {day.day} · {day.city}</option>)}
        </select></label> : <p>Add {item.city} back to your route to schedule this activity, or keep it for later.</p>}
      </li>;
    })}</ul>
  </section>;
}
