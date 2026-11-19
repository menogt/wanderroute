import { useState, type FormEvent } from "react";
import { studioPlace } from "../../lib/tripStudio/catalog";
import { studioRooms } from "../../lib/tripStudio/costs";
import { studioCalendar } from "../../lib/tripStudio/dates";
import { canScheduleVisit, currencies, flightArrivalReserved, MAX_NIGHTS, stayWindow, studioDays,
  type StudioBase, type StudioPlan } from "../../lib/tripStudio/model";
import { amountFrom } from "./StudioBudget";
import { StudioSettings } from "./StudioSettings";

type Props = {
  plan: StudioPlan;
  apply: (plan: StudioPlan) => void;
  changeBases: (bases: StudioBase[]) => void;
  browse: () => void;
};
export function StudioJourney({ plan, apply, changeBases, browse }: Props) {
  const calendar = studioCalendar(plan.dates);
  const nights = plan.bases.reduce((sum, base) => sum + base.nights, 0);
  const days = studioDays(plan);
  const updateBase = (next: StudioBase) => changeBases(plan.bases.map(base => base.place === next.place ? next : base));
  function moveBase(index: number, offset: number) {
    const copy = [...plan.bases];
    [copy[index], copy[index + offset]] = [copy[index + offset], copy[index]];
    changeBases(copy);
  }
  function reorderVisit(place: string, target: string) {
    const copy = [...plan.visits];
    const from = copy.findIndex(visit => visit.place === place);
    const to = copy.findIndex(visit => visit.place === target);
    [copy[from], copy[to]] = [copy[to], copy[from]];
    apply({ ...plan, visits: copy });
  }
  return <>
    <header className="wr-studio__panel-heading">
      <h2>My Journey</h2><p>{calendar.days ? `${calendar.days} calendar days · ${nights} of ${calendar.nights} nights allocated`
        : `${nights} allocated ${nights === 1 ? "night" : "nights"} · dates open`}</p>
    </header>
    <details className="wr-studio__detail" open={plan.dates.kind === "unset" && !plan.start && !plan.end || undefined}>
      <summary>Dates, endpoints and pace</summary>
      <StudioSettings key={JSON.stringify([plan.dates, plan.start, plan.end, plan.pace, plan.mode])} plan={plan} apply={apply} />
    </details>
    <h3>Overnight bases</h3>
    {!plan.bases.length && <p>Choose a place to stay, or start with an outline in My Places.</p>}
    <ol className="wr-studio__bases">
      {plan.bases.map((base, index) => <li key={base.place}>
        <div className="wr-studio__base-title">
          <strong>{base.place}</strong>
          <span>{base.nights} {base.nights === 1 ? "night" : "nights"}{base.stay?.lock && " · locked"}</span>
        </div>
        <div className="wr-studio__actions">
          <button aria-label={`Remove one night in ${base.place}`} disabled={base.nights <= 1 || !!base.stay?.lock}
            onClick={() => updateBase({ ...base, nights: base.nights - 1 })}>− Night</button>
          <button aria-label={`Add one night in ${base.place}`} disabled={nights >= MAX_NIGHTS || !!base.stay?.lock}
            onClick={() => updateBase({ ...base, nights: base.nights + 1 })}>+ Night</button>
          <button aria-label={`Move ${base.place} earlier`} disabled={!index} onClick={() => moveBase(index, -1)}>↑</button>
          <button aria-label={`Move ${base.place} later`} disabled={index === plan.bases.length - 1} onClick={() => moveBase(index, 1)}>↓</button>
          <button aria-label={`Remove ${base.place} base`} disabled={!!base.stay?.lock}
            onClick={() => changeBases(plan.bases.filter(item => item.place !== base.place))}>Remove</button>
        </div>
        <StayEditor key={JSON.stringify(base.stay ?? null)} plan={plan} base={base} update={updateBase} />
      </li>)}
    </ol>
    <button className="wr-studio__button" onClick={browse}>Browse places to add</button>
    {!!days.length && <h3>Days and visits</h3>}
    <ol className="wr-studio__days">
      {days.map(day => <li key={day.key}>
        <strong>Day {day.number}{day.date && ` · ${day.date}`} · {day.base?.place ?? (day.key === "departure" ? "Departure" : "No base yet")}</strong>
        {day.number === 1 && flightArrivalReserved(plan) ? <p>Reserved for airport clearance, transfer and check-in.</p>
          : !day.visits.length && <p>{day.base ? "No visits scheduled." : day.key === "departure" ? "Keep time for the final transfer." : "Allocate an overnight base."}</p>}
        {!!day.visits.length && <ul>
          {day.visits.map((visit, index) => <li key={visit.place}>
            {studioPlace.get(visit.place)?.name}
            <div className="wr-studio__actions">
              <button aria-label={`Move ${studioPlace.get(visit.place)?.name} earlier today`} disabled={index === 0}
                onClick={() => reorderVisit(visit.place, day.visits[index - 1].place)}>↑</button>
              <button aria-label={`Move ${studioPlace.get(visit.place)?.name} later today`} disabled={index + 1 === day.visits.length}
                onClick={() => reorderVisit(visit.place, day.visits[index + 1].place)}>↓</button>
              <button aria-label={`Remove ${studioPlace.get(visit.place)?.name} visit`}
                onClick={() => apply({ ...plan, visits: plan.visits.filter(item => item.place !== visit.place) })}>Remove</button>
            </div>
            <label>Move {studioPlace.get(visit.place)?.name} to
              <select aria-label={`Move ${studioPlace.get(visit.place)?.name} to`} value={day.key}
                onChange={event => apply({ ...plan, visits: plan.visits.map(item => item.place === visit.place
                ? { ...item, dayKey: event.target.value } : item) })}>
                {days.filter(item => item.key === day.key || canScheduleVisit(plan, visit.place, item.key))
                  .map(item => <option key={item.key} value={item.key}>Day {item.number} · {item.base?.place}</option>)}
              </select>
            </label>
          </li>)}
        </ul>}
      </li>)}
    </ol>
    {!!days.length && <p className="wr-studio__hint">Visits are ordered ideas. Confirm opening hours, tickets and travel time before setting a schedule.</p>}
  </>;
}

function StayEditor({ plan, base, update }: { plan: StudioPlan; base: StudioBase; update: (base: StudioBase) => void }) {
  const [name, setName] = useState(base.stay?.name ?? "");
  const [rateId, setRateId] = useState(base.stay?.rateId ?? "");
  const [amount, setAmount] = useState(base.stay?.recorded?.amount);
  const [currency, setCurrency] = useState(base.stay?.recorded?.currency ?? plan.budget.currency);
  const [paid, setPaid] = useState(base.stay?.recorded?.paid ?? false);
  const dateWindow = stayWindow(plan, base);
  const canLock = dateWindow && dateWindow.checkOut <= (studioCalendar(plan.dates).end ?? "");
  function save(event: FormEvent) {
    event.preventDefault();
    const chosen = studioRooms.find(item => item.rate.id === rateId);
    const label = name.trim() || chosen?.rate.item || `${base.place} accommodation`;
    update({ ...base, stay: {
      name: label, lock: base.stay?.lock,
      rateId: chosen?.rate.id,
      recorded: amount === undefined ? undefined : { amount, currency, paid, nights: base.nights, checkIn: dateWindow?.checkIn },
    } });
  }
  return <details className="wr-studio__stay">
    <summary>{base.stay?.name || "Accommodation and booking lock"}</summary>
    {base.stay?.lock ? <div>
      <p>Locked {base.stay.lock.checkIn} to {base.stay.lock.checkOut}</p>
      <button className="wr-studio__button" onClick={() => update({ ...base, stay: { ...base.stay, lock: undefined } })}>Unlock this stay</button>
    </div> : <form onSubmit={save}>
      <label>Property name in {base.place} (optional)<input maxLength={100} value={name} onChange={event => setName(event.target.value)} /></label>
      {studioRooms.some(room => room.rate.region === base.place) && <label>Room price reference
        <select value={rateId} onChange={event => setRateId(event.target.value)}>
          <option value="">Choose later</option>
          {studioRooms.filter(room => room.rate.region === base.place).map(room =>
            <option key={room.rate.id} value={room.rate.id}>{room.rate.item}</option>)}
        </select></label>}
      <div className="wr-studio__field-grid">
        <label>Recorded stay total (optional)<input type="number" min={0} max={1e9} step="0.01" value={amount ?? ""}
          onChange={event => setAmount(amountFrom(event.target.value))} /></label>
        {amount !== undefined && <label>Stay price currency<select value={currency}
          onChange={event => setCurrency(event.target.value as typeof currency)}>
          {currencies.map(option => <option key={option}>{option}</option>)}</select></label>}
      </div>
      {amount !== undefined && <label className="wr-studio__check"><input type="checkbox" checked={paid}
        onChange={event => setPaid(event.target.checked)} /> Already paid</label>}
      <button type="submit" className="wr-studio__button">Save stay details</button>
    </form>}
    {!base.stay?.lock && (canLock && base.stay ? <>
      <button className="wr-studio__button" onClick={() => update({ ...base, stay: { ...base.stay!, lock: dateWindow } })}>Lock saved stay dates</button>
      <p className="wr-studio__hint">{dateWindow.checkIn} to {dateWindow.checkOut}. Lock only if you have booked these dates.</p>
    </> : <p className="wr-studio__hint">Save the stay and set exact trip dates to protect booked nights.</p>)}
  </details>;
}
