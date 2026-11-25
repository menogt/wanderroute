import assert from "node:assert/strict";
import { test } from "node:test";
import { convertAmount, FALLBACK_RATES, formatConverted, parseRates } from "./currencyRates.ts";

const table = { rates: { USD: 1, LKR: 330, EUR: 0.9, GBP: 0.75 }, updated: "2026-11-25", live: true };

test("converts through the dollar in both directions", () => {
  assert.equal(convertAmount(100, "USD", "LKR", table), 33000);
  assert.equal(convertAmount(33000, "LKR", "USD", table), 100);
  assert.equal(Math.round(convertAmount(90, "EUR", "GBP", table)! * 100) / 100, 75);
  assert.equal(convertAmount(50, "EUR", "EUR", table), 50);
});

test("missing rates and unusable amounts give no result rather than zero", () => {
  assert.equal(convertAmount(100, "USD", "AUD", table), undefined);
  assert.equal(convertAmount(Number.NaN, "USD", "LKR", table), undefined);
  assert.equal(convertAmount(-5, "USD", "LKR", table), undefined);
  assert.equal(convertAmount(100, "EUR", "LKR", FALLBACK_RATES), undefined);
  assert.equal(convertAmount(100, "USD", "LKR", FALLBACK_RATES), 33600);
});

test("a rates reply keeps only offered currencies with valid rates", () => {
  const parsed = parseRates({ result: "success", time_last_update_unix: 1795564951,
    rates: { USD: 1, LKR: 332.4, EUR: 0.91, XYZ: 5, GBP: "bad", AUD: -1 } });
  assert.deepEqual(parsed?.rates, { LKR: 332.4, USD: 1, EUR: 0.91 });
  assert.equal(parsed?.live, true);
  assert.match(parsed!.updated, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(parseRates({ result: "error" }), undefined);
  assert.equal(parseRates({ result: "success", rates: { USD: 1 } }), undefined);
  assert.equal(parseRates(null), undefined);
});

test("formats rupees whole and small amounts with cents", () => {
  assert.equal(formatConverted(664848.6, "LKR"), "664,849");
  assert.equal(formatConverted(12.5, "USD"), "12.50");
  assert.equal(formatConverted(1824.9, "EUR"), "1,825");
});
