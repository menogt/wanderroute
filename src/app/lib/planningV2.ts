import { planningCalendarProblems } from "./planningCalendar.ts";
import type { Currency, Interest } from "../components/rl/types";
import { buildCandidateDestinations, generateRouteCandidates, knownPlanningDestinations } from "./routeCandidates.ts";
import { fillAroundRequested } from "./routeFill.ts";
import { snapshotMatrix } from "./roadSnapshotMatrix.ts";
import { calculateCostLedger, compareBudget, firmCostExceedsBudget, type CostLedger, type CostLineInput } from "./costLedger.ts";
import type { RouteConceptV1, TripBriefV1 } from "./planningTypes";
import { CMB_AIRPORT, resolvePlanningEndpoint } from "./planningV2Locations.ts";
import { assessPlanningSeason, planningSeasonMonth, type PlanningSeason } from "./routeSeason.ts";
import { foodDayPrice, INDICATIVE_EXCHANGE_RATES, legCost, roomNightPrice } from "./indicativePrices.ts";
import { arrivalReadyMinute, departureDeadlineMinute, maximumPlanningBases, TRANSFER_POLICY } from "./routeConstraints.ts";
import type { CandidateRoute, PlanningDestination, RouteReason } from "./routeTypes";
import { buildTransportPlan, formatDriveTime } from "./transportPlanning.ts";
import type { TransportMode, TransportPlan } from "./transportTypes";
import { fetchTravelMatrix, type MatrixLocation, type TravelMatrix } from "./travelTimeMatrix.ts";

export type ConceptReadiness = "READY" | "READY_WITH_WARNINGS" | "NEEDS_CONFIRMATION" | "INVALID";
export type PlanningV2Issue = {
  code: string;
  severity: "ERROR" | "WARNING" | "UNKNOWN";
  detail?: string;
};
export type PlanningRouteConcept = {
  routeConcept: RouteConceptV1;
  candidate: CandidateRoute;
  transport: TransportPlan;
  ledger: CostLedger;
  readiness: ConceptReadiness;
  issues: PlanningV2Issue[];
  recommendation: string;
  /** Car-road estimates only for legs actually assigned to a private driver. */
  knownDrivingMinutes?: number;
  longestKnownDrivingLegMinutes?: number;
};
export type PlanningV2Result = {
  brief: TripBriefV1;
  destinations: PlanningDestination[];
  matrix: TravelMatrix;
  concepts: PlanningRouteConcept[];
  rejected: PlanningRouteConcept[];
  issues: PlanningV2Issue[];
};
export type PlanningV2Services = {
  getMatrix?: (locations: MatrixLocation[]) => Promise<TravelMatrix>;
  getCostLines?: (brief: TripBriefV1, route: CandidateRoute, transport: TransportPlan) => CostLineInput[];
  assignments?: Record<string, TransportMode>;
  now?: () => string;
  /** Use only the traveller's chosen cities; no classic-loop stops are added around them. */
  exactCities?: boolean;
};

const INTERESTS: Interest[] = ["beaches", "culture", "wildlife", "hiking", "food", "temples", "adventure", "photography"];
const CURRENCIES: Currency[] = ["USD", "EUR", "GBP", "AUD", "LKR"];
const ROAD_ONLY = new Set(["EXCESSIVE_DRIVING", "PREFERRED_DRIVING_EXCEEDED", "UNROUTABLE",
  "ROUTING_UNKNOWN", "ARRIVAL_CONFLICT", "DEPARTURE_CONFLICT"]);

export function validatePlanningBrief(brief: TripBriefV1): PlanningV2Issue[] {
  const issues: PlanningV2Issue[] = [];
  const error = (code: string, detail: string) => issues.push({ code, severity: "ERROR" as const, detail });
  if (brief.schemaVersion !== 1) error("BRIEF_VERSION", "This trip brief version is not supported.");
  if (!Number.isInteger(brief.durationDays) || brief.durationDays < 2 || brief.durationDays > 21) {
    error("DURATION", "Choose a trip between 2 and 21 days.");
  }
  if (!Number.isInteger(brief.travellerCount) || brief.travellerCount < 1 || brief.travellerCount > 12) {
    error("TRAVELLERS", "Choose between 1 and 12 travellers.");
  }
  if (!Number.isFinite(brief.budget?.amount) || brief.budget.amount <= 0 || brief.budget.amount > 10_000_000 ||
      !CURRENCIES.includes(brief.budget.currency)) error("BUDGET", "Enter a positive total budget and currency.");
  if (!Array.isArray(brief.interests) || brief.interests.length === 0 ||
      brief.interests.some(interest => !INTERESTS.includes(interest))) error("INTERESTS", "Choose at least one valid interest.");
  if (!Array.isArray(brief.requestedCities) || brief.requestedCities.length > 8 ||
      brief.requestedCities.some(city => typeof city !== "string" || !city.trim() || city.length > 80)) {
    error("DESTINATIONS", "Choose up to eight valid destinations, or leave them open.");
  }
  if (brief.travelMonth !== undefined && (!Number.isInteger(brief.travelMonth) || brief.travelMonth < 1 || brief.travelMonth > 12)) {
    error("TRAVEL_MONTH", "Choose a valid travel month.");
  }
  if (brief.pace !== undefined && !["SLOW_TRAVEL", "RELAXED", "BALANCED", "PACKED"].includes(brief.pace)) {
    error("PACE", "Choose a valid travel pace.");
  }
  if (brief.comfortTier !== undefined && !["budget", "comfort", "luxury"].includes(brief.comfortTier)) {
    error("COMFORT", "Choose a valid comfort tier.");
  }
  if (brief.transportPreference !== undefined && !["PRIVATE_DRIVER", "PUBLIC_TRANSPORT", "MIXED",
    "TUK_TUK_SELF_DRIVE", "RECOMMEND"].includes(brief.transportPreference)) {
    error("TRANSPORT", "Choose a valid transport preference.");
  }
  if (brief.maxPreferredDailyDrivingMinutes !== undefined &&
      (!Number.isFinite(brief.maxPreferredDailyDrivingMinutes) || brief.maxPreferredDailyDrivingMinutes < 30 ||
        brief.maxPreferredDailyDrivingMinutes > 720)) error("DRIVING_LIMIT", "Set a driving preference from 30 to 720 minutes.");
  for (const endpoint of [brief.arrival, brief.departure]) {
    if (endpoint?.location && endpoint.location.length > 100) error("ENDPOINT_LOCATION", "Keep travel locations under 100 characters.");
    if (endpoint?.dateTime && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(endpoint.dateTime) ||
        !Number.isFinite(Date.parse(endpoint.dateTime)))) error("ENDPOINT_TIME", "Enter a valid arrival or departure time.");
  }
  for (const detail of planningCalendarProblems(brief)) error("CALENDAR", detail);
  return issues;
}

function normalizedBrief(brief: TripBriefV1): TripBriefV1 {
  const seen = new Set<string>();
  const requestedCities = brief.requestedCities.map(city => city.trim()).filter(city => {
    const key = city.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const normalizeEndpoint = (endpoint: TripBriefV1["arrival"]) => endpoint && ({
    ...endpoint,
    ...(endpoint.location ? { location: resolvePlanningEndpoint(endpoint.location)?.id ?? endpoint.location.trim() } : {}),
  });
  return { ...brief, requestedCities, interests: [...new Set(brief.interests)],
    ...(brief.arrival ? { arrival: normalizeEndpoint(brief.arrival) } : {}),
    ...(brief.departure ? { departure: normalizeEndpoint(brief.departure) } : {}) };
}

/** Closest overnight base to CMB, offered when a timed early departure rules out every planned last stop. */
const AIRPORT_NIGHT_BASE = "Negombo";

function wantsAirportNight(brief: TripBriefV1): boolean {
  return !!brief.departure?.dateTime && !!brief.departure.location &&
    resolvePlanningEndpoint(brief.departure.location)?.id === CMB_AIRPORT.id;
}

function matrixLocations(destinations: PlanningDestination[], brief: TripBriefV1,
  available: MatrixLocation[]): MatrixLocation[] {
  const locations = [...destinations];
  for (const location of [brief.arrival?.location, brief.departure?.location]) {
    if (!location) continue;
    const match = resolvePlanningEndpoint(location) ?? available.find(candidate =>
      candidate.id.toLowerCase() === location.toLowerCase() || candidate.name.toLowerCase() === location.toLowerCase());
    if (match && !locations.some(candidate => candidate.id === match.id)) locations.push(match as PlanningDestination);
  }
  // The first and last airport drives are checked even without flight details: trips start and end at CMB.
  if (!locations.some(candidate => candidate.id === CMB_AIRPORT.id)) locations.push(CMB_AIRPORT as PlanningDestination);
  // Same single matrix request: include the airport-side base so it can be checked if needed.
  const airportBase = available.find(candidate => candidate.name === AIRPORT_NIGHT_BASE);
  if (wantsAirportNight(brief) && airportBase && !locations.some(candidate => candidate.id === airportBase.id)) {
    locations.push(airportBase as PlanningDestination);
  }
  return locations;
}

function unavailableMatrix(locations: MatrixLocation[], now: () => string,
  failure?: TravelMatrix["failure"]): TravelMatrix {
  return { locations, source: "UNAVAILABLE", generatedAt: now(), ...(failure ? { failure } : {}),
    legs: locations.map(from => locations.map(to => ({ fromId: from.id, toId: to.id,
      status: from.coordinates && to.coordinates ? "UNAVAILABLE" as const : "MISSING_COORDINATES" as const }))) };
}

/** Car-road estimates help every traveller except one who has chosen public transport only. */
function needsRoadMatrix(brief: TripBriefV1, assignments: Record<string, TransportMode>): boolean {
  return brief.transportPreference !== "PUBLIC_TRANSPORT" || Object.values(assignments).includes("PRIVATE_DRIVER");
}

function defaultCostLines(brief: TripBriefV1, route: CandidateRoute, transport: TransportPlan): CostLineInput[] {
  const unknown = { kind: "UNKNOWN" as const, currency: brief.budget.currency,
    reason: "Activity tickets are priced once places are chosen" };
  const lines: CostLineInput[] = [
    { id: `${route.id}:stays`, category: "ACCOMMODATION", description: "Accommodation",
      quantity: Math.ceil(brief.travellerCount / 2), periodCount: brief.durationDays - 1, periodUnit: "NIGHT",
      chargingBasis: "PER_ROOM", unitPrice: roomNightPrice(brief.comfortTier, planningSeasonMonth(brief)) },
    { id: `${route.id}:food`, category: "FOOD", description: "Meals", quantity: brief.travellerCount,
      periodCount: brief.durationDays, periodUnit: "DAY", chargingBasis: "PER_PERSON", unitPrice: foodDayPrice(brief.comfortTier) },
    { id: `${route.id}:activities`, category: "ACTIVITIES", description: "Activities", quantity: brief.travellerCount,
      chargingBasis: "PER_PERSON", unitPrice: unknown },
  ];
  const airport = new Set([transport.arrivalTransfer?.id, transport.departureTransfer?.id].filter(Boolean));
  for (const leg of [...transport.legs, transport.arrivalTransfer, transport.departureTransfer].filter(Boolean)) {
    const perPerson = ["TRAIN", "BUS", "PUBLIC_TRANSPORT_UNSPECIFIED"].includes(leg!.mode);
    const estimate = legCost(leg!, brief, { airport: airport.has(leg!.id) });
    lines.push({ id: `${route.id}:transport:${leg!.id}`, category: "TRANSPORT", description: `${leg!.fromId} to ${leg!.toId}`,
      ...(estimate ?? { quantity: perPerson ? brief.travellerCount : 1,
        chargingBasis: perPerson ? "PER_PERSON" : leg!.mode === "PRIVATE_DRIVER" ? "PER_VEHICLE" : "FIXED",
        unitPrice: { ...unknown, reason: "No sourced fare for this transport mode" } }) });
  }
  return lines;
}

function applicableRoadReason(reason: RouteReason, route: CandidateRoute, transport: TransportPlan): boolean {
  if (!ROAD_ONLY.has(reason.code)) return true;
  if (transport.preference === "PRIVATE_DRIVER") return true;
  // Airport transfers are almost always by car or taxi, so an unchosen mode is checked like a car.
  const carLike = (mode?: TransportMode) => mode === "PRIVATE_DRIVER" || mode === "UNASSIGNED";
  if (reason.code === "ARRIVAL_CONFLICT") return carLike(transport.arrivalTransfer?.mode);
  if (reason.code === "DEPARTURE_CONFLICT") return carLike(transport.departureTransfer?.mode);
  const places = (reason.destinations ?? []).map(value => value.toLowerCase());
  const leg = route.legs.find(candidate => places.includes(candidate.fromId.toLowerCase()) &&
    places.includes(candidate.toId.toLowerCase()));
  if (leg) return transport.legs.some(candidate => candidate.fromId === leg.fromId &&
    candidate.toId === leg.toId && candidate.mode === "PRIVATE_DRIVER");
  if (reason.code === "ROUTING_UNKNOWN" || reason.code === "UNROUTABLE") {
    return [transport.arrivalTransfer, transport.departureTransfer].some(candidate => candidate?.mode === "PRIVATE_DRIVER" &&
      places.includes(candidate.fromId.toLowerCase()) && places.includes(candidate.toId.toLowerCase()));
  }
  return false;
}

function clockText(minute: number): string {
  const value = ((Math.round(minute) % 1440) + 1440) % 1440;
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

const placeName = (value: string) => value === CMB_AIRPORT.id ? "CMB airport" : value;
const listNames = (names: string[]) => names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

/** Plain-language airport transfer conflicts with the times a traveller can act on. */
function transferConflictDetail(reason: RouteReason, brief?: TripBriefV1): string | undefined {
  const minutes = Number(reason.details?.transferMinutes);
  const [endpoint, stop] = (reason.destinations ?? []).map(placeName);
  if (!brief || !Number.isFinite(minutes) || !endpoint || !stop) return undefined;
  if (reason.code === "DEPARTURE_CONFLICT") {
    const deadline = departureDeadlineMinute(brief);
    if (deadline === undefined) return undefined;
    const leave = deadline - minutes;
    const flight = clockText(deadline + TRANSFER_POLICY.departureBufferMinutes);
    return `${stop} to ${endpoint} is about ${formatDriveTime(minutes)} by car. To arrive ${TRANSFER_POLICY.departureBufferMinutes / 60} hours before your ${flight} flight you would leave at ${clockText(leave)}${leave < 0 ? " the night before" : ""}. Spend your last night nearer the airport, such as ${AIRPORT_NIGHT_BASE}.`;
  }
  if (reason.code === "ARRIVAL_CONFLICT") {
    const ready = arrivalReadyMinute(brief);
    if (ready === undefined) return undefined;
    return `${endpoint} to ${stop} is about ${formatDriveTime(minutes)} by car after you clear the airport around ${clockText(ready)}. Spend your first night nearer the airport, such as ${AIRPORT_NIGHT_BASE}.`;
  }
  return undefined;
}

function reasonDetail(reason: RouteReason, brief?: TripBriefV1): string {
  const conflict = transferConflictDetail(reason, brief);
  if (conflict) return conflict;
  if (reason.code === "LONG_STAY" && reason.destinations?.[0]) {
    return `${reason.destinations[0]}: ${reason.details?.nights} nights. Local tour operators usually plan at most ${reason.details?.typicalMaximum} here and add another stop or day trips instead.`;
  }
  const airportMinutes = Number(reason.details?.transferMinutes);
  if (reason.code === "LONG_AIRPORT_DRIVE" && reason.destinations?.[1] && Number.isFinite(airportMinutes)) {
    const [endpoint, stop] = reason.destinations.map(placeName);
    return reason.details?.direction === "ARRIVAL"
      ? `${stop} is about ${formatDriveTime(airportMinutes)} by car from ${endpoint}, a long first day after a flight. Local operators usually spend the first night within about 3.5 hours of the airport.`
      : `${stop} is about ${formatDriveTime(airportMinutes)} by car from ${endpoint}, a long drive on departure day. Local operators usually finish within about 3.5 hours of the airport, often on the south-west coast.`;
  }
  const places = reason.destinations?.map(placeName).join(" to ");
  const names: Record<string, string> = {
    REQUESTED_CITY_UNAVAILABLE: "A requested destination has no trusted coordinates",
    REQUESTED_CITY_OMITTED: "A requested destination does not fit this route",
    INSUFFICIENT_DAYS: "Too many stops for the available days",
    EXCESSIVE_DRIVING: "A road transfer exceeds the hard driving limit",
    PREFERRED_DRIVING_EXCEEDED: "A road transfer exceeds the preferred driving time",
    UNROUTABLE: "The road service reports no route",
    ROUTING_UNKNOWN: "Road routing is unavailable",
    SEASON_AVOID: "Strong seasonal conflict",
    SEASON_CAUTION: "Seasonal caution",
    SEASON_UNKNOWN: "Seasonal conditions need confirmation",
    ARRIVAL_CONFLICT: "Arrival transfer does not fit the available time",
    DEPARTURE_CONFLICT: "Departure transfer does not fit the available time",
    ARRIVAL_TIME_UNKNOWN: "Arrival transfer time cannot be checked",
    DEPARTURE_TIME_UNKNOWN: "Departure transfer time cannot be checked",
    ENDPOINT_UNKNOWN: "Arrival or departure location cannot be routed",
    BACKTRACKING: "The route reverses direction",
    DESTINATION_SWITCHING: "Changing bases takes travel time",
    ROUTE_REDUCED: "The route has been shortened to fit the trip",
  };
  return `${names[reason.code] ?? reason.code}${places ? `: ${places}` : ""}`;
}

function neutralRank(route: CandidateRoute): number {
  return route.score.components.requestedCoverage + route.score.components.season +
    route.score.components.switching + route.score.components.backtracking +
    route.score.components.stays + route.score.components.airportDrive -
    route.reasons.filter(reason => reason.code === "REQUESTED_CITY_UNAVAILABLE" ||
      reason.code === "ENDPOINT_UNKNOWN").length * 20;
}

export function createConcept(brief: TripBriefV1, route: CandidateRoute, matrix: TravelMatrix,
  services: PlanningV2Services): PlanningRouteConcept {
  const transport = buildTransportPlan(route, brief, matrix, services.assignments);
  const effectiveReasons = route.reasons.filter(reason => applicableRoadReason(reason, route, transport));
  const costLines = services.getCostLines?.(brief, route, transport) ?? defaultCostLines(brief, route, transport);
  const ledger = calculateCostLedger(costLines, brief.budget.currency, brief.travellerCount, INDICATIVE_EXCHANGE_RATES);
  const budget = compareBudget(ledger, brief.budget);
  const issues: PlanningV2Issue[] = effectiveReasons.map(reason => ({
    code: reason.code,
    severity: reason.severity === "REJECTION" ? "ERROR" : reason.severity === "UNCERTAIN" ? "UNKNOWN" : "WARNING",
    detail: reasonDetail(reason, brief),
  }));
  if (transport.readiness.status !== "SUPPORTED") issues.push({ code: "TRANSPORT_CONFIRMATION", severity: "UNKNOWN",
    detail: transport.readiness.reasons.includes("PUBLIC_SCHEDULE_UNAVAILABLE")
      ? "Train and bus schedules, connections and fares are not available yet."
      : "Transport mode or journey timing needs confirmation." });
  if (ledger.summary.unknownCostCount) issues.push({ code: "COST_INCOMPLETE", severity: "UNKNOWN",
    detail: ledger.sourceLines.every(line => line.unitPrice.kind !== "UNKNOWN" || line.category === "ACTIVITIES")
      ? "Rooms, meals and transfers are estimated; activity tickets are added once places are chosen."
      : `${ledger.summary.unknownCostCount} cost ${ledger.summary.unknownCostCount === 1 ? "item needs" : "items need"} a price.` });
  else if (budget.status === "UNKNOWN") issues.push({ code: "COST_INCOMPLETE", severity: "UNKNOWN",
    detail: "The available prices are not enough to confirm the trip budget." });
  for (const issue of ledger.issues.filter(issue => issue.severity === "ERROR")) issues.push({
    code: `COST_${issue.code}`, severity: "ERROR", detail: "A supplied cost line is invalid." });
  if (budget.status === "OVER_BUDGET") issues.push(firmCostExceedsBudget(ledger, brief.budget)
    ? { code: "BUDGET_OVER", severity: "ERROR", detail: "The minimum known cost exceeds the total budget." }
    : { code: "BUDGET_OVER", severity: "WARNING",
      detail: "Even the low cost estimate is above your budget. Budget stays, fewer days or buses and trains bring it down." });
  else if (budget.status === "BUDGET_RISK") issues.push({ code: "BUDGET_RISK", severity: "WARNING",
    detail: "The estimated cost range crosses the total budget." });
  const readiness: ConceptReadiness = issues.some(issue => issue.severity === "ERROR") ? "INVALID" :
    issues.some(issue => issue.severity === "UNKNOWN") ? "NEEDS_CONFIRMATION" :
      issues.some(issue => issue.severity === "WARNING") ? "READY_WITH_WARNINGS" : "READY";
  const knownDriverLegs = [...transport.legs, transport.arrivalTransfer, transport.departureTransfer].filter((leg): leg is NonNullable<typeof leg> => !!leg).filter(leg => leg.mode === "PRIVATE_DRIVER" && leg.durationMinutes !== undefined);
  const knownDrivingMinutes = knownDriverLegs.length ? knownDriverLegs.reduce((sum, leg) => sum + leg.durationMinutes!, 0) : undefined;
  const longestKnownDrivingLegMinutes = knownDriverLegs.length ? Math.max(...knownDriverLegs.map(leg => leg.durationMinutes!)) : undefined;
  const stopIds = route.destinations.map(destination => `${route.id}:${destination.id}`);
  const lastStop = route.destinations[route.destinations.length - 1];
  const recommendation = wantsAirportNight(brief) && lastStop?.name === AIRPORT_NIGHT_BASE && !lastStop.requested
    ? `Ends with a night in ${AIRPORT_NIGHT_BASE}, close to CMB, so your departure flight is within reach.` :
    route.destinations.length === 1 ? "One base keeps this trip simple." :
    route.destinations.filter(destination => destination.requested).length === brief.requestedCities.length &&
      brief.requestedCities.length ? (route.destinations.some(destination => !destination.requested)
        ? `Keeps all your chosen places and adds ${listNames(route.destinations.filter(destination => !destination.requested).map(destination => destination.name))} to complete the loop, as local tour operators plan it.`
        : "Keeps all requested destinations.") :
      "Balances destination coverage with the available days.";
  const routeConcept: RouteConceptV1 = {
    schemaVersion: 1, id: route.id, tripBriefVersion: 1,
    stops: route.destinations.map((destination, index) => ({ id: stopIds[index],
      destinationName: destination.name, nights: route.nights[index] })),
    roadLegs: route.legs.map((leg, index) => ({ fromStopId: stopIds[index], toStopId: stopIds[index + 1],
      ...(leg.durationMinutes !== undefined ? { drivingDurationMinutes: leg.durationMinutes } : {}),
      ...(leg.distanceKm !== undefined ? { drivingDistanceKm: leg.distanceKm } : {}) })),
    ...(ledger.summary.trip.maximum !== undefined ? { estimatedBudgetRange: {
      minimum: ledger.summary.trip.minimum, maximum: ledger.summary.trip.maximum, currency: ledger.currency } } : {}),
    seasonalAssessment: { status: effectiveReasons.some(reason => reason.code === "SEASON_AVOID") ? "UNSUITABLE" :
      effectiveReasons.some(reason => reason.code === "SEASON_CAUTION") ? "CAUTION" :
        effectiveReasons.some(reason => reason.code === "SEASON_UNKNOWN") ? "UNKNOWN" : "SUITABLE",
      reasons: effectiveReasons.filter(reason => reason.code.startsWith("SEASON_")).map(reason => reasonDetail(reason, brief)) },
    tradeoffs: issues.map(issue => issue.detail).filter((value): value is string => !!value),
    constraintResults: effectiveReasons.map(reason => ({ constraint: reason.code,
      satisfied: reason.severity === "REJECTION" ? false : reason.severity === "UNCERTAIN" ? null : true,
      explanation: reasonDetail(reason, brief) })),
    explanation: recommendation, generatedAt: services.now?.() ?? new Date().toISOString(),
    generatorVersion: "planning-v2-route-1",
  };
  return { routeConcept, candidate: route, transport, ledger, readiness, issues, recommendation,
    ...(knownDrivingMinutes !== undefined ? { knownDrivingMinutes, longestKnownDrivingLegMinutes } : {}) };
}

/** One bounded route-matrix request at most. All generation and scoring remain deterministic. */
export async function planRouteConcepts(rawBrief: TripBriefV1,
  services: PlanningV2Services = {}): Promise<PlanningV2Result> {
  const validation = validatePlanningBrief(rawBrief);
  if (validation.length) throw new PlanningBriefError(validation);
  const brief = normalizedBrief(rawBrief);
  const available = knownPlanningDestinations();
  // Chosen cities are must-sees; the classic loop fills any nights they cannot carry at operator stay lengths.
  const chosen = buildCandidateDestinations(brief, available);
  const destinations = services.exactCities ? chosen : fillAroundRequested(brief, chosen, available, maximumPlanningBases(brief));
  if (!destinations.length) throw new PlanningBriefError([{ code: "NO_DESTINATIONS", severity: "ERROR",
    detail: "No destinations are available for this brief." }]);
  const locations = matrixLocations(destinations, brief, [...available, CMB_AIRPORT]);
  const now = services.now ?? (() => new Date().toISOString());
  const assignments = services.assignments ?? {};
  let matrix: TravelMatrix;
  if (!needsRoadMatrix(brief, assignments)) matrix = unavailableMatrix(locations, now);
  else if (services.getMatrix) {
    try { matrix = await services.getMatrix(locations); }
    catch { matrix = unavailableMatrix(locations, now, "NETWORK_ERROR"); }
  } else {
    // The live public OSRM service is free but not guaranteed; fall back to the same data stored on a known date.
    try { matrix = await fetchTravelMatrix(locations, { timeoutMs: 7000 }); }
    catch { matrix = unavailableMatrix(locations, now, "NETWORK_ERROR"); }
    if (matrix.source === "UNAVAILABLE") matrix = snapshotMatrix(locations) ?? matrix;
  }
  const month = planningSeasonMonth(brief);
  const seasons = new Map(destinations.map(destination => [destination.id,
    assessPlanningSeason(destination.name, month)] as [string, PlanningSeason]));
  let candidates = generateRouteCandidates(brief, destinations, matrix, seasons);
  // When the flight time rules out every planned last stop, offer the same trip ending near CMB.
  const airportBase = available.find(candidate => candidate.name === AIRPORT_NIGHT_BASE);
  if (wantsAirportNight(brief) && airportBase && !destinations.some(stop => stop.id === airportBase.id) &&
      candidates.length && candidates.every(candidate => candidate.reasons.some(reason => reason.code === "DEPARTURE_CONFLICT"))) {
    const base = { ...airportBase, requested: false };
    const endsAtBase = (candidate: CandidateRoute) => candidate.destinations[candidate.destinations.length - 1]?.id === airportBase.id;
    // The same routes with one airport-side night appended keep their loop order; the general search adds other shapes.
    const oneNight = { finalNights: 1 };
    const appended = candidates.slice(0, 8).flatMap(route => {
      const order = [...route.destinations, base];
      const id = `route:${order.map(stop => encodeURIComponent(stop.id)).join(">")}`;
      return generateRouteCandidates(brief, order, matrix, seasons, oneNight).filter(candidate => candidate.id === id);
    });
    const extended = [...new Map([...appended, ...generateRouteCandidates(brief, [...destinations, base], matrix, seasons, oneNight)]
      .filter(candidate => endsAtBase(candidate) && !candidates.some(existing => existing.id === candidate.id))
      .map(candidate => [candidate.id, candidate])).values()];
    // Prefer endings that keep every requested place; drop-a-place variants only if nothing else fits.
    const complete = extended.filter(candidate => !candidate.reasons.some(reason => reason.code === "REQUESTED_CITY_OMITTED"));
    candidates = [...candidates, ...(complete.length ? complete : extended)];
  }
  const all = candidates.map(candidate => createConcept(brief, candidate, matrix, services));
  const roadRanking = brief.transportPreference === "PRIVATE_DRIVER";
  all.sort((a, b) => Number(a.readiness === "INVALID") - Number(b.readiness === "INVALID") ||
    (roadRanking ? b.candidate.score.rankValue - a.candidate.score.rankValue :
      neutralRank(b.candidate) - neutralRank(a.candidate)) ||
      destinations.findIndex(stop => stop.id === a.candidate.destinations[0]?.id) - destinations.findIndex(stop => stop.id === b.candidate.destinations[0]?.id) || a.routeConcept.id.localeCompare(b.routeConcept.id));
  const valid = all.filter(concept => concept.readiness !== "INVALID");
  const distinctSets = new Set<string>();
  const selected: PlanningRouteConcept[] = [];
  // Options with stays or airport drives operators would not plan are shown only to keep a choice of two.
  const flagged = (concept: PlanningRouteConcept) => concept.candidate.reasons.some(reason =>
    reason.code === "LONG_STAY" || reason.code === "LONG_AIRPORT_DRIVE");
  for (const [pass, limit] of [[false, 3], [true, 2]] as const) {
    for (const concept of valid) {
      if (selected.length >= limit) break;
      if (flagged(concept) !== pass) continue;
      const key = concept.candidate.destinations.map(destination => destination.id).sort().join("|");
      if (distinctSets.has(key)) continue;
      selected.push(concept);
      distinctSets.add(key);
    }
  }
  const issues: PlanningV2Issue[] = [];
  if (matrix.failure) issues.push({ code: matrix.failure === "TIMEOUT" ? "ROUTING_TIMEOUT" : "ROUTING_UNAVAILABLE",
    severity: "UNKNOWN", detail: "Road routing is unavailable. Retry to check driving estimates." });
  if (matrix.snapshot) issues.push({ code: "ROUTING_STORED", severity: "WARNING",
    detail: `The live road service did not respond, so driving times come from the same service's data stored on ${matrix.snapshot}.` });
  if (destinations.some(destination => !destination.coordinates)) issues.push({ code: "COORDINATES_MISSING",
    severity: "UNKNOWN", detail: "Some requested destinations have no trusted coordinates." });
  if (!selected.length) issues.push({ code: "NO_FEASIBLE_CONCEPTS", severity: "ERROR",
    detail: "No route meets the current constraints. Try more days, fewer stops or different travel times." });
  return { brief, destinations, matrix, concepts: selected,
    rejected: all.filter(concept => concept.readiness === "INVALID").slice(0, 3), issues };
}

export class PlanningBriefError extends Error {
  readonly issues: PlanningV2Issue[];
  constructor(issues: PlanningV2Issue[]) {
    super(issues.map(issue => issue.detail).join(" "));
    this.name = "PlanningBriefError";
    this.issues = issues;
  }
}
