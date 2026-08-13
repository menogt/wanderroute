import { useState, useEffect, type FormEvent } from "react";
import { Star, Trash2, Edit, Download, Plus, ArrowLeft, LogOut, Database, Hotel as HotelIcon } from "lucide-react";
import { useHotels } from "./useHotels";
import { seedPlacesFromFoursquare } from "../../lib/seedPlaces";
import { signInAdmin, signOutAdmin, getAdminSession, onAdminAuthChange } from "../../lib/adminAuth";
import type { Hotel, TravelStyle, Screen } from "./types";
import "../../../styles/secondary-screens.css";

const CITIES = [
  "Colombo", "Kandy", "Ella", "Mirissa", "Galle", "Sigiriya",
  "Nuwara Eliya", "Trincomalee", "Negombo", "Dambulla",
  "Anuradhapura", "Jaffna", "Hikkaduwa", "Arugam Bay", "Kalpitiya",
];

const ALL_AMENITIES = [
  "WiFi", "Pool", "Breakfast", "Gym", "Spa", "AC",
  "Restaurant", "Parking", "Beach Access", "Garden",
];

const EMPTY_FORM: Hotel = {
  name: "",
  city: CITIES[0],
  stars: 3,
  priceUSD: 0,
  type: "comfort",
  amenities: [],
  area: "",
  tip: "",
  bookingUrl: "",
  agodaUrl: "",
};

export function AdminScreen({ navigate }: { navigate: (s: Screen) => void }) {
  const { hotels, userHotels, addHotel, removeHotel, updateHotel, exportJSON } = useHotels();
  const [form, setForm] = useState<Hotel>({ ...EMPTY_FORM });
  const [editing, setEditing] = useState<{ name: string; city: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    getAdminSession().then((session) => setAuthed(!!session));
    const unsubscribe = onAdminAuthChange(setAuthed);
    return unsubscribe;
  }, []);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    const { error } = await signInAdmin(loginEmail, loginPassword);
    setLoginLoading(false);
    if (error) setLoginError(error);
  };

  const [seedLog, setSeedLog] = useState<string[]>([]);
  const [seeding, setSeeding] = useState(false);
  const [seedDone, setSeedDone] = useState(false);

  const allHotels = Object.entries(hotels).flatMap(([city, list]) =>
    list.map((hotel) => ({ ...hotel, city })),
  );

  const handleStarClick = (stars: number) => setForm((current) => ({ ...current, stars }));

  const toggleAmenity = (amenity: string) => {
    setForm((current) => ({
      ...current,
      amenities: current.amenities.includes(amenity)
        ? current.amenities.filter((item) => item !== amenity)
        : [...current.amenities, amenity],
    }));
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.city || form.priceUSD <= 0) return;
    if (editing) {
      updateHotel(editing.name, editing.city, form);
      setEditing(null);
    } else {
      addHotel(form);
    }
    setForm({ ...EMPTY_FORM });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleEdit = (hotel: Hotel & { city: string }) => {
    setForm({ ...hotel });
    setEditing({ name: hotel.name, city: hotel.city });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = (name: string, city: string) => {
    if (deleteConfirm === `${name}::${city}`) {
      removeHotel(name, city);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(`${name}::${city}`);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  if (authed === null) {
    return (
      <main className="wr-screen wr-admin-auth-shell">
        <div className="wr-admin-session" role="status" aria-live="polite">
          <span className="wr-admin-session-mark" aria-hidden="true" />
          Checking admin session…
        </div>
      </main>
    );
  }

  if (!authed) {
    return (
      <main className="wr-screen wr-admin-auth-shell">
        <form className="wr-admin-login" onSubmit={handleLogin}>
          <div className="wr-admin-login-mark" aria-hidden="true"><HotelIcon size={22} /></div>
          <p className="wr-section-index">Restricted access</p>
          <h1>WanderRoute admin</h1>
          <p>Sign in with an authorised account to manage hotel data.</p>

          <div className="wr-field">
            <label htmlFor="admin-email">Email</label>
            <input
              id="admin-email"
              name="email"
              type="email"
              autoComplete="username"
              value={loginEmail}
              onChange={(event) => setLoginEmail(event.target.value)}
              required
            />
          </div>
          <div className="wr-field">
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
              required
            />
          </div>

          {loginError && <p className="wr-form-error" role="alert">{loginError}</p>}

          <button className="wr-primary-button wr-admin-sign-in" type="submit" disabled={loginLoading}>
            {loginLoading ? "Signing in…" : "Sign in"}
          </button>
          <button className="wr-text-button" type="button" onClick={() => navigate("home")}>
            Back to WanderRoute
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="wr-screen wr-admin-screen">
      <header className="wr-editorial-header wr-admin-header">
        <div className="wr-admin-header-actions">
          <button className="wr-back-button" onClick={() => navigate("home")}>
            <ArrowLeft aria-hidden="true" size={17} />
            Back to site
          </button>
          <button className="wr-back-button" onClick={() => signOutAdmin()}>
            <LogOut aria-hidden="true" size={16} />
            Sign out
          </button>
        </div>
        <div className="wr-header-grid">
          <div>
            <p className="wr-kicker">Operations · Hotel directory</p>
            <h1>Hotel manager</h1>
          </div>
          <p className="wr-header-intro">
            Import shared place records, then review built-in and device-local hotel entries without changing traveller-facing route logic.
          </p>
        </div>
      </header>

      <div className="wr-secondary-shell wr-admin-shell">
        <section className="wr-admin-panel wr-admin-seed" aria-labelledby="seed-title">
          <div className="wr-admin-panel-heading">
            <div className="wr-admin-panel-icon" aria-hidden="true"><Database size={20} /></div>
            <div>
              <p className="wr-section-index">Shared place database</p>
              <h2 id="seed-title">Import places from Foursquare</h2>
            </div>
          </div>
          <p className="wr-admin-panel-copy">
            Pulls hotels, restaurants, attractions, beaches and temples for the configured Sri Lankan cities and saves them to Supabase. Existing duplicates are ignored.
          </p>

          {!seeding && !seedDone && (
            <button
              className="wr-primary-button"
              onClick={async () => {
                setSeeding(true);
                setSeedLog([]);
                setSeedDone(false);
                await seedPlacesFromFoursquare((message) => {
                  setSeedLog((current) => [...current.slice(-50), message]);
                });
                setSeeding(false);
                setSeedDone(true);
              }}
            >
              Start place import
            </button>
          )}

          {seeding && (
            <div className="wr-admin-progress" role="status" aria-live="polite">
              <span aria-hidden="true" />
              Import in progress…
            </div>
          )}

          {seedDone && (
            <p className="wr-feedback-success" role="status">
              <CheckMark />
              Import complete. Review the places table in Supabase.
            </p>
          )}

          {seedLog.length > 0 && (
            <div className="wr-admin-log" role="log" aria-live="polite" aria-label="Place import log">
              {seedLog.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
            </div>
          )}
        </section>

        <section className="wr-admin-panel" aria-labelledby="hotel-form-title">
          <div className="wr-admin-panel-heading wr-admin-form-heading">
            <div>
              <p className="wr-section-index">Device-local directory</p>
              <h2 id="hotel-form-title">{editing ? "Edit hotel entry" : "Add a hotel entry"}</h2>
            </div>
            <p>Entries added here remain in this browser until exported. They are not published to Supabase automatically.</p>
          </div>

          <form
            className="wr-admin-hotel-form"
            onSubmit={(event) => {
              event.preventDefault();
              handleSave();
            }}
          >
            <div className="wr-field wr-field-wide">
              <label htmlFor="hotel-name">Hotel name *</label>
              <input
                id="hotel-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="e.g. Cinnamon Grand Colombo"
                required
              />
            </div>

            <div className="wr-field">
              <label htmlFor="hotel-city">City *</label>
              <select
                id="hotel-city"
                value={form.city}
                onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
              >
                {CITIES.map((city) => <option key={city}>{city}</option>)}
              </select>
            </div>

            <div className="wr-field">
              <label htmlFor="hotel-area">Area or neighbourhood</label>
              <input
                id="hotel-area"
                value={form.area}
                onChange={(event) => setForm((current) => ({ ...current, area: event.target.value }))}
                placeholder="e.g. Colombo 3, Fort Area"
              />
            </div>

            <div className="wr-field">
              <label htmlFor="hotel-price">Price per night (USD) *</label>
              <input
                id="hotel-price"
                type="number"
                min={1}
                value={form.priceUSD || ""}
                onChange={(event) => setForm((current) => ({ ...current, priceUSD: Number(event.target.value) }))}
                placeholder="e.g. 45"
                required
              />
            </div>

            <fieldset className="wr-field wr-choice-field">
              <legend>Travel style tier</legend>
              <div className="wr-segmented-control">
                {(["budget", "comfort", "luxury"] as TravelStyle[]).map((style) => (
                  <button
                    key={style}
                    type="button"
                    aria-pressed={form.type === style}
                    onClick={() => setForm((current) => ({ ...current, type: style }))}
                  >
                    {style.charAt(0).toUpperCase() + style.slice(1)}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="wr-field wr-field-wide wr-choice-field">
              <legend>Star rating</legend>
              <div className="wr-star-selector">
                {[1, 2, 3, 4, 5].map((stars) => (
                  <button
                    key={stars}
                    type="button"
                    aria-label={`Set ${stars} star rating`}
                    aria-pressed={form.stars === stars}
                    onClick={() => handleStarClick(stars)}
                  >
                    <Star
                      aria-hidden="true"
                      size={25}
                      fill={stars <= form.stars ? "currentColor" : "none"}
                    />
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="wr-field wr-field-wide wr-choice-field">
              <legend>Amenities</legend>
              <div className="wr-amenity-selector">
                {ALL_AMENITIES.map((amenity) => {
                  const active = form.amenities.includes(amenity);
                  return (
                    <button
                      key={amenity}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleAmenity(amenity)}
                    >
                      {amenity}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="wr-field wr-field-wide">
              <label htmlFor="hotel-tip">Local tip</label>
              <textarea
                id="hotel-tip"
                value={form.tip || ""}
                onChange={(event) => setForm((current) => ({ ...current, tip: event.target.value }))}
                placeholder="e.g. Ask for a garden-view room"
              />
            </div>

            <div className="wr-field">
              <label htmlFor="hotel-booking-url">Booking.com affiliate URL</label>
              <input
                id="hotel-booking-url"
                type="url"
                value={form.bookingUrl || ""}
                onChange={(event) => setForm((current) => ({ ...current, bookingUrl: event.target.value }))}
                placeholder="https://www.booking.com/hotel/lk/..."
              />
            </div>

            <div className="wr-field">
              <label htmlFor="hotel-agoda-url">Agoda URL</label>
              <input
                id="hotel-agoda-url"
                type="url"
                value={form.agodaUrl || ""}
                onChange={(event) => setForm((current) => ({ ...current, agodaUrl: event.target.value }))}
                placeholder="https://www.agoda.com/..."
              />
            </div>

            <div className="wr-admin-form-actions wr-field-wide">
              <button className="wr-primary-button" type="submit">
                <Plus aria-hidden="true" size={17} />
                {saved ? "Saved on this device" : editing ? "Update hotel" : "Add hotel"}
              </button>
              {editing && (
                <button
                  className="wr-secondary-button"
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setForm({ ...EMPTY_FORM });
                  }}
                >
                  Cancel edit
                </button>
              )}
              <span className="wr-visually-hidden" role="status" aria-live="polite">
                {saved ? "Hotel saved on this device." : ""}
              </span>
            </div>
          </form>
        </section>

        <section className="wr-admin-panel wr-admin-directory" aria-labelledby="hotel-directory-title">
          <div className="wr-admin-directory-heading">
            <div>
              <p className="wr-section-index">Directory</p>
              <h2 id="hotel-directory-title">All hotels <span>{allHotels.length}</span></h2>
            </div>
            <button className="wr-secondary-button" onClick={exportJSON}>
              <Download aria-hidden="true" size={15} />
              Export local JSON
            </button>
          </div>

          <div className="wr-admin-table-wrap">
            <table>
              <caption className="wr-visually-hidden">Built-in and device-local hotels</caption>
              <thead>
                <tr>
                  {['Name', 'City', 'Style', 'Price', 'Stars', 'Source', 'Actions'].map((heading) => <th key={heading} scope="col">{heading}</th>)}
                </tr>
              </thead>
              <tbody>
                {allHotels.map((hotel, index) => {
                  const confirmKey = `${hotel.name}::${hotel.city}`;
                  return (
                    <tr key={`${hotel.city}-${hotel.name}-${index}`}>
                      <td data-label="Name"><strong>{hotel.name}</strong></td>
                      <td data-label="City">{hotel.city}</td>
                      <td data-label="Style"><span className={`wr-admin-tag wr-admin-tag-${hotel.type}`}>{hotel.type}</span></td>
                      <td data-label="Price"><strong>${hotel.priceUSD}</strong></td>
                      <td data-label="Stars">
                        <span className="wr-admin-stars" aria-label={`${hotel.stars} stars`}>
                          {Array.from({ length: hotel.stars }).map((_, starIndex) => <Star key={starIndex} aria-hidden="true" size={12} fill="currentColor" />)}
                        </span>
                      </td>
                      <td data-label="Source">
                        <span className={`wr-admin-source ${hotel.isUserAdded ? "is-local" : ""}`}>
                          {hotel.isUserAdded ? "This device" : "Built-in"}
                        </span>
                      </td>
                      <td data-label="Actions">
                        {hotel.isUserAdded && (
                          <div className="wr-admin-row-actions">
                            <button
                              aria-label={`Edit ${hotel.name}`}
                              onClick={() => handleEdit(hotel as Hotel & { city: string })}
                            >
                              <Edit aria-hidden="true" size={13} />
                              Edit
                            </button>
                            <button
                              className={deleteConfirm === confirmKey ? "is-confirming" : "is-danger"}
                              aria-label={deleteConfirm === confirmKey ? `Confirm deletion of ${hotel.name}` : `Delete ${hotel.name}`}
                              onClick={() => handleDelete(hotel.name, hotel.city ?? "")}
                            >
                              <Trash2 aria-hidden="true" size={13} />
                              {deleteConfirm === confirmKey ? "Confirm" : "Delete"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="wr-admin-storage-note">
            {userHotels.length} device-local hotel{userHotels.length === 1 ? "" : "s"}. Export JSON if you need to move these entries into source-controlled data.
          </p>
        </section>
      </div>
    </main>
  );
}

function CheckMark() {
  return <span aria-hidden="true">✓</span>;
}
