// Informational monsoon banner shown above the itinerary when the trip has a
// travel month and at least one city is out of season. Never blocks anything:
// any error inside renders nothing.

import { CloudRain, Umbrella } from "lucide-react";
import { checkSeason, type SeasonWarning } from "../../lib/season";
import { MONTH_NAMES } from "../../lib/seasonData";
import "../../../styles/season-banner.css";

export function SeasonBanner({ cities, month }: { cities: string[]; month: number | null | undefined }) {
  let warnings: SeasonWarning[] = [];
  try {
    warnings = checkSeason(cities ?? [], month ?? null);
  } catch (error) {
    console.warn("Season check skipped:", error);
    return null;
  }
  if (warnings.length === 0) return null;

  const hasAvoid = warnings.some((warning) => warning.severity === "avoid");
  const monthName = MONTH_NAMES[(month as number) - 1] ?? "";

  return (
    <section
      className={`wr-season-banner ${hasAvoid ? "is-avoid" : "is-caution"}`}
      role="status"
      aria-label="Seasonal weather notice"
    >
      <div className="wr-season-banner__icon" aria-hidden="true">
        {hasAvoid ? <CloudRain size={20} /> : <Umbrella size={20} />}
      </div>
      <div className="wr-season-banner__body">
        <span className="wr-eyebrow">Weather check · {monthName}</span>
        <strong>
          {hasAvoid
            ? "Part of this route is in monsoon season for your dates."
            : "Some stops may see showers during your dates."}
        </strong>
        <ul>
          {warnings.map((warning) => (
            <li key={warning.city} className={`is-${warning.severity}`}>
              <b>{warning.city}</b> · {warning.message} {warning.alternative}
            </li>
          ))}
        </ul>
        <small>This is guidance only. Your itinerary is unchanged.</small>
      </div>
    </section>
  );
}
