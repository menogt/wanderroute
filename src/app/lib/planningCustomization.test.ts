import assert from "node:assert/strict";
import { test } from "node:test";
import { planRouteConcepts } from "./planningV2.ts";
import { generatePlanningV2Itinerary } from "./planningV2Itinerary.ts";
import { customizationDraft, previewPlanningCustomization } from "./planningCustomization.ts";
import { redoPlanningV2Edit, undoPlanningV2Edit } from "./planningV2Editing.ts";
import { selectPlanningConcept, showPlanningConcepts, showPlanningItinerary } from "./planningV2Session.ts";
import type { CandidatePlace, TripBriefV1 } from "./planningTypes";
import type { MatrixLocation, TravelMatrix } from "./travelTimeMatrix";

const brief: TripBriefV1 = { schemaVersion: 1, durationDays: 4, travellerCount: 4, interests: ["culture"],
  budget: { amount: 2000, currency: "USD" }, requestedCities: ["Kandy"], transportPreference: "PRIVATE_DRIVER",
  arrival: { location: "CMB", dateTime: "2027-02-01T10:00" }, departure: { location: "CMB", dateTime: "2027-02-04T18:00" } };
const places: CandidatePlace[] = [
  { databaseId: "a", name: "Museum", category: "attraction", city: "Kandy", priceBasis: "PER_PERSON", priceEvidence: { amount: 10, currency: "USD", status: "KNOWN", source: "Test tariff" } },
  { databaseId: "b", name: "Garden", category: "attraction", city: "Kandy" },
  { databaseId: "stay", name: "Example catalog property", category: "hotel", city: "Kandy" },
];
function matrix(locations: MatrixLocation[]): TravelMatrix {
  return { locations, source: "OSRM_TABLE", generatedAt: "2026-10-22T00:00:00Z", legs: locations.map(from => locations.map(to => ({
    fromId: from.id, toId: to.id, status: "ROUTED", source: "OSRM_TABLE", durationMinutes: from.id === to.id ? 0 : 60, distanceKm: from.id === to.id ? 0 : 40 }))) };
}
async function original() {
  const result = await planRouteConcepts(brief, { getMatrix: async locations => matrix(locations) });
  const id = result.concepts[0].routeConcept.id;
  const detailed = await generatePlanningV2Itinerary(result, id, { getPlaces: async () => places, getAiPlan: async () => ({
    schemaVersion: 2, routeConceptId: id, days: [{ day: 1, placeIds: ["a"] }, { day: 2, placeIds: ["b"] }, { day: 3, placeIds: [] }, { day: 4, placeIds: [] }] }) });
  return showPlanningItinerary(selectPlanningConcept(showPlanningConcepts(result), id), id, detailed);
}

test("route, room, party and per-leg changes share one revision and undo restores every fact", async () => {
  const session = await original();
  const draft = customizationDraft(session);
  draft.stops = [{ city: "Kandy", nights: 2, requirement: "MUST" }, { city: "Ella", nights: 1, requirement: "OPTIONAL" }];
  draft.stays.Kandy = { placeId: "stay", rooms: 2, status: "NEEDS_BOOKING", nightlyRoomAmount: 100, rateCurrency: "USD" };
  draft.brief.travellerCount = 6;
  draft.brief.transportPreference = "MIXED";
  draft.transport["CMB_AIRPORT>Kandy"] = { mode: "PRIVATE_DRIVER", status: "PROPOSED" };
  draft.transport["Kandy>Ella"] = { mode: "TRAIN", status: "NEEDS_BOOKING" };
  const preview = previewPlanningCustomization(session, draft);
  assert.deepEqual(preview.problems, []);
  const updated = preview.session!;
  assert.deepEqual(updated.detailed!.itinerary.days.map(day => day.city), ["Kandy", "Kandy", "Ella", "Ella"]);
  assert.equal(updated.detailed!.itinerary.days[0].items.find(item => item.category === "activity")?.id,
    session.detailed!.itinerary.days[0].items.find(item => item.category === "activity")?.id);
  assert.equal(updated.detailed!.ledger.summary.byCategory.ACCOMMODATION.minimum, 400); // 2 rooms x 2 nights x 100
  assert.equal(updated.detailed!.ledger.summary.trip.minimum, 460); // plus 6 admission tickets at 10
  const train = updated.result!.concepts[0].transport.legs[0];
  assert.equal(train.mode, "TRAIN"); assert.equal(train.durationMinutes, undefined);
  assert.equal(updated.detailed!.itinerary.days[0].accommodation, "Example catalog property");
  const undone = undoPlanningV2Edit(updated);
  assert.equal(undone.result, session.result); assert.equal(undone.detailed, session.detailed);
  assert.equal(undone.selectedConceptId, session.selectedConceptId);
  const redone = redoPlanningV2Edit(undone);
  assert.equal(redone.detailed, updated.detailed); assert.equal(redone.result, updated.result);
});

test("displaced activities stay in a shortlist and impossible night totals never apply", async () => {
  const session = await original();
  const draft = customizationDraft(session);
  draft.stops = [{ city: "Ella", nights: 3, requirement: "OPTIONAL" }];
  const moved = previewPlanningCustomization(session, draft);
  assert.deepEqual(moved.problems, []);
  assert.equal(moved.session!.detailed!.unscheduledActivities?.length, 2);
  assert.deepEqual(moved.session!.detailed!.unscheduledActivities!.map(item => item.id),
    session.detailed!.itinerary.days.flatMap(day => day.items.filter(item => item.category === "activity").map(item => item.id)));
  draft.stops[0].nights = 4;
  const invalid = previewPlanningCustomization(session, draft);
  assert.equal(invalid.session, undefined); assert.match(invalid.problems.join(" "), /allow 3 nights/);
});

test("recorded bookings and locked dates require an explicit change before route edits", async () => {
  const session = await original();
  const draft = customizationDraft(session);
  draft.stays.Kandy = { name: "My booked stay", status: "TRAVELLER_BOOKED", rooms: 2 };
  const booked = previewPlanningCustomization(session, draft).session!;
  const changed = customizationDraft(booked);
  changed.stops = [{ city: "Kandy", nights: 2, requirement: "OPTIONAL" }, { city: "Ella", nights: 1, requirement: "OPTIONAL" }];
  assert.match(previewPlanningCustomization(booked, changed).problems.join(" "), /booking.*protected/);
  changed.stays.Kandy.status = "CHANGED_CANCELLED";
  assert.ok(previewPlanningCustomization(booked, changed).session);
  const lockedDraft = customizationDraft(session); lockedDraft.stops[0].locked = true;
  const locked = previewPlanningCustomization(session, lockedDraft).session!;
  const shifted = customizationDraft(locked); shifted.stops[0].nights = 2; shifted.stops.push({ city: "Ella", nights: 1, requirement: "OPTIONAL" });
  assert.match(previewPlanningCustomization(locked, shifted).problems.join(" "), /Unlock Kandy/);
  const removed = customizationDraft(locked); removed.stops = [{ city: "Ella", nights: 3, requirement: "OPTIONAL" }];
  assert.match(previewPlanningCustomization(locked, removed).problems.join(" "), /Unlock Kandy/);
  shifted.stops[0].locked = false;
  assert.ok(previewPlanningCustomization(locked, shifted).session);
});

test("mandatory visit requests remain visible conflicts rather than being counted as included", async () => {
  const session = await original(); const draft = customizationDraft(session);
  draft.wishlist.push({ city: "Dambulla", role: "VISIT", requirement: "MUST" });
  const next = previewPlanningCustomization(session, draft);
  assert.ok(next.session);
  assert.ok(next.session!.detailed!.validation.errors.some(issue => issue.code === "MUST_VISIT_UNSCHEDULED"));
  assert.equal(next.session!.detailed!.readiness, "INVALID");
  assert.ok(!next.session!.detailed!.itinerary.cities.includes("Dambulla"));
});
