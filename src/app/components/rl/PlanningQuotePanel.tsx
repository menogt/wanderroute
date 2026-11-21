import { useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, CarFront, CheckCircle2, Clock3, Loader2, ShieldCheck } from "lucide-react";
import type { DetailedPlanningResult } from "../../lib/planningV2Itinerary";
import type { PlanningRouteConcept } from "../../lib/planningV2";
import type { TripBriefV1 } from "../../lib/planningTypes";
import { planningPresentation } from "../../lib/planningPresentation";
import { planningQuoteId, planningQuoteTrip, SERVICE_LABELS, suggestedVehicle, VEHICLE_LABELS,
  type DriverService, type VehicleChoice } from "../../lib/planningQuote";
import { hasRequested, markRequested, submitQuoteRequest, wasQuoteReceived } from "../../lib/quoteRequests";
import "../../../styles/quote-request.css";
import "../../../styles/planning-quote.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
type Status = "idle" | "form" | "sending" | "done" | "error";
const clock = (dateTime?: string) => dateTime?.slice(11, 16);

/** Sends this exact plan version to WanderRoute for a driver-guide quote. No payment or booking. */
export function PlanningQuotePanel({ detail, brief, concept, openSignal }: {
  detail: DetailedPlanningResult; brief: TripBriefV1; concept: PlanningRouteConcept; openSignal: number;
}) {
  const plan = useMemo(() => planningPresentation(detail, brief, concept), [detail, brief, concept]);
  const tripId = planningQuoteId(plan);
  const section = useRef<HTMLElement>(null);
  const firstField = useRef<HTMLInputElement>(null);
  const sending = useRef(false);
  const submission = useRef<{ fingerprint: string; requestId: string } | null>(null);
  const [status, setStatus] = useState<Status>(() => hasRequested(tripId) ? "done" : "idle");
  const [reference, setReference] = useState<string>();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [travellers, setTravellers] = useState(String(brief.travellerCount));
  const [service, setService] = useState<DriverService>("WHOLE_TRIP");
  const [vehicle, setVehicle] = useState<VehicleChoice>(suggestedVehicle(brief.travellerCount));
  const [note, setNote] = useState("");
  const [fieldError, setFieldError] = useState<string>();

  // A changed plan is a new version; it can be sent again.
  useEffect(() => { setStatus(hasRequested(tripId) ? "done" : "idle"); setReference(undefined); }, [tripId]);
  useEffect(() => {
    if (!openSignal) return;
    setStatus(current => current === "done" || current === "sending" ? current : "form");
    section.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => firstField.current?.focus({ preventScroll: true }), 400);
  }, [openSignal]);

  const route = plan.route.map(stop => `${stop.name} ${stop.nights}n`).join(" → ");
  const dates = plan.days[0]?.date ? `${plan.days[0].date} to ${plan.days[plan.days.length - 1]?.date}` : `${brief.durationDays} days, dates to confirm`;
  const flights = [brief.arrival?.dateTime && `lands ${clock(brief.arrival.dateTime)}`,
    brief.departure?.dateTime && `flies out ${clock(brief.departure.dateTime)}`].filter(Boolean).join(" · ");
  const estimate = plan.budget.supported > 0
    ? `${brief.budget.currency} ${Math.floor(plan.budget.supported).toLocaleString()}–${Math.ceil(plan.budget.supportedMaximum).toLocaleString()} estimated` : undefined;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sending.current) return;
    if (!fullName.trim()) return setFieldError("Please add your name.");
    if (!EMAIL_RE.test(email.trim())) return setFieldError("Please check your email address.");
    const people = Math.min(20, Math.max(1, Math.round(Number(travellers) || brief.travellerCount)));
    const input = { fullName, email, whatsapp, startDate: plan.days[0]?.date ?? undefined, travellers: people, note };
    const trip = planningQuoteTrip(plan, { ...brief, travellerCount: people }, { service, vehicle });
    const fingerprint = JSON.stringify([input, trip.id, service, vehicle]);
    if (submission.current?.fingerprint !== fingerprint) submission.current = { fingerprint, requestId: crypto.randomUUID() };
    sending.current = true; setFieldError(undefined); setStatus("sending");
    try {
      const result = await submitQuoteRequest(input, trip, submission.current.requestId);
      if (wasQuoteReceived(result)) {
        markRequested(tripId, result.requestId);
        setReference(result.requestId.slice(0, 8).toUpperCase());
        setStatus("done");
      } else setStatus("error");
    } catch { setStatus("error"); }
    finally { sending.current = false; }
  }

  if (status === "done") return <section ref={section} id="wr-driver-quote" className="wr-quote-panel wr-quote-done wr-v2-quote" aria-live="polite">
    <div className="wr-quote-done-mark" aria-hidden="true"><CheckCircle2 size={26} /></div>
    <h2>We&rsquo;ve received your quote request</h2>
    <p>Your route <strong>{route}</strong> is with WanderRoute.{reference ? <> Reference <strong>{reference}</strong>.</> : null} We&rsquo;ll match it with a local driver-guide and contact you by email{whatsapp.trim() ? " or WhatsApp" : ""} about next steps.</p>
    <ul className="wr-quote-expect">
      <li>A quote will state the price, what is included and what is not</li>
      <li>You can ask for the driver&rsquo;s name and licence details before deciding</li>
      <li>If you change this plan, you can send the new version</li>
    </ul>
    <p className="wr-quote-smallprint">No payment has been taken and you&rsquo;re under no obligation.</p>
  </section>;

  return <section ref={section} id="wr-driver-quote" className="wr-quote-panel wr-v2-quote" aria-labelledby="wr-driver-quote-title">
    <div className="wr-quote-head">
      <span className="wr-eyebrow wr-quote-eyebrow"><CarFront size={13} aria-hidden="true" /> Driver quote</span>
      <h2 id="wr-driver-quote-title">Get a quote from a local driver-guide</h2>
      <p>Send this exact route to WanderRoute. We&rsquo;ll match it with a local driver-guide and send you their quote. Free, no obligation, no payment now.</p>
    </div>
    <ul className="wr-quote-promises">
      <li><BadgeCheck size={17} aria-hidden="true" /><span><strong>Priced against your route</strong>The driver sees your stops, nights, flights and road times.</span></li>
      <li><ShieldCheck size={17} aria-hidden="true" /><span><strong>Driver details first</strong>Ask for the driver&rsquo;s name and licence details before you decide.</span></li>
      <li><Clock3 size={17} aria-hidden="true" /><span><strong>Compare with the estimate</strong>{estimate ? `Our published-price estimate: ${estimate}.` : "Use it to compare quotes."}</span></li>
    </ul>
    {status === "idle" ? <button type="button" className="wr-button wr-button--primary wr-quote-cta" onClick={() => setStatus("form")}>Get my driver quote — free</button> :
      <form className="wr-quote-form" onSubmit={submit} noValidate>
        <div className="wr-quote-grid">
          <label className="wr-quote-field"><span>Your name</span><input ref={firstField} type="text" value={fullName} onChange={event => setFullName(event.target.value)} autoComplete="name" required /></label>
          <label className="wr-quote-field"><span>Email</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required /></label>
          <label className="wr-quote-field"><span>WhatsApp <small>optional, but faster</small></span><input type="tel" value={whatsapp} onChange={event => setWhatsapp(event.target.value)} placeholder="+94 …" autoComplete="tel" /></label>
          <label className="wr-quote-field wr-quote-field-narrow"><span>Travellers</span><input type="number" min={1} max={20} value={travellers}
            onChange={event => { setTravellers(event.target.value); const count = Number(event.target.value); if (count > 0) setVehicle(suggestedVehicle(count)); }} /></label>
          <label className="wr-quote-field"><span>What do you need?</span><select value={service} onChange={event => setService(event.target.value as DriverService)}>
            {(Object.keys(SERVICE_LABELS) as DriverService[]).map(key => <option key={key} value={key}>{SERVICE_LABELS[key]}</option>)}</select></label>
          <label className="wr-quote-field"><span>Vehicle</span><select value={vehicle} onChange={event => setVehicle(event.target.value as VehicleChoice)}>
            {(Object.keys(VEHICLE_LABELS) as VehicleChoice[]).map(key => <option key={key} value={key}>{VEHICLE_LABELS[key]}</option>)}</select></label>
          <label className="wr-quote-field wr-quote-field-wide"><span>Anything to add? <small>optional</small></span>
            <textarea rows={2} value={note} onChange={event => setNote(event.target.value)} placeholder="Hotel pickup, child seat, a stop you'd like to add, languages…" /></label>
        </div>
        <div className="wr-quote-route-recap"><span>Quoting</span><strong>{route}</strong>
          <small>{dates}{flights ? ` · ${flights}` : ""}{estimate ? ` · ${estimate}` : ""}</small></div>
        {fieldError && <p className="wr-quote-error" role="alert">{fieldError}</p>}
        {status === "error" && <p className="wr-quote-error" role="alert">Your request was not sent. Please try again, or download the PDF and contact us.</p>}
        <button type="submit" className="wr-button wr-button--primary wr-quote-cta" disabled={status === "sending"}>
          {status === "sending" ? <><Loader2 size={16} className="wr-quote-spin" aria-hidden="true" /> Sending…</> : "Send my request"}</button>
        <p className="wr-quote-smallprint">No payment now. We use your details only to handle this request.</p>
      </form>}
  </section>;
}
