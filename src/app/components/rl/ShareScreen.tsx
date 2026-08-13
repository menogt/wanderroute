import { useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Copy,
  Download,
  Mail,
  MessageCircle,
  Share2,
} from "lucide-react";
import type { GeneratedItinerary, Screen } from "./types";
import { CURRENCY_SYMBOLS } from "./data";
import { downloadItineraryPDF } from "./generatePDF";
import "../../../styles/secondary-screens.css";

export function ShareScreen({
  itinerary,
  navigate,
}: {
  itinerary: GeneratedItinerary;
  navigate: (s: Screen) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sym = CURRENCY_SYMBOLS[itinerary.currency];

  const shareTitle = `My Sri Lanka trip — ${itinerary.routeName}`;
  const shareText = [
    shareTitle,
    itinerary.cities.join(" → "),
    `${itinerary.totalDays} days · ${itinerary.totalPeople} ${itinerary.totalPeople === 1 ? "traveller" : "travellers"}`,
    `Estimated total: ${sym}${itinerary.estimatedTotalCost.toLocaleString()}`,
    "Planned with WanderRoute",
  ].join("\n");

  const currentUrl = typeof window === "undefined" ? "" : window.location.href;
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const clearFeedback = () => {
    setMessage(null);
    setError(null);
  };

  const copySummary = async () => {
    clearFeedback();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = shareText;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const didCopy = document.execCommand("copy");
        textarea.remove();
        if (!didCopy) throw new Error("Copy command unavailable");
      }
      setCopied(true);
      setMessage("Trip summary copied.");
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Could not copy the summary. Select the itinerary details and copy them manually.");
    }
  };

  const shareOnWhatsApp = () => {
    clearFeedback();
    const payload = currentUrl ? `${shareText}\n\n${currentUrl}` : shareText;
    window.open(`https://wa.me/?text=${encodeURIComponent(payload)}`, "_blank", "noopener,noreferrer");
  };

  const shareByEmail = () => {
    clearFeedback();
    const body = currentUrl ? `${shareText}\n\n${currentUrl}` : shareText;
    window.location.href = `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(body)}`;
  };

  const shareNatively = async () => {
    clearFeedback();
    try {
      await navigator.share({ title: shareTitle, text: shareText, url: currentUrl || undefined });
      setMessage("Share sheet opened.");
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") return;
      setError("Sharing is unavailable right now. You can copy the trip summary instead.");
    }
  };

  const handleDownload = async () => {
    clearFeedback();
    setPdfLoading(true);
    try {
      await downloadItineraryPDF(itinerary);
      setMessage("Your PDF download has started.");
    } catch {
      setError("Could not create the PDF. Please try again.");
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <main className="wr-screen wr-share-screen">
      <header className="wr-editorial-header wr-share-header">
        <button className="wr-back-button" onClick={() => navigate("itinerary")}>
          <ArrowLeft aria-hidden="true" size={17} />
          Back to itinerary
        </button>
        <div className="wr-header-grid">
          <div>
            <p className="wr-kicker">Travel document</p>
            <h1>Take the plan with you.</h1>
          </div>
          <p className="wr-header-intro">
            Download the complete itinerary or send a concise route summary to the people travelling with you.
          </p>
        </div>
      </header>

      <div className="wr-secondary-shell wr-share-shell">
        <article className="wr-share-document" aria-labelledby="share-route-title">
          <div className="wr-share-document-masthead">
            <div className="wr-wordmark" aria-label="WanderRoute">
              <span aria-hidden="true">WR</span>
              <strong>WanderRoute</strong>
            </div>
            <span className="wr-document-code">TRIP · {String(itinerary.totalDays).padStart(2, "0")}D</span>
          </div>

          <div className="wr-share-document-title">
            <p>Your Sri Lanka route</p>
            <h2 id="share-route-title">{itinerary.routeName}</h2>
            {itinerary.routeSlogan && <p className="wr-share-slogan">{itinerary.routeSlogan}</p>}
          </div>

          <ol className="wr-share-route" aria-label="Trip destinations">
            {itinerary.cities.map((city, index) => (
              <li key={`${city}-${index}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{city}</strong>
              </li>
            ))}
          </ol>

          <dl className="wr-share-facts">
            <div>
              <dt>Duration</dt>
              <dd>{itinerary.totalDays} days</dd>
            </div>
            <div>
              <dt>Travellers</dt>
              <dd>{itinerary.totalPeople}</dd>
            </div>
            <div>
              <dt>Estimated total</dt>
              <dd>{sym}{itinerary.estimatedTotalCost.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Per traveller</dt>
              <dd>{sym}{itinerary.estimatedCostPerPerson.toLocaleString()}</dd>
            </div>
          </dl>

          {itinerary.highlights.length > 0 && (
            <div className="wr-share-highlights">
              <p>Route highlights</p>
              <ul>
                {itinerary.highlights.slice(0, 3).map((highlight) => <li key={highlight}>{highlight}</li>)}
              </ul>
            </div>
          )}
        </article>

        <aside className="wr-share-actions" aria-labelledby="share-actions-title">
          <div>
            <p className="wr-section-index">Share & save</p>
            <h2 id="share-actions-title">Choose how to carry it.</h2>
            <p>Shared messages contain the route summary shown here. The PDF contains the complete itinerary.</p>
          </div>

          <button className="wr-download-button" onClick={handleDownload} disabled={pdfLoading}>
            <Download aria-hidden="true" size={19} />
            <span>
              <strong>{pdfLoading ? "Preparing PDF…" : "Download itinerary PDF"}</strong>
              <small>Save the complete travel plan</small>
            </span>
          </button>

          <div className="wr-share-action-grid">
            <button onClick={shareOnWhatsApp}>
              <MessageCircle aria-hidden="true" size={18} />
              WhatsApp
            </button>
            <button onClick={shareByEmail}>
              <Mail aria-hidden="true" size={18} />
              Email
            </button>
            <button onClick={copySummary}>
              {copied ? <Check aria-hidden="true" size={18} /> : <Copy aria-hidden="true" size={18} />}
              {copied ? "Copied" : "Copy summary"}
            </button>
            {canNativeShare && (
              <button onClick={shareNatively}>
                <Share2 aria-hidden="true" size={18} />
                More options
              </button>
            )}
          </div>

          <div className="wr-share-feedback" aria-live="polite" aria-atomic="true">
            {message && <p className="wr-feedback-success"><Check aria-hidden="true" size={15} />{message}</p>}
            {error && <p className="wr-feedback-error" role="alert"><AlertCircle aria-hidden="true" size={15} />{error}</p>}
          </div>

          <button className="wr-text-button" onClick={() => navigate("planner")}>
            Plan another trip
          </button>
        </aside>
      </div>
    </main>
  );
}
