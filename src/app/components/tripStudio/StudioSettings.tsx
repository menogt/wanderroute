import { useState, type FormEvent } from "react";
import { locations } from "../../lib/tripStudio/catalog";
import { changeDateMode, studioCalendar, type StudioDates } from "../../lib/tripStudio/dates";
import { formatEndpoint, modes, type StudioPlan } from "../../lib/tripStudio/model";

type Props = { plan: StudioPlan; apply: (plan: StudioPlan) => void };

// These fields represent an unapplied edit. All other views read only the saved plan.
export function StudioSettings({ plan, apply }: Props) {
  const allocatedDays = plan.bases.reduce((sum, base) => sum + base.nights, 0) + 1;
  const [dates, setDates] = useState(plan.dates);
  const [start, setStart] = useState(plan.start ?? "");
  const [end, setEnd] = useState(plan.end ?? "");
  const [pace, setPace] = useState(plan.pace);
  const [mode, setMode] = useState(plan.mode);
  const [error, setError] = useState("");
  const calendar = studioCalendar(dates);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (calendar.issue) return setError(calendar.issue);
    if ([start, end].some(id => id.startsWith("custom:") && !id.slice(7).trim())) {
      return setError("Name your custom starting or ending location.");
    }
    apply({ ...plan, dates, start: start.trim() || null, end: end.trim() || null, pace, mode });
    setError("");
  }
  return <form className="wr-studio__settings" onSubmit={submit}>
    <div className="wr-studio__field-grid">
      <label>Travel dates
        <select aria-label="Travel dates" value={dates.kind} onChange={event => {
          setDates(changeDateMode(dates, event.target.value as StudioDates["kind"], allocatedDays));
          setError("");
        }}>
          <option value="unset">I’m still exploring</option>
          <option value="approximate">I know the month and year</option>
          <option value="exact">I know both dates</option>
          <option value="partial">I know one date</option>
        </select>
      </label>
      {dates.kind === "approximate" && <>
        <label>Travel month and year<input required type="month" value={dates.period}
          onChange={event => setDates({ ...dates, period: event.target.value })} /></label>
        <label>Calendar days<input required type="number" min={2} max={21} value={dates.days || ""}
          onChange={event => setDates({ ...dates, days: Number(event.target.value) })} /></label>
      </>}
      {dates.kind === "exact" && <>
        <label>Arrival date<input type="date" required value={dates.arrival}
          onChange={event => setDates({ ...dates, arrival: event.target.value })} /></label>
        <label>Departure date<input type="date" required value={dates.departure}
          onChange={event => setDates({ ...dates, departure: event.target.value })} /></label>
        <label>Arrival time (optional)<input type="time" value={dates.arrivalTime ?? ""}
          onChange={event => setDates({ ...dates, arrivalTime: event.target.value || undefined })} /></label>
        <label>Departure time (optional)<input type="time" value={dates.departureTime ?? ""}
          onChange={event => setDates({ ...dates, departureTime: event.target.value || undefined })} /></label>
      </>}
      {dates.kind === "partial" && <>
        <label>Date you know<select aria-label="Date you know" value={dates.anchor}
          onChange={event => setDates({ ...dates, anchor: event.target.value as "arrival" | "departure", date: "", time: undefined })}>
          <option value="arrival">Arrival</option><option value="departure">Departure</option></select></label>
        <label>Known {dates.anchor} date<input required type="date" value={dates.date}
          onChange={event => setDates({ ...dates, date: event.target.value })} /></label>
        <label>Known {dates.anchor} time (optional)<input type="time" value={dates.time ?? ""}
          onChange={event => setDates({ ...dates, time: event.target.value || undefined })} /></label>
        <label>Calendar days<input required type="number" min={2} max={21} value={dates.days || ""}
          onChange={event => setDates({ ...dates, days: Number(event.target.value) })} /></label>
      </>}
    </div>
    {calendar.days && <p className="wr-studio__hint" role="status">{calendar.days} calendar days · {calendar.nights} nights
      {calendar.provisional && ` · Provisional ${calendar.provisional}: ${calendar.provisional === "arrival" ? calendar.start : calendar.end}`}</p>}
    {dates.kind === "exact" || dates.kind === "partial" ? <p className="wr-studio__hint">Dates and times follow Sri Lanka local time.</p> : null}
    {!start && !end && <button type="button" className="wr-studio__button" onClick={() => { setStart("CMB_AIRPORT"); setEnd("CMB_AIRPORT"); }}>
      Flying in and out of CMB
    </button>}
    <div className="wr-studio__field-grid">
      <Endpoint label="Start location" value={start} change={setStart} />
      <Endpoint label="End location" value={end} change={setEnd} />
      <label>Pace<select aria-label="Pace" value={pace} onChange={event => setPace(event.target.value as StudioPlan["pace"])}>
        <option value="relaxed">Relaxed · shorter driving days</option>
        <option value="balanced">Balanced</option>
        <option value="fast">Faster · longer driving days</option>
      </select></label>
      <label>Default transport<select aria-label="Default transport" value={mode} onChange={event => setMode(event.target.value as StudioPlan["mode"])}>
        {Object.entries(modes).map(([id, name]) => <option value={id} key={id}>{name}</option>)}
      </select></label>
    </div>
    {error && <p role="alert" className="wr-studio__error">{error}</p>}
    <button className="wr-studio__button wr-studio__button--primary" type="submit">Apply journey settings</button>
  </form>;
}
function Endpoint({ label, value, change }: { label: string; value: string; change: (value: string) => void }) {
  const custom = value.startsWith("custom:");
  return <div className="wr-studio__endpoint"><label>{label}
    <select aria-label={label} value={custom ? "custom:" : value} onChange={event => change(event.target.value)}>
      <option value="">Choose later</option>
      {Object.keys(locations).sort((a, b) => {
        const index = (id: string) => id === "CMB_AIRPORT" ? 0 : id === "MATTALA" ? 1 : 2;
        return index(a) - index(b) || a.localeCompare(b);
      }).map(id => <option key={id} value={id}>{formatEndpoint(id)}</option>)}
      <option value="custom:">Other hotel or location</option>
    </select></label>
    {custom && <label>{label} name<input required maxLength={100} value={value.slice(7)}
      onChange={event => change("custom:" + event.target.value)} /></label>}
  </div>;
}
