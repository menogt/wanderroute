import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, MapPin, Route, WalletCards } from "lucide-react";
import { SELECTABLE_CITIES } from "../../lib/cityPlan";
import { MONTH_NAMES } from "../../lib/seasonData";
import { CMB_AIRPORT } from "../../lib/planningV2Locations";
import { knownPlanningDestinations } from "../../lib/routeCandidates";
import { validatePlanningBrief, type PlanningV2Issue } from "../../lib/planningV2";
import type { TripBriefV1, TravelPace } from "../../lib/planningTypes";
import type { TransportPreference } from "../../lib/transportTypes";
import type { Currency, Interest, TravelStyle } from "./types";
import "../../../styles/planning-v2.css";

const INTERESTS: { value: Interest; label: string }[] = [
  { value: "beaches", label: "Beaches" }, { value: "culture", label: "Culture" },
  { value: "wildlife", label: "Wildlife" }, { value: "hiking", label: "Hiking" },
  { value: "food", label: "Food" }, { value: "temples", label: "Temples" },
  { value: "adventure", label: "Adventure" }, { value: "photography", label: "Photography" },
];
const CURRENCIES: Currency[] = ["USD", "EUR", "GBP", "AUD", "LKR"];
const TRANSPORT: { value: TransportPreference; label: string }[] = [
  { value: "PRIVATE_DRIVER", label: "Private driver" },
  { value: "PUBLIC_TRANSPORT", label: "Public transport" },
  { value: "MIXED", label: "Mixed transport" },
  { value: "TUK_TUK_SELF_DRIVE", label: "Tuk-tuk / self-drive" },
  { value: "RECOMMEND", label: "Recommend for me" },
];
const ENDPOINTS = [CMB_AIRPORT, ...knownPlanningDestinations()];

export function PlanningV2BriefScreen({ initialBrief, busy, externalIssues, onPlan, onExit, onClassic }: {
  initialBrief?: TripBriefV1;
  busy: boolean;
  externalIssues: PlanningV2Issue[];
  onPlan: (brief: TripBriefV1) => void;
  onExit: () => void;
  onClassic: () => void;
}) {
  const [durationDays, setDurationDays] = useState(initialBrief?.durationDays ?? 7);
  const [travellerCount, setTravellerCount] = useState(initialBrief?.travellerCount ?? 2);
  const [budget, setBudget] = useState(initialBrief?.budget.amount ?? 1000);
  const [currency, setCurrency] = useState<Currency>(initialBrief?.budget.currency ?? "USD");
  const [interests, setInterests] = useState<Interest[]>(initialBrief?.interests ?? []);
  const [requestedCities, setRequestedCities] = useState<string[]>(initialBrief?.requestedCities ?? []);
  const [customCity, setCustomCity] = useState("");
  const [travelMonth, setTravelMonth] = useState(initialBrief?.travelMonth?.toString() ?? "");
  const [comfortTier, setComfortTier] = useState<TravelStyle | "">(initialBrief?.comfortTier ?? "");
  const [pace, setPace] = useState<TravelPace | "">(initialBrief?.pace ?? "");
  const [transportPreference, setTransportPreference] = useState<TransportPreference | "">(initialBrief?.transportPreference ?? "");
  const [arrivalLocation, setArrivalLocation] = useState(initialBrief?.arrival?.location === CMB_AIRPORT.id
    ? CMB_AIRPORT.name : initialBrief?.arrival?.location ?? "");
  const [arrivalTime, setArrivalTime] = useState(initialBrief?.arrival?.dateTime ?? "");
  const [departureLocation, setDepartureLocation] = useState(initialBrief?.departure?.location === CMB_AIRPORT.id
    ? CMB_AIRPORT.name : initialBrief?.departure?.location ?? "");
  const [departureTime, setDepartureTime] = useState(initialBrief?.departure?.dateTime ?? "");
  const [preferredDrive, setPreferredDrive] = useState(initialBrief?.maxPreferredDailyDrivingMinutes?.toString() ?? "");
  const [localIssues, setLocalIssues] = useState<PlanningV2Issue[]>([]);
  const issues = [...localIssues, ...externalIssues];

  const toggleInterest = (value: Interest) => setInterests(previous => previous.includes(value)
    ? previous.filter(item => item !== value) : [...previous, value]);
  const toggleCity = (city: string) => setRequestedCities(previous => previous.includes(city)
    ? previous.filter(item => item !== city) : previous.length < 8 ? [...previous, city] : previous);
  const addCity = () => {
    const value = customCity.trim();
    if (value && requestedCities.length < 8 && !requestedCities.some(city => city.toLowerCase() === value.toLowerCase())) {
      setRequestedCities(previous => [...previous, value]);
      setCustomCity("");
    }
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const brief: TripBriefV1 = {
      schemaVersion: 1, durationDays, travellerCount, budget: { amount: budget, currency },
      interests, requestedCities,
      ...(travelMonth ? { travelMonth: Number(travelMonth) } : {}),
      ...(comfortTier ? { comfortTier } : {}),
      ...(pace ? { pace } : {}),
      ...(transportPreference ? { transportPreference } : {}),
      ...(arrivalLocation.trim() || arrivalTime ? { arrival: {
        ...(arrivalLocation.trim() ? { location: arrivalLocation.trim() } : {}),
        ...(arrivalTime ? { dateTime: arrivalTime } : {}),
      } } : {}),
      ...(departureLocation.trim() || departureTime ? { departure: {
        ...(departureLocation.trim() ? { location: departureLocation.trim() } : {}),
        ...(departureTime ? { dateTime: departureTime } : {}),
      } } : {}),
      ...(preferredDrive ? { maxPreferredDailyDrivingMinutes: Number(preferredDrive) } : {}),
    };
    const errors = validatePlanningBrief(brief);
    setLocalIssues(errors);
    if (!errors.length) onPlan(brief);
  };

  return (
    <section className="wr-v2" aria-labelledby="wr-v2-brief-title">
      <div className="wr-v2__masthead">
        <div className="wr-v2__wrap">
          <button type="button" className="wr-v2__back" onClick={onExit}><ArrowLeft size={17} /> Back to home</button>
          <p className="wr-kicker">Route planning · Preview</p>
          <h1 id="wr-v2-brief-title">Start with the journey you want.</h1>
          <p>Compare practical route concepts before building a day-by-day plan. No booking or quote is created here.</p>
          <button type="button" className="wr-v2__text-link" onClick={onClassic}>Use Classic Planner</button>
        </div>
      </div>
      <form className="wr-v2__wrap wr-v2__brief" onSubmit={submit} noValidate>
        {issues.length > 0 && <div className="wr-v2__alert" role="alert" aria-live="assertive">
          <strong>Please check your trip brief.</strong>
          <ul>{issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.detail}</li>)}</ul>
        </div>}
        <div className="wr-v2__brief-grid">
          <div className="wr-v2__brief-main">
            <fieldset className="wr-v2__section">
              <legend><CalendarDays size={19} /> Trip essentials</legend>
              <div className="wr-v2__fields wr-v2__fields--three">
                <label>Days <input type="number" min="2" max="21" required value={durationDays}
                  onChange={event => setDurationDays(Number(event.target.value))} /></label>
                <label>Travellers <input type="number" min="1" max="12" required value={travellerCount}
                  onChange={event => setTravellerCount(Number(event.target.value))} /></label>
                <label>Travel month <select value={travelMonth} onChange={event => setTravelMonth(event.target.value)}>
                  <option value="">Not sure yet</option>
                  {MONTH_NAMES.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
                </select></label>
              </div>
            </fieldset>

            <fieldset className="wr-v2__section">
              <legend><WalletCards size={19} /> Total budget</legend>
              <div className="wr-v2__fields wr-v2__fields--budget">
                <label>Amount <input type="number" min="1" max="10000000" step="0.01" required value={budget}
                  onChange={event => setBudget(Number(event.target.value))} /></label>
                <label>Currency <select value={currency} onChange={event => setCurrency(event.target.value as Currency)}>
                  {CURRENCIES.map(value => <option key={value} value={value}>{value}</option>)}
                </select></label>
              </div>
              <p className="wr-v2__hint">This is for the whole group and trip. Route costs stay unpriced until sourced data is available.</p>
            </fieldset>

            <fieldset className="wr-v2__section">
              <legend>What interests you?</legend>
              <div className="wr-v2__choices">
                {INTERESTS.map(({ value, label }) => <button type="button" key={value}
                  className={interests.includes(value) ? "is-selected" : ""} aria-pressed={interests.includes(value)}
                  onClick={() => toggleInterest(value)}>{label}</button>)}
              </div>
              <p className="wr-v2__hint">Choose at least one to shape the route and its day-by-day draft.</p>
            </fieldset>

            <fieldset className="wr-v2__section">
              <legend><MapPin size={19} /> Destinations <small>optional</small></legend>
              <div className="wr-v2__choices">
                {SELECTABLE_CITIES.map(city => <button type="button" key={city}
                  className={requestedCities.includes(city) ? "is-selected" : ""} aria-pressed={requestedCities.includes(city)}
                  onClick={() => toggleCity(city)}>{city}</button>)}
              </div>
              <div className="wr-v2__custom-city">
                <label htmlFor="wr-v2-custom-city">Another destination</label>
                <input id="wr-v2-custom-city" value={customCity} maxLength={80} placeholder="Enter a town or city"
                  onChange={event => setCustomCity(event.target.value)} />
                <button type="button" onClick={addCity} disabled={!customCity.trim() || requestedCities.length >= 8}>Add</button>
              </div>
              {requestedCities.length > 0 && <p className="wr-v2__selected-cities">Selected: {requestedCities.join(" · ")}</p>}
              <p className="wr-v2__hint">Choose up to eight, or leave this open for a suggested route. Unknown places stay marked as unknown.</p>
            </fieldset>
          </div>

          <div className="wr-v2__brief-side">
            <fieldset className="wr-v2__section">
              <legend><Route size={19} /> Your travel approach <small>optional</small></legend>
              <label>Transport preference <select value={transportPreference}
                onChange={event => setTransportPreference(event.target.value as TransportPreference | "")}>
                <option value="">No preference selected</option>
                {TRANSPORT.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select></label>
              <p className="wr-v2__hint">Road-driving estimates are available. Public transport schedules and tuk-tuk travel times need confirmation.</p>
              <label>Comfort tier <select value={comfortTier} onChange={event => setComfortTier(event.target.value as TravelStyle | "")}>
                <option value="">No preference</option><option value="budget">Budget</option>
                <option value="comfort">Comfort</option><option value="luxury">Luxury</option>
              </select></label>
              <label>Travel pace <select value={pace} onChange={event => setPace(event.target.value as TravelPace | "")}>
                <option value="">Standard</option><option value="SLOW_TRAVEL">Slow travel</option>
                <option value="RELAXED">Relaxed</option><option value="BALANCED">Balanced</option>
                <option value="PACKED">Packed</option>
              </select></label>
              <label>Preferred daily driving limit <input type="number" min="30" max="720" value={preferredDrive}
                placeholder="Minutes, if important" onChange={event => setPreferredDrive(event.target.value)} /></label>
            </fieldset>

            <fieldset className="wr-v2__section">
              <legend>Arrival and departure <small>optional</small></legend>
              <datalist id="wr-v2-endpoints">
                {ENDPOINTS.map(point => <option key={point.id} value={point.name} />)}
              </datalist>
              <label>Arrival location <input list="wr-v2-endpoints" value={arrivalLocation}
                placeholder="Airport or city" onChange={event => setArrivalLocation(event.target.value)} /></label>
              <label>Arrival date and local time <input type="datetime-local" value={arrivalTime}
                onChange={event => setArrivalTime(event.target.value)} /></label>
              <label>Departure location <input list="wr-v2-endpoints" value={departureLocation}
                placeholder="Airport or city" onChange={event => setDepartureLocation(event.target.value)} /></label>
              <label>Departure date and local time <input type="datetime-local" value={departureTime}
                onChange={event => setDepartureTime(event.target.value)} /></label>
              <p className="wr-v2__hint">Leave anything unknown blank. Times are treated as Sri Lanka local time.</p>
            </fieldset>
          </div>
        </div>
        <div className="wr-v2__form-actions">
          <span>Compare route concepts first, then build a day-by-day draft from your choice.</span>
          <button className="wr-button wr-button--primary" type="submit" disabled={busy}>
            {busy ? "Checking routes…" : "Compare routes"} {!busy && <ArrowRight size={17} />}
          </button>
        </div>
      </form>
    </section>
  );
}
