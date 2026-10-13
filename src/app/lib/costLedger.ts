import type { Currency } from "../components/rl/types";
import type { PriceEvidence, PriceEvidenceStatus } from "./planningTypes";

export type CostCategory = "ACCOMMODATION" | "TRANSPORT" | "ACTIVITIES" | "ENTRY_FEES" | "FOOD" | "MISCELLANEOUS";
export type ChargingBasis = "PER_PERSON" | "PER_GROUP" | "PER_ROOM" | "PER_VEHICLE" | "PER_NIGHT" | "PER_DAY" | "FIXED";
export type CostPeriod = "NIGHT" | "DAY";
export type UnitPrice =
  | { kind: "EXACT"; evidence: PriceEvidence }
  | { kind: "RANGE"; minimum: number; maximum: number; expected?: number; currency: Currency;
      provenance: { status: "ESTIMATED"; source?: string; checkedAt?: string; confidence?: number; note?: string } }
  | { kind: "UNKNOWN"; currency?: Currency; reason?: string };
export type CostLineInput = {
  id: string;
  day?: number;
  category: CostCategory;
  description: string;
  quantity: number;
  chargingBasis: ChargingBasis;
  /** For two rooms over three nights: quantity=2, periodCount=3, periodUnit=NIGHT. */
  periodCount?: number;
  periodUnit?: CostPeriod;
  unitPrice: UnitPrice;
};
export type ExchangeRate = {
  from: Currency;
  to: Currency;
  /** Target-currency units per one source-currency unit. */
  rate: number;
  source?: string;
  checkedAt?: string;
};
export type MoneyBounds = {
  currency: Currency;
  minimum: number;
  maximum: number;
  expected?: number;
  exact?: number;
};
export type CalculatedCostLine = {
  input: CostLineInput;
  sourceTotal?: MoneyBounds;
  total?: MoneyBounds;
  conversion?: ExchangeRate;
};
export type LedgerIssueCode = "DUPLICATE_LINE_ID" | "INVALID_QUANTITY" | "INVALID_PERIOD" |
  "NEGATIVE_PRICE" | "INVALID_RANGE" | "VERIFICATION_PROVENANCE_MISSING" |
  "MISSING_CONVERSION_RATE" | "INVALID_EXCHANGE_RATE" | "UNKNOWN_PRICE" | "INVALID_TRAVELLER_COUNT";
export type LedgerIssue = { code: LedgerIssueCode; lineId?: string; severity: "ERROR" | "UNKNOWN" };
export type AmountSummary = {
  minimum: number;
  maximum?: number;
  expected?: number;
  exact?: number;
  unknownCount: number;
};
export type LedgerSummary = {
  trip: AmountSummary;
  perPerson: AmountSummary;
  byCategory: Record<CostCategory, AmountSummary>;
  byDay: Record<number, AmountSummary>;
  byProvenance: Record<PriceEvidenceStatus, AmountSummary>;
  unknownCostCount: number;
  minimumKnownTripEstimate: number;
  maximumEstimatedTripRange?: number;
  wholeTripTotal?: number;
  perPersonTotal?: number;
};
export type CostLedger = {
  currency: Currency;
  travellers: number;
  sourceLines: CostLineInput[];
  exchangeRates: ExchangeRate[];
  lines: CalculatedCostLine[];
  summary: LedgerSummary;
  issues: LedgerIssue[];
};
export type BudgetAssessment = {
  status: "WITHIN_BUDGET" | "LIKELY_WITHIN_BUDGET" | "BUDGET_RISK" | "OVER_BUDGET" | "UNKNOWN";
  budget: number;
  currency: Currency;
  minimum: number;
  maximum?: number;
  unknownCostCount: number;
  reasons: ("MINIMUM_EXCEEDS_BUDGET" | "RANGE_CROSSES_BUDGET" | "UNPRICED_COSTS" |
    "CURRENCY_MISMATCH" | "NO_COST_LINES" | "INVALID_LEDGER")[];
};

const CATEGORIES: CostCategory[] = ["ACCOMMODATION", "TRANSPORT", "ACTIVITIES", "ENTRY_FEES", "FOOD", "MISCELLANEOUS"];
const STATUSES: PriceEvidenceStatus[] = ["KNOWN", "ESTIMATED", "VERIFIED"];
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const validNonnegative = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

function summarize(lines: CalculatedCostLine[]): AmountSummary {
  const priced = lines.filter(line => line.total !== undefined);
  const unknownCount = lines.length - priced.length;
  const minimum = roundMoney(priced.reduce((sum, line) => sum + line.total!.minimum, 0));
  const maximum = unknownCount ? undefined : roundMoney(priced.reduce((sum, line) => sum + line.total!.maximum, 0));
  const expected = unknownCount || priced.some(line => line.total!.expected === undefined)
    ? undefined : roundMoney(priced.reduce((sum, line) => sum + line.total!.expected!, 0));
  const exact = unknownCount || priced.some(line => line.total!.exact === undefined)
    ? undefined : roundMoney(priced.reduce((sum, line) => sum + line.total!.exact!, 0));
  return { minimum, ...(maximum !== undefined ? { maximum } : {}),
    ...(expected !== undefined ? { expected } : {}), ...(exact !== undefined ? { exact } : {}), unknownCount };
}

function priceStatus(price: UnitPrice): PriceEvidenceStatus | undefined {
  return price.kind === "EXACT" ? price.evidence.status : price.kind === "RANGE" ? price.provenance.status : undefined;
}

function sourceBounds(price: UnitPrice, multiplier: number): MoneyBounds | undefined {
  if (price.kind === "UNKNOWN") return undefined;
  if (price.kind === "EXACT") {
    const amount = roundMoney(price.evidence.amount * multiplier);
    return { currency: price.evidence.currency, minimum: amount, maximum: amount, expected: amount, exact: amount };
  }
  return { currency: price.currency,
    minimum: roundMoney(price.minimum * multiplier), maximum: roundMoney(price.maximum * multiplier),
    ...(price.expected !== undefined ? { expected: roundMoney(price.expected * multiplier) } : {}) };
}

function converted(bounds: MoneyBounds, currency: Currency, rate: ExchangeRate): MoneyBounds {
  const convert = (value: number) => roundMoney(value * rate.rate);
  return { currency, minimum: convert(bounds.minimum), maximum: convert(bounds.maximum),
    ...(bounds.expected !== undefined ? { expected: convert(bounds.expected) } : {}),
    ...(bounds.exact !== undefined ? { exact: convert(bounds.exact) } : {}) };
}

/** All totals are recomputed from input lines; callers cannot provide headline totals. */
export function calculateCostLedger(sourceLines: CostLineInput[], currency: Currency,
  travellers: number, exchangeRates: ExchangeRate[] = []): CostLedger {
  const issues: LedgerIssue[] = [];
  if (!Number.isInteger(travellers) || travellers <= 0) issues.push({ code: "INVALID_TRAVELLER_COUNT", severity: "ERROR" });
  const seen = new Set<string>();
  const lines = sourceLines.map(input => {
    const invalid: LedgerIssueCode[] = [];
    if (!input.id || seen.has(input.id)) invalid.push("DUPLICATE_LINE_ID");
    seen.add(input.id);
    if (!Number.isFinite(input.quantity) || input.quantity <= 0) invalid.push("INVALID_QUANTITY");
    if (input.periodCount !== undefined && (!Number.isInteger(input.periodCount) || input.periodCount <= 0)) invalid.push("INVALID_PERIOD");
    if (input.periodCount !== undefined && !input.periodUnit || input.periodUnit && input.periodCount === undefined) invalid.push("INVALID_PERIOD");
    const price = input.unitPrice;
    if (price.kind === "EXACT") {
      if (!validNonnegative(price.evidence.amount)) invalid.push("NEGATIVE_PRICE");
      if (price.evidence.status === "VERIFIED" && (!price.evidence.source?.trim() || !price.evidence.checkedAt?.trim())) {
        invalid.push("VERIFICATION_PROVENANCE_MISSING");
      }
    } else if (price.kind === "RANGE") {
      if (!validNonnegative(price.minimum) || !validNonnegative(price.maximum)) invalid.push("NEGATIVE_PRICE");
      if (price.maximum < price.minimum || price.expected !== undefined &&
          (!validNonnegative(price.expected) || price.expected < price.minimum || price.expected > price.maximum)) invalid.push("INVALID_RANGE");
    } else issues.push({ code: "UNKNOWN_PRICE", severity: "UNKNOWN", lineId: input.id });
    for (const code of invalid) issues.push({ code, severity: "ERROR", lineId: input.id });
    const line: CalculatedCostLine = { input };
    if (invalid.length || price.kind === "UNKNOWN") return line;
    line.sourceTotal = sourceBounds(price, input.quantity * (input.periodCount ?? 1));
    if (!line.sourceTotal) return line;
    if (line.sourceTotal.currency === currency) {
      line.total = line.sourceTotal;
      return line;
    }
    const rate = exchangeRates.find(candidate => candidate.from === line.sourceTotal!.currency && candidate.to === currency);
    if (!rate) {
      issues.push({ code: "MISSING_CONVERSION_RATE", severity: "UNKNOWN", lineId: input.id });
      return line;
    }
    if (!Number.isFinite(rate.rate) || rate.rate <= 0) {
      issues.push({ code: "INVALID_EXCHANGE_RATE", severity: "ERROR", lineId: input.id });
      return line;
    }
    line.conversion = rate;
    line.total = converted(line.sourceTotal, currency, rate);
    return line;
  });
  const byCategory = Object.fromEntries(CATEGORIES.map(category => [category,
    summarize(lines.filter(line => line.input.category === category))])) as Record<CostCategory, AmountSummary>;
  const dayNumbers = [...new Set(lines.map(line => line.input.day).filter((day): day is number => day !== undefined))];
  const byDay = Object.fromEntries(dayNumbers.map(day => [day,
    summarize(lines.filter(line => line.input.day === day))])) as Record<number, AmountSummary>;
  const byProvenance = Object.fromEntries(STATUSES.map(status => [status,
    summarize(lines.filter(line => priceStatus(line.input.unitPrice) === status))])) as Record<PriceEvidenceStatus, AmountSummary>;
  const trip = summarize(lines);
  const perPerson: AmountSummary = {
    minimum: travellers > 0 ? roundMoney(trip.minimum / travellers) : 0,
    ...(travellers > 0 && trip.maximum !== undefined ? { maximum: roundMoney(trip.maximum / travellers) } : {}),
    ...(travellers > 0 && trip.expected !== undefined ? { expected: roundMoney(trip.expected / travellers) } : {}),
    ...(travellers > 0 && trip.exact !== undefined ? { exact: roundMoney(trip.exact / travellers) } : {}),
    unknownCount: trip.unknownCount,
  };
  const summary: LedgerSummary = { trip, perPerson, byCategory, byDay, byProvenance,
    unknownCostCount: trip.unknownCount,
    minimumKnownTripEstimate: trip.minimum,
    ...(trip.maximum !== undefined ? { maximumEstimatedTripRange: trip.maximum } : {}),
    ...(trip.exact !== undefined ? { wholeTripTotal: trip.exact } : {}),
    ...(perPerson.exact !== undefined ? { perPersonTotal: perPerson.exact } : {}),
  };
  return { currency, travellers, sourceLines, exchangeRates, lines, summary, issues };
}

export function compareBudget(ledger: CostLedger, budget: { amount: number; currency: Currency }): BudgetAssessment {
  const base = { budget: budget.amount, currency: budget.currency,
    minimum: ledger.summary.trip.minimum, maximum: ledger.summary.trip.maximum,
    unknownCostCount: ledger.summary.unknownCostCount };
  const result = (status: BudgetAssessment["status"], reasons: BudgetAssessment["reasons"]): BudgetAssessment =>
    ({ ...base, status, reasons });
  if (ledger.currency !== budget.currency) return result("UNKNOWN", ["CURRENCY_MISMATCH"]);
  if (ledger.issues.some(issue => issue.severity === "ERROR") || !validNonnegative(budget.amount)) return result("UNKNOWN", ["INVALID_LEDGER"]);
  if (ledger.sourceLines.length === 0) return result("UNKNOWN", ["NO_COST_LINES"]);
  if (ledger.summary.trip.minimum > budget.amount) return result("OVER_BUDGET", ["MINIMUM_EXCEEDS_BUDGET"]);
  if (ledger.summary.unknownCostCount > 0) return result("UNKNOWN", ["UNPRICED_COSTS"]);
  if (ledger.summary.trip.maximum! > budget.amount) return result("BUDGET_RISK", ["RANGE_CROSSES_BUDGET"]);
  return result(ledger.summary.trip.exact !== undefined ? "WITHIN_BUDGET" : "LIKELY_WITHIN_BUDGET", []);
}
