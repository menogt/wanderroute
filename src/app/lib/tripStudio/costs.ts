import type { Currency } from "../../components/rl/types";
import { calculateCostLedger, type CostCategory, type CostLineInput, type ChargingBasis, type ExchangeRate } from "../costLedger.ts";
import { civilDay, sriLankaCalendarDate } from "../planningCalendar.ts";
import { formatEndpoint, stayWindow, studioLegs, type StudioPlan } from "./model.ts";
import { studioPlace } from "./catalog.ts";
import { studioCalendar } from "./dates.ts";

type PublishedRate = {
  id: string; item: string; amount: number; source: string; checked: string; region: string;
  unit: "vehicle" | "person" | "room-night" | "group";
  currency: "USD"; occupancy: string; includes: string; excludes: string; season: "not specified";
  validUntil?: string;
  fromPrice?: boolean;
};
const checked = "2026-11-19";
const CCF = "https://ccf.gov.lk/is/index.php";
const RIDELKA = "https://ridelka.com/prices/";
function rate(
  id: string, item: string, amount: number, unit: PublishedRate["unit"], source: string,
  region: string, occupancy: string, includes: string, excludes: string, fromPrice = false,
): PublishedRate {
  return { id, item, amount, unit, source, checked, region, occupancy, includes, excludes,
    fromPrice, season: "not specified", currency: "USD" };
}

function makeTransfer(from: string, to: string, sedan: number, van: number) {
  const id = `${from} → ${to}`;
  const name = `${formatEndpoint(from)} to ${formatEndpoint(to)}`;
  const included = "Driver, fuel, tolls and parking";
  const excluded = "Tickets, accommodation and extras; confirm luggage and pickup";
  return [
    rate(`${id}/sedan`, `${name} · sedan`, sedan, "vehicle", RIDELKA, name, "1–3 passengers", included, excluded),
    rate(`${id}/van`, `${name} · minivan`, van, "vehicle", RIDELKA, name, "4–6 passengers", included, excluded),
  ];
}

const transfers = [
  ...makeTransfer("CMB_AIRPORT", "Negombo", 30, 40),
  ...makeTransfer("CMB_AIRPORT", "Sigiriya", 110, 140),
  ...makeTransfer("CMB_AIRPORT", "Kandy", 90, 125),
  ...makeTransfer("CMB_AIRPORT", "Galle", 115, 140),
  ...makeTransfer("Sigiriya", "Kandy", 75, 95),
  ...makeTransfer("Kandy", "Ella", 110, 140),
  ...makeTransfer("Kandy", "Nuwara Eliya", 60, 90),
  ...makeTransfer("Nuwara Eliya", "Ella", 50, 70),
  ...makeTransfer("Ella", "Galle", 150, 195),
  ...makeTransfer("Galle", "CMB_AIRPORT", 115, 140),
];
const admissions = [
  rate("Sigiriya/Sigiriya Rock Fortress", "Sigiriya standard full ticket", 35, "person", CCF, "Sigiriya", "Full-fare visitor", "Standard admission", "Guiding, transfers, reduced-fare eligibility"),
  rate("Anuradhapura/Anuradhapura Ancient City", "Anuradhapura standard full ticket", 30, "person", CCF, "Anuradhapura", "Full-fare visitor", "Standard admission", "Guiding, transfers, reduced-fare eligibility"),
  rate("Polonnaruwa/Polonnaruwa Ancient City", "Polonnaruwa standard full ticket", 30, "person", CCF, "Polonnaruwa", "Full-fare visitor", "Standard admission", "Guiding, transfers, reduced-fare eligibility"),
  rate("Yala/Yala National Park safari", "Yala morning safari example", 160.86, "group", "https://safa.lk/parks/yala", "Yala / Tissamaharama",
    "2 standard foreign-fare adults only", "Jeep, park entry, park fees, tax and local pickup", "Tips or pickup outside the included area"),
];
export const studioRooms = [
  { rate: rate("hillcrest-double", "Hillcrest Ella · Deluxe Double", 120, "room-night",
    "https://hillcrestella.com/room/deluxe-double-room/", "Ella", "Up to 2 guests in one room",
    "Room, breakfast and tax", "Date-specific room price and availability not checked", true), capacity: 2 },
  { rate: rate("hillcrest-family", "Hillcrest Ella · Super Deluxe Family", 210, "room-night",
    "https://hillcrestella.com/room/super-deluxe-family-room/", "Ella", "Up to 5 guests in one room",
    "Room, breakfast and tax", "Date-specific room price and availability not checked", true), capacity: 5 },
];

export function currentRate(record: PublishedRate, today: string): boolean {
  const age = (civilDay(today) ?? Infinity) - (civilDay(record.checked) ?? -Infinity);
  return age >= 0 && age <= 90 && (!record.validUntil || today <= record.validUntil);
}

type StudioLine = {
  id: string; label: string; category: CostCategory; kind: "Published rate" | "Indicative estimate" |
    "User allowance" | "Recorded paid" | "Recorded price" | "Unknown";
  note?: string; evidence?: PublishedRate; paid: boolean; input: CostLineInput;
};

export function studioCosts(plan: StudioPlan, today = sriLankaCalendarDate()) {
  const lines: StudioLine[] = [];
  const add = (id: string, label: string, category: CostCategory, kind: StudioLine["kind"],
    amount?: number, currency: Currency = plan.budget.currency, quantity = 1, basis: ChargingBasis = "FIXED",
    evidence?: PublishedRate, note?: string, prepaid = false) => {
    const expired = evidence && !currentRate(evidence, today);
    const priced = amount !== undefined && !expired;
    lines.push({
      id, label, category, kind: priced ? kind : "Unknown", evidence, paid: prepaid,
      note: expired ? "This reference needs a price refresh." : note,
      input: {
        id, description: label, category, quantity, chargingBasis: basis,
        unitPrice: priced ? { kind: "EXACT", evidence: {
          status: evidence ? "ESTIMATED" : "KNOWN", amount, currency,
          ...(evidence ? { source: evidence.source, checkedAt: evidence.checked } : {}),
        } } : { kind: "UNKNOWN" },
      },
    });
  };
  const ref = (id: string, label: string, category: CostCategory, evidence: PublishedRate | undefined,
    quantity = 1, basis: ChargingBasis = "FIXED", note?: string) => {
    add(id, label, category, evidence?.fromPrice ? "Indicative estimate" : "Published rate",
      evidence?.amount, evidence?.currency, quantity, basis, evidence, note);
  };
  const legs = studioLegs(plan);
  for (const [index, leg] of legs.entries()) {
    const tier = !plan.party || plan.party > 6 ? null : plan.party <= 3 ? "sedan" : "van";
    const record = leg.mode === "private" && tier && leg.from !== "Yala" && leg.to !== "Yala"
      ? transfers.find(item => item.id === `${leg.id}/${tier}`) : undefined;
    ref(`leg-${index}`, `${formatEndpoint(leg.from)} to ${formatEndpoint(leg.to)}`, "TRANSPORT",
      record, 1, "PER_VEHICLE", !record ? "No applicable directional rate for this mode and party." : undefined);
  }
  if (!plan.start || !plan.end || !legs.length && !plan.bases.length) {
    add("missing-transfers", "Remaining transport", "TRANSPORT", "Unknown", undefined, plan.budget.currency,
      1, "FIXED", undefined, "Complete the route and check any local journeys.");
  }
  add("local-travel", "Local rides and vehicle extras", "TRANSPORT", "Unknown");
  for (const base of plan.bases) {
    const recorded = base.stay?.recorded;
    const id = `room-${base.place}`;
    if (recorded) {
      const stale = recorded.nights !== base.nights || recorded.checkIn !== stayWindow(plan, base)?.checkIn;
      add(id, base.stay!.name, "ACCOMMODATION", recorded.paid ? "Recorded paid" : "Recorded price",
        recorded.amount, recorded.currency, 1, "FIXED", undefined,
        stale ? "Previously recorded for different nights. Check whether this charge still applies." :
          "Traveler-recorded stay total.", recorded.paid);
      if (stale) {
        if (!recorded.paid) lines.pop();
        add(id + "-revised", `${base.place} · revised stay price`, "ACCOMMODATION", "Unknown");
      }
    } else {
      const chosen = studioRooms.find(item => item.rate.id === base.stay?.rateId && item.rate.region === base.place);
      const record = chosen && plan.party && plan.party <= chosen.capacity ? chosen.rate : undefined;
      ref(id, `${base.place} accommodation · ${base.nights} nights`, "ACCOMMODATION", record, base.nights,
        "PER_NIGHT", chosen && !record ? "The party does not fit one room or party size is unknown." : undefined);
    }
  }
  if (!plan.bases.length) add("accommodation", "Accommodation", "ACCOMMODATION", "Unknown");
  else if ((studioCalendar(plan.dates).nights ?? 0) > plan.bases.reduce((sum, base) => sum + base.nights, 0)) {
    add("unallocated-nights", "Accommodation for unallocated nights", "ACCOMMODATION", "Unknown");
  }
  for (const visit of plan.visits) {
    const place = studioPlace.get(visit.place);
    if (!place || place.kind === "destination") continue;
    const candidate = admissions.find(item => item.id === place.id);
    const safari = candidate?.unit === "group";
    const record = (safari ? plan.party === 2 : !!plan.party) ? candidate : undefined;
    ref(`activity-${place.id}`, place.name, safari ? "ACTIVITIES" : "ENTRY_FEES", record,
      safari ? 1 : plan.party ?? 1, safari ? "PER_GROUP" : "PER_PERSON",
      record?.unit === "person" ? "Assumes everyone pays the standard full visitor rate. Check eligibility for any reductions." : undefined);
  }
  if (!plan.visits.some(visit => studioPlace.get(visit.place)?.kind === "activity")) {
    add("admissions", "Activities and entry fees", "ACTIVITIES", "Unknown");
  }
  add("meals", "Meals and drinks", "FOOD", "User allowance", plan.budget.meals);
  add("other", "Miscellaneous and local expenses", "MISCELLANEOUS", "User allowance", plan.budget.other);

  const fx = plan.budget.usdConversion;
  const fxAge = fx ? (civilDay(today) ?? Infinity) - (civilDay(fx.checked) ?? -Infinity) : Infinity;
  const exchangeRates: ExchangeRate[] = fx && fxAge >= 0 && fxAge <= 7 && plan.budget.currency !== "USD"
    ? [{ from: "USD", to: plan.budget.currency, rate: fx.rate, checkedAt: fx.checked, source: "Traveler-provided conversion" }] : [];
  const ledger = calculateCostLedger(lines.map(line => line.input), plan.budget.currency, plan.party ?? 1, exchangeRates);
  const items = lines.map((line, i) => ({ ...line, result: ledger.lines[i] }));
  const supported = items.filter(line => line.kind !== "User allowance");
  const sum = (group: typeof items) => Math.round(group.reduce((total, line) => total + (line.result.total?.minimum ?? 0), 0) * 100) / 100;
  const unknowns = items.filter(line => !line.result.total).length;
  return {
    items, unknowns, priced: items.length - unknowns, supported: sum(supported),
    paid: sum(supported.filter(line => line.paid)),
    allowances: sum(items.filter(line => line.kind === "User allowance")),
    exceedsTarget: plan.budget.target !== undefined && sum(items) > plan.budget.target,
  };
}
