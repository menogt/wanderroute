import { useEffect, useMemo, useRef, useState } from "react";
import type { DetailedPlanningResult } from "../../lib/planningV2Itinerary";
import type { PlanningRouteConcept } from "../../lib/planningV2";
import type { TripBriefV1 } from "../../lib/planningTypes";
import { planningMoney, planningPresentation } from "../../lib/planningPresentation";

export function PlanningReviewPanel({ detail, brief, concept, busy, approvedRevision, onFinalize }: {
  detail: DetailedPlanningResult; brief: TripBriefV1; concept: PlanningRouteConcept; busy: boolean;
  approvedRevision?: string; onFinalize: (revision: string) => void;
}) {
  const plan = useMemo(() => planningPresentation(detail, brief, concept), [detail, brief, concept]);
  const current = useRef(plan.revision); current.current = plan.revision;
  const [reviewing, setReviewing] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string>();
  const [prepared, setPrepared] = useState<{ url: string; revision: string }>();
  useEffect(() => { setAcknowledged(false); setError(undefined); }, [plan.revision]);
  useEffect(() => () => { if (prepared) URL.revokeObjectURL(prepared.url); }, [prepared]);
  const approved = approvedRevision === plan.revision;
  const preparePDF = async () => {
    const captured = plan;
    setPreparing(true); setError(undefined); setPrepared(undefined);
    try {
      const { createPlanningPDF, loadPlanningPDFFonts } = await import("../../lib/planningPDF");
      const fonts = await loadPlanningPDFFonts();
      if (current.current !== captured.revision) throw new Error("Your plan changed while the PDF was being prepared. Prepare it again to export the current version.");
      const doc = createPlanningPDF(captured, fonts, approved);
      setPrepared({ url: URL.createObjectURL(doc.output("blob")), revision: captured.revision });
    } catch (issue) { setError(issue instanceof Error ? issue.message : "The PDF could not be prepared. Your itinerary is safe; please retry."); }
    finally { setPreparing(false); }
  };
  return <section className="wr-v2-review" aria-labelledby="wr-review-title">
    <p className="wr-kicker">Your next steps</p><h2 id="wr-review-title">Keep the plan. Arrange the journey.</h2>
    <p>Download your current draft at any stage, or review it as your preferred plan. Neither action makes a booking.</p>
    <div className="wr-v2-review__actions"><button type="button" disabled={busy || preparing} onClick={preparePDF}>{preparing ? "Preparing PDF…" : "Prepare draft PDF"}</button>
      <button type="button" aria-expanded={reviewing} onClick={() => setReviewing(value => !value)}>Review and finalize my plan</button>
      {prepared?.revision === plan.revision && !busy && <><a className="wr-button wr-button--primary" href={prepared.url} download={`WanderRoute-${plan.reference}.pdf`}>Download PDF</a><a href={prepared.url} target="_blank" rel="noopener noreferrer">Open PDF</a></>}
    </div>
    {error && <p role="alert">{error}</p>}
    {prepared && prepared.revision !== plan.revision && <p role="status">Your plan changed. Prepare a new PDF to include your latest edits.</p>}
    {approved ? <p className="wr-v2-review__preferred" role="status">This is your preferred draft ({plan.reference}). Arrangements and prices still need confirmation.</p> : approvedRevision && <p role="status">Your plan has changed since your last review. Review this version before finalizing it.</p>}
    {reviewing && <div className="wr-v2-review__details">
      <h3>Your current journey</h3><p>{plan.brief.durationDays} days · {plan.brief.travellerCount} travellers · {plan.days[0]?.date ?? "Dates to confirm"}{plan.days[plan.days.length - 1]?.date ? ` to ${plan.days[plan.days.length - 1]!.date}` : ""}</p>
      <ol>{plan.route.map(stop => <li key={stop.name}><strong>{stop.name} · {stop.nights} nights</strong><p>{stop.stay?.name || stop.stay?.area || "Stay to choose"} · {stop.status}{stop.stay?.rooms ? ` · ${stop.stay.rooms} rooms requested` : " · Room count to confirm"}</p></li>)}</ol>
      <h3>Transfers</h3>{plan.transfers.length ? plan.transfers.map(leg => <p key={leg.id}><strong>{leg.from} to {leg.to}</strong><br />{leg.mode} · {leg.timing}<br />{leg.status}</p>) : <p>Local transport still needs arranging.</p>}
      <h3>Budget and remaining arrangements</h3><p>{plan.budget.supported > 0 ? `${planningMoney(plan.budget.supported, brief.budget.currency)} supported / recorded subtotal; further costs may remain.` : "No supported whole-trip price yet. Unknown prices are not zero."}</p>
      {plan.budget.rows.some(row => row.allowance) && <p>Your allowance scenario: {planningMoney(plan.budget.scenarioMinimum, brief.budget.currency)} before uncovered costs. Personal allowances are not quotes.</p>}
      <p>Still unpriced: {plan.budget.uncovered.join(", ") || "Check current rates and availability with providers"}.</p>
      <details><summary>Experiences in this draft</summary>{plan.days.map(day => <p key={day.day}>Day {day.day}, {day.visitCity ? `${day.visitCity} (return to ${day.city})` : day.city}: {day.items.filter(item => item.category === "activity").map(item => item.label).join("; ") || "Open time / arrangements to choose"}</p>)}</details>
      <details><summary>Preparation checklist</summary><ul>{plan.preparation.map(item => <li key={item}>{item}</li>)}</ul></details>
      {plan.conflicts.length > 0 && <div role="alert"><strong>Resolve before finalizing</strong><ul>{plan.conflicts.map(item => <li key={item}>{item}</li>)}</ul></div>}
      <label className="wr-v2-review__ack"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} />I prefer this draft and understand that unconfirmed times, prices, availability and arrangements still need checking.</label>
      <button type="button" disabled={busy || !acknowledged || !!plan.conflicts.length || approved} onClick={() => onFinalize(plan.revision)}>{approved ? "Preferred draft saved" : "Finalize my preferred draft"}</button>
      <h3>Quote or trip assistance</h3><p>Online assistance requests are not available for this planner yet. No request has been sent. Download your current PDF to discuss the trip with a provider.</p>
      <button type="button" disabled>Request trip assistance · unavailable</button>
      <p><small>A preferred draft is not a reservation, payment or confirmation of availability. Independently booked arrangements are traveler reports.</small></p>
    </div>}
  </section>;
}
