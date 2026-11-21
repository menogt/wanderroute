import assert from "node:assert/strict";
import { test } from "node:test";
import { planRouteConcepts } from "./planningV2.ts";
import { snapshotMatrix, snapshotRoadMinutes } from "./roadSnapshotMatrix.ts";
import { spreadNights } from "./routeCandidates.ts";
import { correctedRoadMinutes, withSriLankaRoadTimes } from "./roadTimeCorrection.ts";
import { AIRPORT_DRIVE_MAX_MINUTES, typicalMaxNights } from "./routeStayPolicy.ts";
import type { TripBriefV1 } from "./planningTypes";
import type { MatrixLocation } from "./travelTimeMatrix";

// Stored OSRM road times keep these tests offline and realistic.
const roads = { getMatrix: async (locations: MatrixLocation[]) => withSriLankaRoadTimes(snapshotMatrix(locations)!), now: () => "2026-11-21T00:00:00Z" };
const base: TripBriefV1 = { schemaVersion: 1, durationDays: 10, travellerCount: 2, budget: { amount: 2000, currency: "USD" },
  interests: ["culture", "wildlife", "beaches"], requestedCities: [], travelMonth: 12 };
const stays = (result: Awaited<ReturnType<typeof planRouteConcepts>>) =>
  result.concepts[0].candidate.destinations.map((stop, index) => `${stop.name} ${result.concepts[0].candidate.nights[index]}`);

test("stay limits follow operator itineraries: 2 inland, 3 at a Sigiriya hub or beach, 4 at the beach on long trips", () => {
  assert.equal(typicalMaxNights("Kandy", base), 2);
  assert.equal(typicalMaxNights("Ella", base), 2);
  assert.equal(typicalMaxNights("Sigiriya", base), 3);
  assert.equal(typicalMaxNights("Mirissa", base), 3);
  assert.equal(typicalMaxNights("Mirissa", { ...base, durationDays: 14 }), 4);
  assert.equal(typicalMaxNights("Kandy", { ...base, pace: "SLOW_TRAVEL" }), 3);
});

test("spare nights fill open stops first and go over only when every stop is full", () => {
  assert.deepEqual(spreadNights([1, 1, 1], 3, [0, 1, 2], [2, 2, 3]), [2, 2, 2]);
  // All full after one more night at the beach: the overflow night goes to the stop allowed most nights.
  assert.deepEqual(spreadNights([2, 2, 1], 3, [0, 1, 2], [2, 2, 3]), [2, 2, 4]);
});

test("two chosen inland cities become must-sees in a full loop, not a 4-and-5-night trip", async () => {
  const result = await planRouteConcepts({ ...base, requestedCities: ["Kandy", "Ella"] }, roads);
  const first = result.concepts[0];
  const names = first.candidate.destinations.map(stop => stop.name);
  assert.ok(names.includes("Kandy") && names.includes("Ella"), stays(result).join(" > "));
  assert.ok(first.candidate.destinations.some(stop => !stop.requested), "loop stops are added");
  assert.ok(first.candidate.destinations.every((stop, index) => first.candidate.nights[index] <= typicalMaxNights(stop.name, base)), stays(result).join(" > "));
  assert.ok(names.indexOf("Kandy") < names.indexOf("Ella"));
  assert.match(first.recommendation, /Keeps all your chosen places and adds .+ to complete the loop/);
  const last = first.candidate.destinations.slice(-1)[0];
  assert.ok(snapshotRoadMinutes(last.id, "CMB_AIRPORT")! <= AIRPORT_DRIVE_MAX_MINUTES, `${last.name} is within reach of the airport`);
});

test("a trip without chosen cities finishes within reach of the airport instead of in the hills", async () => {
  for (const durationDays of [7, 10, 14]) {
    const result = await planRouteConcepts({ ...base, durationDays }, roads);
    const last = result.concepts[0].candidate.destinations.slice(-1)[0];
    assert.ok(snapshotRoadMinutes(last.id, "CMB_AIRPORT")! <= AIRPORT_DRIVE_MAX_MINUTES, `${durationDays} days: ${stays(result).join(" > ")}`);
    assert.ok(!result.concepts[0].candidate.reasons.some(reason => reason.code === "LONG_STAY" || reason.code === "LONG_AIRPORT_DRIVE"));
  }
});

test("exact cities keep only the traveller's picks and explain an over-long stay", async () => {
  const result = await planRouteConcepts({ ...base, requestedCities: ["Kandy", "Ella"] }, { ...roads, exactCities: true });
  assert.ok(result.concepts.every(concept => concept.candidate.destinations.every(stop => stop.requested)));
  const long = result.concepts[0].issues.find(issue => issue.code === "LONG_STAY");
  assert.match(long?.detail ?? "", /Local tour operators usually plan at most 2 here/);
});

test("when the live road service fails, the stored road times keep the airport and flight checks working", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error("offline"); }) as typeof fetch;
  try {
    const result = await planRouteConcepts({ ...base, requestedCities: ["Kandy", "Ella"],
      departure: { location: "CMB", dateTime: "2026-12-19T07:00" } });
    assert.match(result.matrix.snapshot ?? "", /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(result.issues.some(issue => issue.code === "ROUTING_STORED"));
    assert.equal(result.concepts[0].candidate.destinations.slice(-1)[0].name, "Negombo", "the 07:00 flight is still protected");
  } finally { globalThis.fetch = originalFetch; }
});

test("stored road times are real routed legs and unknown places stay unknown", () => {
  const matrix = snapshotMatrix([{ id: "Kandy", name: "Kandy", coordinates: { latitude: 7.29, longitude: 80.63 } },
    { id: "Ella", name: "Ella", coordinates: { latitude: 6.87, longitude: 81.05 } },
    { id: "Somewhere", name: "Somewhere", coordinates: { latitude: 7, longitude: 80 } }])!;
  assert.equal(matrix.source, "OSRM_TABLE");
  assert.equal(matrix.legs[0][1].status, "ROUTED");
  assert.ok(matrix.legs[0][1].durationMinutes! > 60);
  assert.equal(matrix.legs[0][2].status, "UNAVAILABLE");
  assert.equal(snapshotMatrix([{ id: "Somewhere", name: "Somewhere" }]), undefined);
});

test("hill-road times match sourced Sri Lankan transfer times, and OSRM is never made faster", () => {
  // OSRM 95 min / 76 km; transfer operators and a 2026 driving guide: 2.5–3 h.
  const kandyNuwaraEliya = correctedRoadMinutes("Kandy", "Nuwara Eliya", 95.4, 76);
  assert.ok(kandyNuwaraEliya >= 150 && kandyNuwaraEliya <= 180, String(kandyNuwaraEliya));
  // OSRM 69 min / 54 km; sources: 2–2.5 h.
  const nuwaraEliyaElla = correctedRoadMinutes("Nuwara Eliya", "Ella", 68.5, 54.4);
  assert.ok(nuwaraEliyaElla >= 115 && nuwaraEliyaElla <= 150, String(nuwaraEliyaElla));
  // OSRM 234 min / 208 km; sources: 4.5–5.6 h.
  const airportElla = correctedRoadMinutes("CMB_AIRPORT", "Ella", 234.1, 207.5);
  assert.ok(airportElla >= 270 && airportElla <= 336, String(airportElla));
  // Expressway (CMB–Galle at 74 km/h on OSRM) stays close to OSRM; sources: about 2.2 h.
  assert.equal(correctedRoadMinutes("CMB_AIRPORT", "Galle", 123.6, 151.5), 129.8);
  assert.equal(correctedRoadMinutes("Negombo", "Sigiriya", 300, 148), 300, "never faster than OSRM");
  assert.equal(correctedRoadMinutes("Kandy", "Ella", 100), 100, "no distance, no correction");
});

test("corrected matrices are labelled and only routed legs change", () => {
  const raw = snapshotMatrix([{ id: "Kandy", name: "Kandy", coordinates: { latitude: 7.29, longitude: 80.63 } },
    { id: "Ella", name: "Ella", coordinates: { latitude: 6.87, longitude: 81.05 } }])!;
  const corrected = withSriLankaRoadTimes(raw);
  assert.ok(corrected.roadTimes);
  assert.ok(corrected.legs[0][1].durationMinutes! > raw.legs[0][1].durationMinutes! * 1.5);
  assert.equal(corrected.legs[0][0].durationMinutes, 0);
  assert.equal(withSriLankaRoadTimes(corrected), corrected, "applied once");
});

test("a drive longer than the preferred day is split with a night on the way, as operators do", async () => {
  const result = await planRouteConcepts({ ...base, requestedCities: ["Kandy", "Ella"] }, roads);
  const names = result.concepts[0].candidate.destinations.map(stop => stop.name);
  assert.ok(names.indexOf("Kandy") < names.indexOf("Nuwara Eliya") && names.indexOf("Nuwara Eliya") < names.indexOf("Ella"), names.join(" > "));
  const longest = Math.max(...result.concepts[0].candidate.legs.map(leg => leg.durationMinutes ?? 0));
  assert.ok(longest <= 270, "no day of driving over 4.5 hours: " + longest);
});