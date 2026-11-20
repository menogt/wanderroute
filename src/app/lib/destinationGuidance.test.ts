import test from "node:test";
import assert from "node:assert/strict";
import { compareStopOrders, destinationHint } from "./destinationGuidance.ts";
import type { TravelMatrix } from "./travelTimeMatrix.ts";

const locations = ["CMB", "Kandy", "Ella", "Galle"].map(id => ({ id, name: id }));
function roads(): TravelMatrix {
  const order = ["CMB>Kandy", "Kandy>Ella", "Ella>Galle", "Galle>CMB"];
  return { locations, generatedAt: "", source: "OSRM_TABLE", legs: locations.map(from => locations.map(to => ({
    fromId: from.id, toId: to.id, status: "ROUTED", durationMinutes: order.includes(from.id + ">" + to.id) ? 40 : 120,
  }))) };
}

test("selection hints reflect geography and duration without requiring a loop", () => {
  assert.match(destinationHint(["Sigiriya", "Dambulla"])!.text, /one hotel/);
  assert.match(destinationHint(["Galle", "Mirissa"])!.text, /coast-only/);
  assert.match(destinationHint(["Trincomalee", "Galle"], 6)!.text, /6 days/);
  assert.equal(destinationHint(["Trincomalee", "Galle"], 15), undefined);
  assert.equal(destinationHint(["Ella"]), undefined);
});

test("compares the whole directed route and preserves the chosen set and its input order", () => {
  const stops = ["Ella", "Kandy", "Galle"];
  const result = compareStopOrders(stops, "CMB", "CMB", roads())!;
  assert.equal(result.original, 400);
  assert.equal(result.finalDrive, 40);
  assert.deepEqual(result.alternative, { order: ["Kandy", "Ella", "Galle"], minutes: 160 });
  assert.deepEqual(stops, ["Ella", "Kandy", "Galle"]);
  const open = compareStopOrders(["Kandy", "Ella"], "CMB", "Galle", roads())!;
  assert.equal(open.original, 120);
  assert.equal(open.alternative, undefined);
});

test("an unknown final leg prevents a claim about total driving", () => {
  const matrix = roads();
  delete matrix.legs[3][0].durationMinutes;
  assert.equal(compareStopOrders(["Ella", "Galle"], "CMB", "CMB", matrix), undefined);
});
