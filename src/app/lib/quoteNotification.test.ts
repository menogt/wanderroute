import assert from "node:assert/strict";
import { test } from "node:test";
import { handler } from "../../../netlify/functions/quote-request.js";

const requestId = "ec976a74-c47b-45a0-948c-b86b38677b13";
const quote = {
  id: requestId,
  full_name: "Stored Traveller",
  email: "stored@example.test",
  whatsapp: "+10000000000",
  start_date: "2027-01-01",
  travellers: 2,
  note: "Private note",
  route_name: "Island route",
  cities: ["Kandy"],
  total_days: 2,
  travel_style: "comfort",
  estimated_total: 500,
  currency: "USD",
};

async function withMockServices(
  databaseRows: object[],
  emailStatus = 200,
  useNewSecret = false,
) {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const originalInfo = console.info;
  const keys = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY", "QUOTE_ALERT_TO"];
  const originalEnv = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const calls: string[] = [];
  const logs: string[] = [];
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  if (useNewSecret) process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
  else delete process.env.SUPABASE_SECRET_KEY;
  process.env.RESEND_API_KEY = "test-email-key";
  process.env.QUOTE_ALERT_TO = "operator@example.test";
  console.warn = (...args: unknown[]) => { logs.push(JSON.stringify(args)); };
  console.info = (...args: unknown[]) => { logs.push(JSON.stringify(args)); };
  globalThis.fetch = async (url, options) => {
    if (String(url).includes("/rest/v1/quote_requests")) {
      calls.push("lookup");
      assert.equal(new URL(String(url)).searchParams.get("id"), `eq.${requestId}`);
      const headers = options?.headers as Record<string, string>;
      assert.equal(headers.apikey, useNewSecret ? "sb_secret_test" : "test-service-key");
      assert.equal("Authorization" in headers, !useNewSecret);
      return new Response(JSON.stringify(databaseRows), { status: 200 });
    }
    assert.equal(String(url), "https://api.resend.com/emails");
    calls.push("email");
    const body = JSON.parse(String(options?.body));
    assert.ok(body.text.includes(quote.email));
    assert.ok(body.text.includes(requestId));
    return new Response("{}", { status: emailStatus });
  };
  try {
    const response = await handler({ httpMethod: "POST", body: JSON.stringify({
      requestId, fullName: "Unstored Name", email: "unstored@example.test",
    }) });
    return { response, payload: JSON.parse(response.body), calls, logs };
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
    console.info = originalInfo;
    for (const key of keys) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  }
}

test("notification reads the durable row before emailing and logs no contact details", async () => {
  const { response, payload, calls, logs } = await withMockServices([quote]);
  assert.equal(response.statusCode, 200);
  assert.equal(payload.emailed, true);
  assert.deepEqual(calls, ["lookup", "email"]);
  const text = logs.join(" ");
  for (const sensitive of [quote.full_name, quote.email, quote.whatsapp, quote.note]) {
    assert.equal(text.includes(sensitive), false);
  }
});

test("a receipt absent from Supabase cannot trigger operator email", async () => {
  const { response, payload, calls } = await withMockServices([]);
  assert.equal(response.statusCode, 404);
  assert.equal(payload.emailed, false);
  assert.deepEqual(calls, ["lookup"]);
});

test("a new server secret key is used only as an API key", async () => {
  const { payload, calls } = await withMockServices([quote], 200, true);
  assert.equal(payload.emailed, true);
  assert.deepEqual(calls, ["lookup", "email"]);
});

test("email failure leaves the stored request intact", async () => {
  const { response, payload, calls } = await withMockServices([quote], 500);
  assert.equal(response.statusCode, 200);
  assert.equal(payload.emailed, false);
  assert.deepEqual(calls, ["lookup", "email"]);
});

test("invalid receipt cannot reach Supabase or email", async () => {
  const response = await handler({ httpMethod: "POST", body: '{"requestId":"not-a-uuid"}' });
  assert.equal(response.statusCode, 400);
});
