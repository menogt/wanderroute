import { useState } from "react";
import {
  BadgeCheck,
  CarFront,
  CheckCircle2,
  Clock3,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import type { GeneratedItinerary } from "./types";
import {
  submitQuoteRequest,
  markRequested,
  hasRequested,
} from "../../lib/quoteRequests";
import "../../../styles/quote-request.css";

// Turns a generated plan into a commercial lead: the traveller asks a verified,
// SLTDA-licensed driver to price this exact route as one fixed all-in figure.
// No payment is taken here — this is a free quote request, by design.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Status = "idle" | "form" | "sending" | "done" | "error";

export function QuoteRequestPanel({ itinerary }: { itinerary: GeneratedItinerary }) {
  const alreadyAsked = hasRequested(itinerary.id);

  const [status, setStatus] = useState<Status>(alreadyAsked ? "done" : "idle");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [startDate, setStartDate] = useState("");
  const [travellers, setTravellers] = useState(String(itinerary.totalPeople || 2));
  const [note, setNote] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const routeLabel =
    itinerary.cities?.length > 0
      ? itinerary.cities.join(" → ")
      : itinerary.routeName;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!fullName.trim()) return setFieldError("Please add your name.");
    if (!EMAIL_RE.test(email.trim())) return setFieldError("Please check your email address.");

    setFieldError(null);
    setStatus("sending");

    try {
      await submitQuoteRequest(
        {
          fullName,
          email,
          whatsapp,
          startDate,
          travellers: Number(travellers) || itinerary.totalPeople,
          note,
        },
        itinerary,
      );
      markRequested(itinerary.id);
      setStatus("done");
    } catch (submitError) {
      console.warn("Quote request failed:", submitError);
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <section className="wr-quote-panel wr-quote-done" aria-live="polite">
        <div className="wr-quote-done-mark" aria-hidden="true">
          <CheckCircle2 size={26} />
        </div>
        <h2>Your route is with a driver</h2>
        <p>
          A licensed driver is pricing <strong>{routeLabel}</strong> right now. You&rsquo;ll
          receive one fixed all-in figure within 24 hours.
        </p>
        <ul className="wr-quote-expect">
          <li>The all-in daily rate for your whole route</li>
          <li>What&rsquo;s included — fuel, driver&rsquo;s accommodation, tolls, parking</li>
          <li>What isn&rsquo;t — your meals, entry tickets, tips</li>
          <li>The driver&rsquo;s name and SLTDA licence number</li>
        </ul>
        <p className="wr-quote-smallprint">
          No payment has been taken and you&rsquo;re under no obligation.
        </p>
      </section>
    );
  }

  return (
    <section className="wr-quote-panel" aria-labelledby="quote-panel-heading">
      <div className="wr-quote-head">
        <span className="wr-eyebrow wr-quote-eyebrow">
          <CarFront size={13} aria-hidden="true" /> Book it for real
        </span>
        <h2 id="quote-panel-heading">
          Get this trip confirmed by a verified local driver
        </h2>
        <p>
          We send your exact route to an SLTDA-licensed driver-guide, who prices it as
          one fixed figure for the whole trip. Free, and no obligation.
        </p>
      </div>

      <ul className="wr-quote-promises">
        <li>
          <BadgeCheck size={17} aria-hidden="true" />
          <span>
            <strong>One all-in price</strong>
            Fuel, driver&rsquo;s accommodation, tolls and parking included — nothing added later.
          </span>
        </li>
        <li>
          <ShieldCheck size={17} aria-hidden="true" />
          <span>
            <strong>Licence shown, not claimed</strong>
            You get the driver&rsquo;s name and SLTDA licence number before you decide.
          </span>
        </li>
        <li>
          <Clock3 size={17} aria-hidden="true" />
          <span>
            <strong>No commission stops</strong>
            No gem shops, no spice gardens, no detours you didn&rsquo;t ask for.
          </span>
        </li>
      </ul>

      {status === "idle" ? (
        <button
          type="button"
          className="wr-button wr-button-gold wr-quote-cta"
          onClick={() => setStatus("form")}
        >
          Request my quote — free
        </button>
      ) : (
        <form className="wr-quote-form" onSubmit={handleSubmit} noValidate>
          <div className="wr-quote-grid">
            <label className="wr-quote-field">
              <span>Your name</span>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                required
              />
            </label>

            <label className="wr-quote-field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>

            <label className="wr-quote-field">
              <span>
                WhatsApp <small>optional, but faster</small>
              </span>
              <input
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+44 …"
                autoComplete="tel"
              />
            </label>

            <label className="wr-quote-field">
              <span>Arrival date</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>

            <label className="wr-quote-field wr-quote-field-narrow">
              <span>Travellers</span>
              <input
                type="number"
                min={1}
                max={20}
                value={travellers}
                onChange={(e) => setTravellers(e.target.value)}
              />
            </label>

            <label className="wr-quote-field wr-quote-field-wide">
              <span>
                Anything to add? <small>optional</small>
              </span>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Flight times, a stop you'd like to add, dietary needs…"
              />
            </label>
          </div>

          <div className="wr-quote-route-recap">
            <span>Quoting</span>
            <strong>{routeLabel}</strong>
            <small>
              {itinerary.totalDays} day{itinerary.totalDays === 1 ? "" : "s"} ·{" "}
              {itinerary.travelStyle}
            </small>
          </div>

          {fieldError && (
            <p className="wr-quote-error" role="alert">
              {fieldError}
            </p>
          )}

          {status === "error" && (
            <p className="wr-quote-error" role="alert">
              That didn&rsquo;t send. Please try once more.
            </p>
          )}

          <button
            type="submit"
            className="wr-button wr-button-gold wr-quote-cta"
            disabled={status === "sending"}
          >
            {status === "sending" ? (
              <>
                <Loader2 size={16} className="wr-quote-spin" aria-hidden="true" /> Sending…
              </>
            ) : (
              "Send my request"
            )}
          </button>

          <p className="wr-quote-smallprint">
            No payment now. We use your details only to send this quote.
          </p>
        </form>
      )}
    </section>
  );
}
