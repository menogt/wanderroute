import { useEffect, useRef, useState } from "react";
import {
  Bookmark,
  CalendarDays,
  Check,
  Clock3,
  Compass,
  MapPin,
  Trash2,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import type { GeneratedItinerary } from "./types";
import { clearAllTrips, formatSavedDate } from "./tripStorage";
import { deleteTrip, loadTrips } from "../../lib/tripsDb";
import { CURRENCY_SYMBOLS } from "./data";
import "../../../styles/core-ui.css";

export function TripsDrawer({
  isOpen,
  onClose,
  onSelectTrip,
  currentTripId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectTrip: (trip: GeneratedItinerary) => void;
  currentTripId: string | null;
}) {
  const [trips, setTrips] = useState<GeneratedItinerary[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setConfirmClear(false);
    setLoading(true);
    loadTrips()
      .then((loaded) => {
        if (active) setTrips(loaded);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.getClientRects().length > 0);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [isOpen, onClose]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteTrip(id);
      const updated = await loadTrips();
      setTrips(updated);
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    if (confirmClear) {
      setLoading(true);
      try {
        await Promise.all(trips.map((trip) => deleteTrip(trip.id)));
        clearAllTrips();
        setTrips([]);
        setConfirmClear(false);
      } finally {
        setLoading(false);
      }
      return;
    }

    setConfirmClear(true);
    setTimeout(() => setConfirmClear(false), 3000);
  };

  const selectTrip = (trip: GeneratedItinerary) => {
    onSelectTrip(trip);
    onClose();
  };

  const symbolFor = (trip: GeneratedItinerary) => CURRENCY_SYMBOLS[trip.currency] ?? "$";

  return (
    <>
      <button
        type="button"
        className={`wr-trips-backdrop${isOpen ? " is-open" : ""}`}
        onClick={onClose}
        aria-label="Close saved trips"
        tabIndex={isOpen ? 0 : -1}
      />

      <aside
        ref={panelRef}
        className={`wr-trips${isOpen ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="saved-trips-title"
        aria-hidden={!isOpen}
        inert={!isOpen ? true : undefined}
      >
        <header className="wr-trips__header">
          <div className="wr-trips__brandline">
            <span className="wr-brand-mark" aria-hidden="true"><Compass size={17} /></span>
            <span>WanderRoute atlas</span>
          </div>
          <button
            type="button"
            ref={closeButtonRef}
            className="wr-trips__close"
            onClick={onClose}
            aria-label="Close saved trips"
          >
            <X size={19} aria-hidden="true" />
          </button>
          <div className="wr-trips__heading">
            <p className="wr-kicker">Saved journeys</p>
            <h2 id="saved-trips-title">Your travel atlas</h2>
            <p>{loading ? "Loading your trips…" : `${trips.length} ${trips.length === 1 ? "route" : "routes"} saved on this device`}</p>
          </div>
        </header>

        <div className="wr-trips__body" aria-live="polite" aria-busy={loading}>
          {loading && trips.length === 0 ? (
            <div className="wr-trips__loading" role="status">
              <span className="wr-sr-only">Loading saved trips</span>
              {[0, 1, 2].map((item) => <i key={item} />)}
            </div>
          ) : trips.length === 0 ? (
            <div className="wr-trips__empty">
              <span aria-hidden="true"><Bookmark size={25} strokeWidth={1.5} /></span>
              <h3>No saved routes yet</h3>
              <p>Your generated itinerary will appear here automatically, ready to reopen.</p>
            </div>
          ) : (
            <div className="wr-trips__list">
              {trips.map((trip, index) => {
                const active = trip.id === currentTripId;
                const deleting = deletingId === trip.id;
                return (
                  <article
                    key={trip.id}
                    className={`wr-trip-row wr-trip-row--${trip.budgetStatus}${active ? " is-active" : ""}`}
                  >
                    <button
                      type="button"
                      className="wr-trip-row__select"
                      onClick={() => selectTrip(trip)}
                      aria-label={`Open ${trip.routeName}, ${trip.totalDays} days, ${symbolFor(trip)}${trip.estimatedTotalCost.toLocaleString()}`}
                      aria-current={active ? "true" : undefined}
                    >
                      <span className="wr-trip-row__number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                      <span className="wr-trip-row__main">
                        <span className="wr-trip-row__titleline">
                          <strong>{trip.routeName}</strong>
                          {active && <small><Check size={11} aria-hidden="true" /> Viewing</small>}
                        </span>
                        <span className="wr-trip-row__cities">
                          <MapPin size={13} strokeWidth={1.8} aria-hidden="true" />
                          {trip.cities.join(" — ")}
                        </span>
                        <span className="wr-trip-row__meta">
                          <span><CalendarDays size={13} aria-hidden="true" /> {trip.totalDays} days</span>
                          <span><Users size={13} aria-hidden="true" /> {trip.totalPeople}</span>
                          <span><WalletCards size={13} aria-hidden="true" /> {symbolFor(trip)}{trip.estimatedTotalCost.toLocaleString()}</span>
                        </span>
                      </span>
                    </button>

                    <footer className="wr-trip-row__footer">
                      <span className="wr-trip-row__date"><Clock3 size={12} aria-hidden="true" /> {formatSavedDate(trip.id)}</span>
                      <span className="wr-trip-row__style">{trip.travelStyle}</span>
                      <button
                        type="button"
                        className="wr-trip-row__delete"
                        onClick={() => handleDelete(trip.id)}
                        disabled={deleting}
                        aria-label={`Delete ${trip.routeName}`}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </footer>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {trips.length > 0 && (
          <footer className="wr-trips__footer">
            <button
              type="button"
              className={confirmClear ? "is-confirming" : ""}
              onClick={handleClearAll}
              disabled={loading}
            >
              <Trash2 size={14} aria-hidden="true" />
              {confirmClear ? "Select again to clear every trip" : "Clear all saved trips"}
            </button>
            <p>Trips are also synced when cloud persistence is available.</p>
          </footer>
        )}
      </aside>
    </>
  );
}
