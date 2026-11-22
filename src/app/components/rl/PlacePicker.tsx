import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Landmark, MapPin, Plus, Search, X } from "lucide-react";
import { SELECTABLE_CITIES } from "../../lib/cityPlan";
import { citiesFromPlaces, MAX_REQUESTED_PLACES, pickablePlaces, searchPlaces,
  type PickablePlace, type RequestedPlace } from "../../lib/requestedPlaces";
import "../../../styles/place-picker.css";

const POPULAR_SHOWN = 8;
const MAX_TOWNS = 8;

/**
 * Travellers pick the places they want to see; the towns to stay in follow from them.
 * Towns can still be picked directly for anyone who doesn't know the places yet.
 */
export function PlacePicker({ places, onPlaces, towns, onTowns }: {
  places: RequestedPlace[];
  onPlaces: (next: RequestedPlace[]) => void;
  towns: string[];
  onTowns: (next: string[]) => void;
}) {
  const id = useId();
  const popular = useMemo(() => pickablePlaces(), []);
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickablePlace[]>([]);
  const [searching, setSearching] = useState(false);
  const request = useRef(0);
  const chosen = new Set(places.map(place => place.key));
  const full = places.length >= MAX_REQUESTED_PLACES;
  const route = citiesFromPlaces(places, towns);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) { setResults([]); setSearching(false); return; }
    const ticket = ++request.current;
    setSearching(true);
    const timer = setTimeout(() => {
      searchPlaces(text).then(found => { if (ticket === request.current) setResults(found); })
        .finally(() => { if (ticket === request.current) setSearching(false); });
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const toggle = (place: RequestedPlace) => {
    if (chosen.has(place.key)) onPlaces(places.filter(item => item.key !== place.key));
    else if (!full) onPlaces([...places, { key: place.key, name: place.name, city: place.city, source: place.source,
      ...(place.databaseId ? { databaseId: place.databaseId } : {}), ...(place.category ? { category: place.category } : {}) }]);
  };
  const toggleTown = (town: string) => onTowns(towns.includes(town) ? towns.filter(item => item !== town)
    : towns.length < MAX_TOWNS ? [...towns, town] : towns);
  const shown = showAll ? popular : popular.slice(0, POPULAR_SHOWN);

  return <div className="wr-picker">
    <div className="wr-picker__search">
      <label htmlFor={`${id}-search`}>Search places</label>
      <div className="wr-picker__search-box">
        <Search size={17} aria-hidden="true" />
        <input id={`${id}-search`} type="search" value={query} autoComplete="off" maxLength={60}
          placeholder="Try “Sigiriya”, “tea”, “waterfall”…" onChange={event => setQuery(event.target.value)}
          aria-describedby={`${id}-search-status`} />
      </div>
      <p id={`${id}-search-status`} className="wr-picker__status" aria-live="polite">
        {query.trim().length >= 2 ? searching ? "Searching places…" : results.length ? `${results.length} places found` : "No places found. Try another name." : ""}
      </p>
      {results.length > 0 && <ul className="wr-picker__results">
        {results.map(place => <li key={place.key}>
          <button type="button" onClick={() => toggle(place)} aria-pressed={chosen.has(place.key)} disabled={full && !chosen.has(place.key)}>
            {chosen.has(place.key) ? <Check size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
            <span><strong>{place.name}</strong><small>{place.city}</small></span>
          </button>
        </li>)}
      </ul>}
    </div>

    {places.length > 0 && <div className="wr-picker__chosen" aria-label="Places you chose">
      {places.map(place => <span key={place.key} className="wr-picker__chip">
        <MapPin size={14} aria-hidden="true" />{place.name} <small>{place.city}</small>
        <button type="button" onClick={() => toggle(place)} aria-label={`Remove ${place.name}`}><X size={14} aria-hidden="true" /></button>
      </span>)}
    </div>}

    <p className="wr-picker__label" id={`${id}-popular`}>Popular places</p>
    <ul className="wr-picker__grid" aria-labelledby={`${id}-popular`}>
      {shown.map(place => {
        const selected = chosen.has(place.key);
        return <li key={place.key}>
          <button type="button" className={`wr-picker__card${selected ? " is-selected" : ""}`} aria-pressed={selected}
            disabled={full && !selected} onClick={() => toggle(place)}>
            <span className="wr-picker__photo">
              {place.photo ? <img src={place.photo.url} alt="" loading="lazy" decoding="async" />
                : <Landmark size={28} aria-hidden="true" />}
              <span className="wr-picker__tick" aria-hidden="true">{selected ? <Check size={15} /> : <Plus size={15} />}</span>
            </span>
            <span className="wr-picker__name">{place.name}</span>
            <span className="wr-picker__town">{place.city}</span>
          </button>
          {place.photo && <a className="wr-picker__credit" href={place.photo.page} target="_blank" rel="noreferrer">
            Photo: {place.photo.credit} · {place.photo.licence}</a>}
        </li>;
      })}
    </ul>
    {popular.length > POPULAR_SHOWN && <button type="button" className="wr-picker__more" onClick={() => setShowAll(value => !value)}>
      {showAll ? "Show fewer places" : `Show all ${popular.length} places`}</button>}
    {full && <p className="wr-picker__status">You've chosen {MAX_REQUESTED_PLACES} places, the most for one trip.</p>}

    <details className="wr-picker__towns" open={towns.length > 0 && places.length === 0 ? true : undefined}>
      <summary>Or just pick towns</summary>
      <div className="wr-picker__town-list">
        {SELECTABLE_CITIES.map(town => <button type="button" key={town} className={towns.includes(town) ? "is-selected" : ""}
          aria-pressed={towns.includes(town)} onClick={() => toggleTown(town)}>{town}</button>)}
      </div>
    </details>

    <p className="wr-picker__route" aria-live="polite">{route.length
      ? <>Your trip will stay in or visit <strong>{route.join(" · ")}</strong>. We add the stops in between, as local tour operators do.</>
      : "Choose places, or leave this open and we'll suggest a classic route."}</p>
  </div>;
}
