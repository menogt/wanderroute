import assert from "node:assert/strict";
import test from "node:test";
import type { TravelMatrix } from "../travelTimeMatrix.ts";
import { changeDateMode, studioCalendar } from "./dates.ts";
import { studioCosts } from "./costs.ts";
import { canScheduleVisit, lockedStayConflict, newStudioPlan, orderAlternative, replaceBases, roadLocations, stayWindow,
  studioDays, studioIssues, studioLegs, wishlistOutline, type StudioPlan } from "./model.ts";
import { loadStudio, redoStudio, reviseStudio, saveStudio, undoStudio, validStudioPlan } from "./storage.ts";

const exact = { kind: "exact", arrival: "2026-12-10", departure: "2026-12-17" } as const;
const baseTrip = (): StudioPlan => ({
  ...newStudioPlan(), start: "CMB_AIRPORT", end: "CMB_AIRPORT", party: 2, mode: "private",
  dates: exact, bases: [{ place: "Sigiriya", nights: 2 }, { place: "Kandy", nights: 2 }, { place: "Galle", nights: 3 }],
});
function fixture(plan: StudioPlan, favoredArcs: string[] = []): TravelMatrix {
  const locations = roadLocations(plan);
  return {
    locations, source: "OSRM_TABLE", generatedAt: "2026-11-19",
    legs: locations.map(a => locations.map(b => ({
      fromId: a.id, toId: b.id, status: "ROUTED", source: "OSRM_TABLE",
      durationMinutes: a.id === b.id ? 0 : favoredArcs.includes(`${a.id}:${b.id}`) ? 70 : 180,
      distanceKm: a.id === b.id ? 0 : 100,
    }))),
  };
}

test("exact civil days derive nights and both months from one calendar, including year boundaries", () => {
  assert.deepEqual(studioCalendar(exact).days, 8);
  assert.deepEqual(studioCalendar(exact).nights, 7);
  const cross = studioCalendar({ ...exact, arrival: "2026-12-30", departure: "2027-01-02" });
  assert.deepEqual([cross.days, cross.nights, cross.startMonth, cross.endMonth], [4, 3, "2026-12", "2027-01"]);
  assert.ok(studioCalendar({ ...exact, arrival: "2026-12-10T00:00:00+05:30" }).issue);
  assert.ok(studioCalendar({ ...exact, departure: "2026-12-09" }).issue);
});
test("approximate itinerary is undated and a single known endpoint gives only a provisional opposite date", () => {
  const approximate = { kind: "approximate", period: "2026-12", days: 7 } as const;
  assert.deepEqual(studioCalendar(approximate), { days: 7, nights: 6, month: 12 });
  const plan = { ...baseTrip(), dates: approximate };
  assert.ok(studioDays(plan).every(day => day.date === undefined));
  const partial = { kind: "partial", anchor: "departure", date: "2027-01-03", days: 7, time: "08:00" } as const;
  assert.equal(studioCalendar(partial).start, "2026-12-28");
  assert.equal(studioCalendar(partial).provisional, "arrival");
  assert.deepEqual(changeDateMode(partial, "exact", 7), { kind: "exact", arrival: "", departure: "2027-01-03", arrivalTime: undefined, departureTime: "08:00" });
  assert.ok(studioCalendar({ ...approximate, period: "2026-13" }).issue);
});
test("mode change keeps traveler choices and flags newly unallocated nights", () => {
  const plan = baseTrip();
  plan.wishes = [{ place: "Galle", required: true }];
  const next = { ...plan, dates: { ...exact, departure: "2026-12-18" } };
  const history = reviseStudio({ current: plan, past: [], future: [], saved: [] }, next);
  assert.equal(history.current.wishes, plan.wishes);
  assert.match(studioIssues(next)[0].message, /allocate 1 more night/i);
  assert.equal(studioDays(next).find(day => day.key === "unallocated:7")?.date, "2026-12-17");
  assert.equal(studioDays(next).find(day => day.key === "departure")?.date, "2026-12-18");
});
test("seven-day circuit includes both airport transfers, with no extra airport night", () => {
  const plan = baseTrip();
  plan.dates = { kind: "approximate", period: "2026-12", days: 7 };
  plan.bases[2].nights = 2;
  const legs = studioLegs(plan, fixture(plan));
  assert.deepEqual(legs.map(x => [x.from, x.to, x.day]), [
    ["CMB_AIRPORT", "Sigiriya", 1], ["Sigiriya", "Kandy", 3], ["Kandy", "Galle", 5], ["Galle", "CMB_AIRPORT", 7],
  ]);
  assert.equal(studioDays(plan).length, 7);
  assert.equal(studioDays(plan).filter(day => day.base).length, 6);
});
test("a compact short trip outline preserves saved places and asks for fewer bases when nights do not fit", () => {
  const plan: StudioPlan = { ...newStudioPlan(), dates: { kind: "approximate", period: "2026-12", days: 5 },
    wishes: [{ place: "Sigiriya", required: true }, { place: "Kandy", required: false }] };
  assert.deepEqual(wishlistOutline(plan).bases, [{ place: "Sigiriya", nights: 2 }, { place: "Kandy", nights: 2 }]);
  assert.equal(plan.wishes[0].required, true);
  const tooShort = { ...plan, dates: { kind: "approximate", period: "2026-12", days: 2 } as const };
  assert.match(wishlistOutline(tooShort).error ?? "", /too many saved destinations/i);
});
test("12-day route alternatives retain every one of the chosen bases and a different ending point", () => {
  const plan = baseTrip();
  plan.end = "MATTALA";
  plan.dates = { kind: "approximate", period: "2026-12", days: 12 };
  plan.bases = [{ place: "Ella", nights: 3 }, { place: "Sigiriya", nights: 4 }, { place: "Kandy", nights: 4 }];
  const alternative = orderAlternative(plan, fixture(plan, [
    "CMB_AIRPORT:Sigiriya", "Sigiriya:Kandy", "Kandy:Ella", "Ella:MATTALA",
  ]));
  assert.equal(studioLegs(plan).slice(-1)[0].to, "MATTALA");
  assert.deepEqual(alternative?.bases.map(base => base.place), ["Sigiriya", "Kandy", "Ella"]);
  assert.equal(alternative?.total, 280);
  assert.equal(orderAlternative(plan, undefined), undefined);
  assert.equal(orderAlternative({ ...plan, mode: "rail" }, fixture(plan)), undefined);
});
test("three heritage towns can share one base with separate day visits and real directed return legs", () => {
  const plan = { ...baseTrip(), bases: [{ place: "Sigiriya", nights: 3 }] };
  plan.visits = [
    { place: "Anuradhapura/Anuradhapura Ancient City", dayKey: "Sigiriya:1" },
    { place: "Polonnaruwa/Polonnaruwa Ancient City", dayKey: "Sigiriya:2" },
  ];
  assert.deepEqual(studioLegs(plan).filter(leg => leg.kind === "visit").map(leg => [leg.from, leg.to]), [
    ["Sigiriya", "Anuradhapura"], ["Anuradhapura", "Sigiriya"], ["Sigiriya", "Polonnaruwa"], ["Polonnaruwa", "Sigiriya"],
  ]);
  assert.equal(validStudioPlan(plan), true);
  assert.equal(canScheduleVisit(plan, "Polonnaruwa/Polonnaruwa Ancient City", "Sigiriya:1"), false);
  assert.equal(canScheduleVisit(plan, "Polonnaruwa/Polonnaruwa Ancient City", "departure"), false);
  assert.match(replaceBases(plan, [{ place: "Sigiriya", nights: 2 }]).error ?? "", /move or remove/i);
});
test("late arrival, early flight, and too many nights produce actionable warnings rather than edits", () => {
  const plan = baseTrip();
  plan.dates = { ...exact, arrivalTime: "22:30", departureTime: "07:00" };
  assert.equal(canScheduleVisit(plan, "Sigiriya/Sigiriya Rock Fortress", "Sigiriya:0"), false);
  const messages = studioIssues(plan, fixture(plan)).map(issue => issue.message).join("\n");
  assert.match(messages, /past midnight/);
  assert.match(messages, /early or previous-night/);
  const expanded = replaceBases(plan, [{ place: "Sigiriya", nights: 8 }]).plan!;
  assert.equal(studioCalendar(expanded.dates).end, exact.departure);
  assert.match(studioIssues(expanded)[0].message, /remove 1 allocated night/i);
});
test("locked bookings constrain night and order edits and conflicting date changes keep the recorded dates", () => {
  const plan = baseTrip();
  const stay = stayWindow(plan, plan.bases[1])!;
  plan.bases[1].stay = { name: "Kandy stay", lock: stay };
  assert.ok(replaceBases(plan, [{ ...plan.bases[0], nights: 3 }, ...plan.bases.slice(1)]).error);
  assert.ok(replaceBases(plan, [plan.bases[1], plan.bases[0], plan.bases[2]]).error);
  const changed = { ...plan, dates: { ...exact, arrival: "2026-12-11" } };
  assert.equal(lockedStayConflict(changed)?.place, "Kandy");
  assert.equal(changed.bases[1].stay?.lock?.checkIn, "2026-12-12");
});
test("season warnings use the scheduled region and date across a month boundary", () => {
  const plan: StudioPlan = { ...baseTrip(),
    dates: { kind: "exact", arrival: "2026-10-30", departure: "2026-11-03" },
    bases: [{ place: "Galle", nights: 2 }, { place: "Ella", nights: 2 }],
  };
  const notes = studioIssues(plan).map(issue => issue.message);
  assert.ok(notes.some(note => note.includes("Galle · 2026-10")));
  assert.ok(notes.some(note => note.includes("Ella · 2026-11")));
});
test("private vehicle and admission units differ, and the supported subtotal includes the return", () => {
  const plan = { ...baseTrip(), bases: [{ place: "Galle", nights: 2 }] };
  let cost = studioCosts(plan, "2026-11-20");
  assert.equal(cost.supported, 230);
  assert.ok(cost.unknowns > 0);
  plan.party = 5;
  assert.equal(studioCosts(plan, "2026-11-20").supported, 280);
  plan.visits = [{ place: "Polonnaruwa/Polonnaruwa Ancient City", dayKey: "Galle:1" }];
  cost = studioCosts(plan, "2026-11-20");
  assert.equal(cost.items.find(line => line.category === "ENTRY_FEES")?.result.total?.minimum, 150);
});
test("published room review uses one-room occupancy and dated FX; paid stay totals supersede reference prices", () => {
  const plan = baseTrip();
  plan.bases = [{ place: "Ella", nights: 2, stay: { name: "Hillcrest Ella", rateId: "hillcrest-double" } }];
  plan.mode = "rail";
  assert.equal(studioCosts(plan, "2026-11-20").supported, 240);
  plan.party = 3;
  assert.equal(studioCosts(plan, "2026-11-20").supported, 0);
  plan.bases[0].stay!.recorded = { amount: 125, currency: "USD", paid: true, nights: 2, checkIn: exact.arrival };
  plan.budget = { currency: "EUR" };
  assert.equal(studioCosts(plan, "2026-11-20").supported, 0);
  plan.budget.usdConversion = { rate: .9, checked: "2026-11-19" };
  assert.equal(studioCosts(plan, "2026-11-20").paid, 112.5);
  assert.equal(studioCosts(plan, "2026-11-28").paid, 0);
});
test("included safari tickets are counted once and stale references remain unknown", () => {
  const plan = { ...baseTrip(), start: null, end: null, bases: [{ place: "Yala", nights: 3 }],
    visits: [{ place: "Yala/Yala National Park safari", dayKey: "Yala:1" }] };
  const costs = studioCosts(plan, "2026-11-20");
  assert.equal(costs.supported, 160.86);
  assert.equal(costs.items.filter(line => line.category === "ENTRY_FEES" || line.category === "ACTIVITIES").length, 1);
  assert.equal(studioCosts(plan, "2027-06-01").supported, 0);
});
test("the Studio history restores valid revisions, rejects invalid imports, and keeps unrelated visits through edits", () => {
  const plan = baseTrip();
  plan.visits = [{ place: "Sigiriya/Sigiriya Rock Fortress", dayKey: "Sigiriya:1" }];
  const changed = replaceBases(plan, [plan.bases[0], plan.bases[1], { place: "Galle", nights: 2 }]).plan!;
  const initial = { current: plan, past: [], future: [], saved: [{ id: "2026-11-19T00:00:00Z", plan }] };
  const history = reviseStudio(initial, changed);
  assert.equal(history.current.visits, plan.visits);
  assert.deepEqual(undoStudio(history).current, plan);
  assert.deepEqual(redoStudio(undoStudio(history)).current, changed);
  let value = "";
  assert.equal(saveStudio(history, { setItem: (_, next) => { value = next; } }), true);
  assert.deepEqual(loadStudio({ getItem: () => value }), history);
  const corrupt = { ...history.current, party: -1 };
  assert.equal(validStudioPlan(corrupt), false);
  assert.deepEqual(loadStudio({ getItem: () => JSON.stringify({ current: corrupt }) }).current, newStudioPlan());
  assert.equal(saveStudio(history, { setItem() { throw new Error("storage blocked"); } }), false);
});
