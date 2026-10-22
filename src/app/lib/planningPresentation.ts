import type { DetailedPlanningResult } from "./planningV2Itinerary";
import type { PlanningRouteConcept } from "./planningV2";
import type { TripBriefV1 } from "./planningTypes";
import { planningBudget } from "./planningBudget.ts";
import { resolvePlanningEndpoint } from "./planningV2Locations.ts";
import type { ArrangementStatus } from "./planningCustomization";

export const arrangementLabel = (status?: ArrangementStatus) => status === "TRAVELLER_BOOKED"
  ? "Traveler reports booked; not independently verified" : status === "NEEDS_BOOKING" ? "Needs booking"
  : status === "CHANGED_CANCELLED" ? "Changed / cancelled by traveler" : "Proposed; availability unconfirmed";
export const planningMoney = (amount: number, currency: string) => `${currency} ${amount.toLocaleString("en-GB", { maximumFractionDigits: 2 })}`;
export const planningIssueLabel = (code: string) => ({
  MUST_VISIT_UNSCHEDULED: "A must-visit destination still needs a day and transfer",
  BUDGET_OVER: "Supported costs exceed your budget target",
  ITEMS_OVERLAP: "Scheduled activities overlap",
  HARD_DRIVING_LIMIT_EXCEEDED: "Daily driving exceeds the planning limit",
}[code] ?? code.toLowerCase().replace(/_/g, " ").replace(/^./, letter => letter.toUpperCase()));

/** One detached semantic snapshot for review, approval and export. No new travel facts. */
export function planningPresentation(detail: DetailedPlanningResult, brief: TripBriefV1, concept: PlanningRouteConcept) {
  const money = (value: number) => planningMoney(value, detail.ledger.currency);
  const lines = new Map(detail.ledger.lines.map(line => [line.input.id, line]));
  const price = (id: string) => {
    const line = lines.get(id);
    if (!line?.total) return "Price to confirm";
    const bounds = line.total;
    return `${money(bounds.minimum)}${bounds.maximum !== bounds.minimum ? ` to ${money(bounds.maximum)}` : ""}`;
  };
  const endpoint = (kind: "arrival" | "departure") => {
    const point = brief[kind]; const known = point?.location ? resolvePlanningEndpoint(point.location) : undefined;
    return { kind, label: point?.location?.replace("CMB_AIRPORT", "CMB airport") ?? "Location to confirm", localDateTime: point?.dateTime,
      coordinates: known?.coordinates };
  };
  const budget = planningBudget(detail, brief);
  const data = structuredClone({
    title: detail.itinerary.routeName, brief, generationMode: detail.generationMode,
    route: concept.candidate.destinations.map((stop, index) => ({ name: stop.name, coordinates: stop.coordinates,
      nights: concept.candidate.nights[index], stay: detail.customization?.stays[stop.name],
      status: arrangementLabel(detail.customization?.stays[stop.name]?.status) })),
    endpoints: [endpoint("arrival"), endpoint("departure")],
    days: detail.itinerary.days.map(day => ({ day: day.day, date: day.date, city: day.city,
      overnightCity: day.overnightCity, stay: day.accommodation, note: day.localTip,
      stayStatus: arrangementLabel(detail.customization?.stays[day.city]?.status),
      rooms: detail.customization?.stays[day.city]?.rooms,
      items: day.items.map(item => ({ id: item.id, label: item.label, detail: item.detail, category: item.category,
        time: item.plannedStart ?? item.time, end: item.plannedEnd, duration: item.durationMinutes,
        isFreeTime: item.isFreeTime, coordinates: item.coordinates,
        cost: item.isFreeTime ? "Personal spending: include in your allowances" : price(`cost:${item.id}`) })),
      warnings: day.warnings ?? [], cost: price(`day-${day.day}:stay`) })),
    transfers: [...concept.transport.arrivalTransfer ? [concept.transport.arrivalTransfer] : [], ...concept.transport.legs,
      ...concept.transport.departureTransfer ? [concept.transport.departureTransfer] : []].map(leg => ({
      id: leg.id, from: leg.fromId.replace("CMB_AIRPORT", "CMB airport"), to: leg.toId.replace("CMB_AIRPORT", "CMB airport"),
      mode: leg.mode.replace(/_/g, " ").toLowerCase(),
      timing: leg.durationMinutes === undefined ? "Journey time unknown; confirm the service and schedule" : `${Math.ceil(leg.durationMinutes)} min road-driving estimate; allow for stops and conditions`,
      status: arrangementLabel(detail.customization?.transport[leg.id]?.status),
    })),
    budget, costLines: detail.ledger.lines.map(line => ({ label: line.input.description, day: line.input.day,
      amount: price(line.input.id), quantity: line.input.quantity, basis: line.input.chargingBasis,
      periodCount: line.input.periodCount, periodUnit: line.input.periodUnit,
      provenance: line.input.unitPrice.kind === "EXACT" ? line.input.unitPrice.evidence : line.input.unitPrice.kind === "RANGE" ? line.input.unitPrice.provenance : undefined,
      conversion: line.conversion })),
    conflicts: [...new Set(detail.validation.errors.map(issue => planningIssueLabel(issue.code)))],
    checks: [...new Set(detail.validation.issues.filter(issue => issue.severity !== "ERROR").map(issue => `${planningIssueLabel(issue.code)}${issue.day ? ` (day ${issue.day})` : ""}`))],
    unscheduled: detail.unscheduledActivities ?? [],
    requestedVisits: (detail.customization?.wishlist ?? []).filter(item => item.requirement !== "EXCLUDED"),
    season: concept.routeConcept.seasonalAssessment?.reasons ?? [],
    preparation: ["Confirm arrival/departure dates, airport transfers and buffers against your actual tickets.",
      "Check each accommodation's availability, room occupancy, rate, cancellation terms and booking reference.",
      "Confirm attraction opening hours, admission eligibility and any advance reservations directly with the venue.",
      "Confirm train or bus services, tickets and journey times; road-driving estimates are not public transport schedules.",
      "Arrange travel insurance and check current entry requirements through official channels before departure.",
      "Keep your booking references and an offline copy of the itinerary. This planner does not monitor live disruptions."],
  });
  // Exact semantic equality governs approval. The short checksum is a human reference, not a security token.
  const revision = JSON.stringify(data);
  let checksum = 2166136261;
  for (let i = 0; i < revision.length; i++) checksum = Math.imul(checksum ^ revision.charCodeAt(i), 16777619);
  return { ...data, revision, reference: (checksum >>> 0).toString(16).padStart(8, "0").toUpperCase() };
}
export type PlanningPresentation = ReturnType<typeof planningPresentation>;
