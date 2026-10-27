import assert from "node:assert/strict";
import { test } from "node:test";
import { createGenerationGate } from "./generationRequest.ts";

test("generation rejects duplicate starts synchronously and accepts a retry after completion", () => {
  const gate = createGenerationGate();
  const first = gate.begin()!;
  assert.equal(gate.begin(), undefined);
  assert.equal(gate.isActive(), true);
  first.finish();
  assert.equal(first.isCurrent(), false);
  assert.ok(gate.begin());
});

test("navigation cancels generation and a late completion cannot release the replacement", () => {
  const gate = createGenerationGate();
  const old = gate.begin()!;
  gate.cancel();
  assert.equal(old.signal.aborted, true);
  assert.equal(old.isCurrent(), false);
  const next = gate.begin()!;
  old.finish();
  assert.equal(next.isCurrent(), true);
  assert.equal(gate.begin(), undefined);
  gate.cancel();
  gate.cancel();
  assert.equal(next.signal.aborted, true);
});
