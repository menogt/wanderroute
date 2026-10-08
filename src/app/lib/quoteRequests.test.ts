import assert from "node:assert/strict";
import { test } from "node:test";
import type { GeneratedItinerary } from "../components/rl/types";
import {
  hasRequested,
  markRequested,
  submitQuoteRequestWithDependencies,
  wasQuoteReceived,
  type QuoteSubmissionDependencies,
} from "./quoteRequests.ts";

const requestId = "ec976a74-c47b-45a0-948c-b86b38677b13";
const input = { fullName: "Test Traveller", email: "traveller@example.test", note: "Private note" };
const itinerary = {
  id: "trip-1", routeName: "Island route", cities: ["Kandy"], totalDays: 2,
  totalPeople: 2, travelStyle: "comfort", estimatedTotalCost: 500, currency: "USD",
} as GeneratedItinerary;

function deps(overrides: Partial<QuoteSubmissionDependencies> = {}): QuoteSubmissionDependencies {
  return {
    insert: async () => ({ error: null }),
    notify: async () => true,
    backup: () => true,
    deviceId: () => "device-1",
    ...overrides,
  };
}

test("stored request is notified afterward and returns its durable receipt", async () => {
  const calls: string[] = [];
  const result = await submitQuoteRequestWithDependencies(input, itinerary, requestId, deps({
    insert: async (row) => {
      calls.push("insert");
      assert.equal(row.id, requestId);
      return { error: null };
    },
    notify: async (id) => { calls.push("notify"); assert.equal(id, requestId); return true; },
  }));
  assert.deepEqual(calls, ["insert", "notify"]);
  assert.deepEqual(result, { status: "RECEIVED", requestId });
  assert.equal(wasQuoteReceived(result), true);
});

test("email failure does not erase a stored receipt", async () => {
  const result = await submitQuoteRequestWithDependencies(input, itinerary, requestId, deps({
    notify: async () => false,
  }));
  assert.deepEqual(result, { status: "RECEIVED_NOTIFICATION_FAILED", requestId });
  assert.equal(wasQuoteReceived(result), true);
});

test("storage failure with a browser backup is not received and never notifies", async () => {
  let notified = false;
  const result = await submitQuoteRequestWithDependencies(input, itinerary, requestId, deps({
    insert: async () => ({ error: { code: "42501", message: "Denied" } }),
    notify: async () => { notified = true; return true; },
    backup: () => true,
  }));
  assert.deepEqual(result, { status: "LOCAL_BACKUP_ONLY" });
  assert.equal(wasQuoteReceived(result), false);
  assert.equal(notified, false);
});

test("storage and browser backup failure remain not received", async () => {
  let notified = false;
  const result = await submitQuoteRequestWithDependencies(input, itinerary, requestId, deps({
    insert: async () => { throw new Error("network failed"); },
    notify: async () => { notified = true; return true; },
    backup: () => false,
  }));
  assert.deepEqual(result, { status: "NOT_RECEIVED" });
  assert.equal(wasQuoteReceived(result), false);
  assert.equal(notified, false);
});

test("retry with the same primary-key receipt does not insert a second row", async () => {
  let insertAttempts = 0;
  const result = await submitQuoteRequestWithDependencies(input, itinerary, requestId, deps({
    insert: async () => {
      insertAttempts += 1;
      return { error: { code: "23505", message: "duplicate key violates quote_requests_pkey" } };
    },
  }));
  assert.equal(insertAttempts, 1);
  assert.deepEqual(result, { status: "RECEIVED", requestId });
});

test("browser storage failure does not block a successful remote insert", async () => {
  const result = await submitQuoteRequestWithDependencies(input, itinerary, requestId, deps({
    deviceId: () => { throw new Error("localStorage unavailable"); },
    insert: async (row) => { assert.equal(row.device_id, null); return { error: null }; },
  }));
  assert.equal(wasQuoteReceived(result), true);
});

test("logs never include traveller contact details", async () => {
  const original = console.warn;
  const logs: string[] = [];
  console.warn = (...args: unknown[]) => { logs.push(JSON.stringify(args)); };
  try {
    await submitQuoteRequestWithDependencies(input, itinerary, requestId, deps({
      insert: async () => ({ error: { code: "42501", message: input.email } }),
    }));
    assert.ok(logs.length > 0);
    assert.equal(logs.join(" ").includes(input.email), false);
    assert.equal(logs.join(" ").includes(input.fullName), false);
    assert.equal(logs.join(" ").includes(input.note), false);
  } finally {
    console.warn = original;
  }
});

test("old trip-only markers cannot show a false success", () => {
  const original = globalThis.localStorage;
  const values = new Map<string, string>([["wanderroute_quote_requested_trips", '["trip-1"]']]);
  globalThis.localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  } as Storage;
  try {
    assert.equal(hasRequested("trip-1"), false);
    markRequested("trip-1", requestId);
    assert.equal(hasRequested("trip-1"), true);
  } finally {
    globalThis.localStorage = original;
  }
});
