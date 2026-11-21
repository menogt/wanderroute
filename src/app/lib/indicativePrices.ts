import type { CostLineInput, ExchangeRate, UnitPrice } from "./costLedger";
import type { CandidatePlace, TripBriefV1 } from "./planningTypes";
import type { TransportLeg } from "./transportTypes";

/**
 * Indicative price ranges for planning, researched 2026-11-21 from the public pages cited on each entry.
 * They are ESTIMATED ranges for a budget check, never quotes, bookings or verified prices.
 * Amounts are USD; LKR sources are converted at the Central Cultural Fund rate below.
 */
export const PRICES_CHECKED = "2026-11-21";
const LKR_PER_USD = 336;
const SRC = {
  ccf: "https://ccf.gov.lk/is/index.php",
  tooth: "https://sridaladamaligawa.lk/faq/",
  guide: "https://lankawebsites.com/blog/practical-travel-safety-planning/how-much-does-a-trip-to-sri-lanka-cost-budget-mid-range-luxury",
  transport: "https://pickyourtrail.com/blog/transportation-in-sri-lanka",
  airport: "https://www.airporttransferportal.com/en/airport-guides/cmb",
  seat61: "https://www.seat61.com/SriLanka.htm",
  sites: "https://mysltravel.com/?p=14740",
  yala: "https://pickyourtrail.com/blog/yala-national-park-safari",
  sim: "https://pickyourtrail.com/blog/sri-lanka-sim-card-for-tourists",
  tipping: "https://exiap.co.uk/guides/spending-money-how-much-for-sri-lanka",
} as const;

/** Converts USD estimates for travellers budgeting in LKR. Other currencies stay unpriced without a sourced rate. */
export const INDICATIVE_EXCHANGE_RATES: ExchangeRate[] = [
  { from: "USD", to: "LKR", rate: LKR_PER_USD, source: SRC.ccf, checkedAt: "2026-10-14" },
];

const usd = (lkr: number) => Math.round(lkr / LKR_PER_USD * 100) / 100;
const round = (value: number) => Math.round(value * 100) / 100;
type Range = { min: number; max: number; source: string; note: string };

let enabled = true;
/** On in the app. Tests of sourced, recorded and allowance arithmetic switch it off for their whole file. */
export function setIndicativePricing(value: boolean): void { enabled = value; }

function range({ min, max, source, note }: Range): UnitPrice {
  if (!enabled) return { kind: "UNKNOWN", reason: "No sourced price available" };
  return { kind: "RANGE", minimum: round(min), maximum: round(Math.max(min, max)), currency: "USD",
    provenance: { status: "ESTIMATED", source, checkedAt: PRICES_CHECKED, note } };
}

type Tier = "budget" | "comfort" | "luxury";
const ROOM: Record<Tier, [number, number]> = { budget: [10, 30], comfort: [30, 80], luxury: [120, 400] };
const FOOD: Record<Tier, [number, number]> = { budget: [5, 10], comfort: [10, 25], luxury: [50, 100] };
/** Main season (Dec–Mar) and the July–August peak. The source says peak season adds 20–30%. */
const PEAK_MONTHS = new Set([12, 1, 2, 3, 7, 8]);

function tierBounds(table: Record<Tier, [number, number]>, tier?: Tier): [number, number] {
  return tier ? table[tier] : [table.budget[0], table.comfort[1]];
}

/** Per room, per night, for a double room. No comfort tier means budget-to-comfort. */
export function roomNightPrice(tier: Tier | undefined, month: number | undefined): UnitPrice {
  const [low, high] = tierBounds(ROOM, tier);
  const peak = month !== undefined && PEAK_MONTHS.has(month);
  const known = month !== undefined;
  return range({ min: peak ? low * 1.2 : low, max: !known || peak ? high * 1.3 : high, source: SRC.guide,
    note: `${tier ? `${tier[0].toUpperCase()}${tier.slice(1)}` : "Budget to comfort"} double room per night${peak ? ", high-season rate (+20–30%)" : known ? "" : "; upper bound allows for high season"}. Check the actual hotel.` });
}

/** Per person, per day. */
export function foodDayPrice(tier: Tier | undefined): UnitPrice {
  const [min, max] = tierBounds(FOOD, tier);
  return range({ min, max, source: SRC.guide, note: `${tier ? `${tier[0].toUpperCase()}${tier.slice(1)}` : "Budget to comfort"} meals per person per day.` });
}

/** Car with driver for one day (8–10 h), per vehicle: standard car up to 3 travellers, SUV up to 6. */
export function driverDay(travellers: number): { price: UnitPrice; vehicles: number } {
  const suv = travellers > 3;
  return { vehicles: Math.max(1, Math.ceil(travellers / (suv ? 6 : 3))), price: range({
    min: usd(suv ? 23_000 : 18_000), max: usd(suv ? 33_000 : 26_000), source: SRC.transport,
    note: `${suv ? "SUV" : "Car"} with driver, one day. Fuel, tolls and driver lodging vary by operator.` }) };
}

/** Official CMB airport taxi counter fares, one way per car (LKR). */
const AIRPORT_TAXI: Record<string, number> = { negombo: 3_780, colombo: 8_100, kandy: 21_384, sigiriya: 28_188, galle: 23_328 };

const TRAIN_FARES: { pair: [string, string]; min: number; max: number }[] = [
  { pair: ["colombo", "kandy"], min: 900, max: 2_000 },
  { pair: ["colombo", "ella"], min: 1_500, max: 3_000 },
  { pair: ["colombo", "nuwara eliya"], min: 1_500, max: 3_000 },
  { pair: ["colombo", "galle"], min: 240, max: 1_100 },
];

export type LegCost = Pick<CostLineInput, "quantity" | "chargingBasis" | "unitPrice">;

/** Prices one transfer by its chosen mode; an unchosen mode spans bus fares to a car with driver. */
export function legCost(leg: TransportLeg, brief: TripBriefV1, options: { airport?: boolean; dayVisit?: boolean } = {}): LegCost | undefined {
  const people = brief.travellerCount;
  const ends = [leg.fromId, leg.toId].map(value => value.toLowerCase());
  const other = ends.find(value => value !== "cmb_airport");
  const car = driverDay(people);
  const share = options.dayVisit ? 0.5 : 1;
  const carLeg = (): LegCost => {
    const taxi = options.airport && other ? AIRPORT_TAXI[other] : undefined;
    if (taxi && people <= 3) return { quantity: 1, chargingBasis: "PER_VEHICLE", unitPrice: range({ min: usd(taxi),
      max: car.price.kind === "RANGE" ? Math.max(usd(taxi), car.price.maximum) : usd(taxi), source: SRC.airport,
      note: "From the official airport taxi counter fare up to a day's car-with-driver hire." }) };
    if (car.price.kind !== "RANGE") return { quantity: car.vehicles, chargingBasis: "PER_VEHICLE", unitPrice: car.price };
    return { quantity: car.vehicles, chargingBasis: "PER_VEHICLE", unitPrice: range({ min: car.price.minimum * share,
      max: car.price.maximum * share, source: SRC.transport,
      note: options.dayVisit ? "Half a day of car-with-driver hire for each direction of a day visit." : car.price.provenance.note ?? "" }) };
  };
  if (leg.mode === "PRIVATE_DRIVER") return carLeg();
  if (leg.mode === "TRAIN") {
    const fare = TRAIN_FARES.find(entry => entry.pair.every(name => ends.includes(name)));
    return { quantity: people, chargingBasis: "PER_PERSON", unitPrice: range(fare
      ? { min: usd(fare.min), max: usd(fare.max), source: SRC.seat61, note: "Reserved 3rd class to 1st class, per person." }
      : { min: usd(220), max: usd(3_000), source: SRC.seat61, note: "Range of published ordinary train fares, per person. Special tourist trains cost more." }) };
  }
  if (leg.mode === "BUS" || leg.mode === "PUBLIC_TRANSPORT_UNSPECIFIED") return { quantity: people, chargingBasis: "PER_PERSON",
    unitPrice: range({ min: usd(100), max: usd(2_902), source: SRC.transport, note: "Ordinary to longest intercity bus fares, per person; AC buses cost about 50% more." }) };
  if (leg.mode === "UNASSIGNED") {
    const high = carLeg();
    // Airport transfers are nearly always by taxi or car, so they keep the car price.
    if (options.airport) return high;
    if (high.unitPrice.kind !== "RANGE") return undefined;
    const total = high.unitPrice.maximum * high.quantity;
    return { quantity: 1, chargingBasis: "FIXED", unitPrice: range({ min: usd(500) * people * share, max: total,
      source: SRC.transport, note: "Depends on the transport you choose: from long-distance bus fares for everyone up to a car with driver." }) };
  }
  return undefined;
}

/** Local journeys: tuk-tuk days, or the driver's remaining days when a car with driver is kept for the trip. */
export function localTransportCost(brief: TripBriefV1, drivingDays: number): LegCost {
  if (brief.transportPreference === "PRIVATE_DRIVER") {
    const car = driverDay(brief.travellerCount);
    const days = Math.max(1, brief.durationDays - drivingDays);
    return { quantity: car.vehicles * days, chargingBasis: "PER_VEHICLE", unitPrice: car.price.kind === "RANGE" ? range({
      min: car.price.minimum, max: car.price.maximum, source: SRC.transport,
      note: `Your driver's other ${days} day${days === 1 ? "" : "s"}; a hired driver usually stays with you for the whole tour.` }) : car.price };
  }
  const tuktuks = Math.max(1, Math.ceil(brief.travellerCount / 3));
  return { quantity: tuktuks * brief.durationDays, chargingBasis: "PER_DAY", unitPrice: range({
    min: usd(1_000), max: usd(2_000), source: SRC.guide, note: "Tuk-tuk rides around town, per tuk-tuk per day." }) };
}

/** SIM card per person plus 10–15% tips on the meal estimate. */
export function miscellaneousCost(brief: TripBriefV1, food: UnitPrice): UnitPrice {
  const meals = food.kind === "RANGE" ? [food.minimum, food.maximum] : [0, 0];
  const personDays = brief.travellerCount * brief.durationDays;
  return range({ min: usd(1_399) * brief.travellerCount + meals[0] * personDays * 0.10,
    max: usd(2_450) * brief.travellerCount + meals[1] * personDays * 0.15, source: SRC.sim,
    note: `Tourist SIM card each and 10–15% tips (${SRC.tipping}). Visa/ETA, insurance and shopping not included.` });
}

type Ticket = { match: RegExp; min: number; max: number; source: string; note?: string; perGroupOfTwo?: boolean };
const TICKETS: Ticket[] = [
  { match: /sigiriya (rock|fortress)|lion rock/, min: 35, max: 35, source: SRC.ccf },
  { match: /pidurangala/, min: usd(1_000), max: 4, source: SRC.sites },
  { match: /polonnaruwa/, min: 30, max: 30, source: SRC.ccf },
  { match: /anuradhapura|sri maha bodhi/, min: 30, max: 30, source: SRC.ccf },
  { match: /sacred tooth|dalada maligawa|temple of the tooth/, min: usd(3_000), max: usd(3_000), source: SRC.tooth },
  { match: /dambulla|golden temple|cave temple/, min: usd(3_000), max: usd(3_000), source: SRC.sites },
  { match: /peradeniya|botanic/, min: usd(3_540), max: usd(3_540), source: SRC.sites },
  { match: /pinnawala/, min: usd(2_800), max: 17.7, source: SRC.sites, note: "Sources disagree; range shown." },
  { match: /gangaramaya/, min: usd(400), max: usd(400), source: SRC.sites },
  { match: /mulkirigala/, min: usd(1_000), max: usd(1_000), source: SRC.sites },
  { match: /horton plains/, min: 33, max: 35, source: SRC.sites },
  { match: /galle fort|galle lighthouse/, min: 0, max: 6, source: SRC.sites, note: "The fort is free; the Galle museum costs about USD 6." },
  { match: /yala/, min: usd(13_000) + usd(14_000) / 2, max: usd(13_000) + usd(25_000) / 2, source: SRC.yala,
    note: "Half-day safari: park entry plus a share of the jeep for two." },
  { match: /udawalawe|minneriya|kaudulla|wilpattu|kumana/, min: 40, max: 40 + usd(25_000) / 2, source: SRC.sites,
    note: "Park fee; the upper bound adds a jeep share at Yala rates." },
  { match: /whale/, min: 50, max: 80, source: SRC.sites },
];

/** Per-person admission. Unlisted beaches are free; other unlisted sights span free to a small-site ticket. */
export function admissionPrice(place: Pick<CandidatePlace, "name" | "category"> | undefined, label: string): UnitPrice {
  const name = (place?.name ?? label).toLowerCase();
  const ticket = TICKETS.find(entry => entry.match.test(name));
  if (ticket) return range({ min: ticket.min, max: ticket.max, source: ticket.source,
    note: ticket.note ?? "Foreign adult ticket. Payment is often in LKR at the day's rate." });
  if (place?.category === "beach") return range({ min: 0, max: 0, source: SRC.guide,
    note: "Public beach; no entry ticket. Sunbeds, lessons and boat trips cost extra." });
  return range({ min: 0, max: usd(3_540), source: SRC.sites,
    note: "No ticket price on record for this place; range spans free sights to smaller paid sites." });
}
