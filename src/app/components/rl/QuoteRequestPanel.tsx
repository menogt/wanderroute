import { useRef, useState } from "react";
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
  wasQuoteReceived,
} from "../../lib/quoteRequests";
import "../../../styles/quote-request.css";

// Lets a traveller ask WanderRoute to review this route for a possible quote.
// No payment is taken here.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Status = "idle" | "form" | "sending" | "done" | "error";

export function QuoteRequestPanel({ itinerary }: { itinerary: GeneratedItinerary }) {
  const alreadyAsked = hasRequested(itinerary.id);
  const sendingRef = useRef(false);
  const submissionRef = useRef<{ fingerprint: string; requestId: string } | null>(null);

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
    if (sendingRef.current) return;

    if (!fullName.trim()) return setFieldError("Please add your name.");
    if (!EMAIL_RE.test(email.trim())) return setFieldError("Please check your email address.");

    const input = {
      fullName, email, whatsapp, startDate,
      travellers: Number(travellers) || itinerary.totalPeople,
      note,
    };
    const fingerprint = JSON.stringify(input);
    if (submissionRef.current?.fingerprint !== fingerprint) {
      submissionRef.current = { fingerprint, requestId: crypto.randomUUID() };
    }
    sendingRef.current = true;

    setFieldError(null);
    setStatus("sending");

    try {
      const result = await submitQuoteRequest(input, itinerary, submissionRef.current.requestId);
      if (wasQuoteReceived(result)) {
        markRequested(itinerary.id, result.requestId);
        setStatus("done");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      sendingRef.current = false;
    }
  }

  if (status === "done") {
    return (
      <section className="wr-quote-panel wr-quote-done" aria-live="polite">
        <div className="wr-quote-done-mark" aria-hidden="true">
          <CheckCircle2 size={26} />
        </div>
        <h2>We&rsquo;ve received your quote request</h2>
        <p>
          Your request for <strong>{routeLabel}</strong> is saved. We&rsquo;ll review
          it and contact you about the next steps.
        </p>
        <ul className="wr-quote-expect">
          <li>Any available quote will explain the route price</li>
          <li>It will state what is included and excluded</li>
          <li>You can review driver details before deciding</li>
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
          <CarFront size={13} aria-hidden="true" /> Request a quote
        </span>
        <h2 id="quote-panel-heading">
          Request a quote for this trip
        </h2>
        <p>
          Send us your route to review for a possible quote from a local
          driver-guide. Free, and no obligation.
        </p>
      </div>

      <ul className="wr-quote-promises">
        <li>
          <BadgeCheck size={17} aria-hidden="true" />
          <span>
            <strong>Clear price details</strong>
            Review what a quote includes before making a decision.
          </span>
        </li>
        <li>
          <ShieldCheck size={17} aria-hidden="true" />
          <span>
            <strong>Driver details</strong>
            Ask for the driver&rsquo;s name and licence details before you decide.
          </span>
        </li>
        <li>
          <Clock3 size={17} aria-hidden="true" />
          <span>
            <strong>Your route first</strong>
            Tell us which stops matter to you in the request.
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
              Your request was not submitted. Please try again.
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
            No payment now. We use your details only to handle this request.
          </p>
        </form>
      )}
    </section>
  );
}
