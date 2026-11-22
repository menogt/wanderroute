import type { AmountSummary, CostLedger } from "../../../lib/costLedger";

export function amountLabel(summary: AmountSummary | undefined, currency: string): string {
  if (!summary || summary.unknownCount > 0) {
    return summary?.minimum ? `At least ${currency} ${summary.minimum.toLocaleString()} plus unpriced costs` : "Price to confirm";
  }
  if (summary.exact !== undefined) return `${currency} ${summary.exact.toLocaleString()}`;
  if (summary.maximum !== undefined) {
    if (summary.maximum === 0) return "No entry fee";
    if (summary.maximum - summary.minimum < 1) return `About ${currency} ${Math.round(summary.maximum).toLocaleString()}`;
    return `${currency} ${Math.floor(summary.minimum).toLocaleString()}–${Math.ceil(summary.maximum).toLocaleString()} est.`;
  }
  return "Price to confirm";
}

export function itemCost(ledger: CostLedger, itemId: string): string {
  const line = ledger.lines.find(entry => entry.input.id === `cost:${itemId}`);
  // Meals and stays are costed per day, not per item.
  if (!line) return ledger.sourceLines.some(entry => entry.unitPrice.kind === "RANGE") ? "In the day cost" : "Price to confirm";
  return amountLabel(line.total ? { ...line.total, unknownCount: 0 } : undefined, ledger.currency);
}

const ISSUES: Record<string, string> = {
  OPENING_HOURS_UNCONFIRMED: "Opening hours need confirmation",
  OPENING_HOURS_CONFLICT: "An activity conflicts with known opening hours",
  TRANSPORT_TIME_UNKNOWN: "A transfer time is unknown",
  TRANSFER_SCHEDULE_TIME_UNKNOWN: "A transfer cannot be timed yet",
  BUDGET_UNKNOWN: "Budget fit cannot be confirmed",
  BUDGET_RISK: "The cost estimate could exceed your budget",
  BUDGET_OVER: "Even the low cost estimate exceeds your budget",
  SEASON_UNKNOWN: "Seasonal conditions need confirmation",
  HARD_DRIVING_LIMIT_EXCEEDED: "Daily driving exceeds the hard limit",
  ITEMS_OVERLAP: "Scheduled items overlap",
  MUST_VISIT_UNSCHEDULED: "A must-visit destination still needs a day and transfer",
  REQUESTED_PLACE_UNSCHEDULED: "A place you chose isn't on any day yet",
  DAY_VISIT_TIME_INSUFFICIENT: "A return visit needs more time than the day allows",
  DAY_VISIT_SERVICE_UNCONFIRMED: "Outward and return visit services need confirmation",
  DAY_VISIT_TRANSFER_MISSING: "A day visit is missing an outward or return transfer",
  TRANSFER_TIME_INSUFFICIENT: "A transfer needs more time",
};
export const readableIssue = (code: string) => ISSUES[code] ?? code.toLowerCase().replace(/_/g, " ").replace(/^./, letter => letter.toUpperCase());

/** "Sat 12 Dec" from an ISO date; undefined dates stay undefined. */
export function shortDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}
