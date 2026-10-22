import type { DetailedPlanningResult } from "./planningV2Itinerary";
import type { TripBriefV1 } from "./planningTypes";

export const BUDGET_GROUPS = { stays: "Accommodation", intercity: "Intercity transport", airports: "Airport transfers",
  local: "Local transport", admission: "Attractions and admission", tours: "Tours and experiences", meals: "Meals", miscellaneous: "Other trip costs" } as const;
export type BudgetGroup = keyof typeof BUDGET_GROUPS;
export type PlanningAllowance = { amount: number; basis: "TRIP" | "PERSON_DAY" | "ROOM_NIGHT"; rooms?: number };
export type PlanningAllowances = Partial<Record<BudgetGroup, PlanningAllowance>>;
const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Allowances remain a separate, traveler-entered scenario; never promote them to price evidence. */
export function planningBudget(detail: DetailedPlanningResult, brief: TripBriefV1) {
  const airportIds = new Set(detail.itinerary.days.flatMap(day => day.items)
    .filter(item => item.category === "transport" && /^(Arrival|Departure) transfer/.test(item.label)).map(item => `cost:${item.id}`));
  const rows = Object.entries(BUDGET_GROUPS).map(([key, label]) => ({ key: key as BudgetGroup, label, supported: 0,
    supportedMaximum: 0, gaps: 0, lineCount: 0, allowance: undefined as PlanningAllowance | undefined, allowanceTotal: undefined as number | undefined }));
  for (const line of detail.ledger.lines) {
    const category = line.input.category;
    const key: BudgetGroup = category === "ACCOMMODATION" ? "stays" : category === "FOOD" ? "meals" :
      category === "ENTRY_FEES" ? "admission" : category === "ACTIVITIES" ? "tours" : category === "TRANSPORT"
        ? line.input.id === "trip:local-transport" ? "local" : airportIds.has(line.input.id) ? "airports" : "intercity" : "miscellaneous";
    const row = rows.find(row => row.key === key)!;
    row.lineCount++;
    if (line.total) { row.supported += line.total.minimum; row.supportedMaximum += line.total.maximum; }
    else row.gaps++;
  }
  for (const row of rows) {
    row.supported = money(row.supported); row.supportedMaximum = money(row.supportedMaximum);
    const allowance = detail.allowances?.[row.key];
    row.allowance = allowance;
    if (!row.gaps || !allowance || !Number.isFinite(allowance.amount) || allowance.amount < 0) continue;
    const multiplier = allowance.basis === "PERSON_DAY" ? brief.durationDays * brief.travellerCount :
      allowance.basis === "ROOM_NIGHT" ? Number.isInteger(allowance.rooms) && allowance.rooms! > 0 ? allowance.rooms! * row.gaps : undefined : 1;
    if (multiplier !== undefined) row.allowanceTotal = money(allowance.amount * multiplier);
  }
  const supported = money(rows.reduce((sum, row) => sum + row.supported, 0));
  const allowanceTotal = money(rows.reduce((sum, row) => sum + (row.allowanceTotal ?? 0), 0));
  return { rows, supported, allowanceTotal, scenarioMinimum: money(supported + allowanceTotal),
    scenarioMaximum: money(rows.reduce((sum, row) => sum + row.supportedMaximum + (row.allowanceTotal ?? 0), 0)),
    uncovered: rows.filter(row => row.gaps && row.allowanceTotal === undefined).map(row => row.label),
    exclusions: ["International flights", "Travel insurance", "Visa or entry authorization fees unless included in your other-cost allowance"] };
}
