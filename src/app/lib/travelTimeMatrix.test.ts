import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchTravelMatrix, matrixLeg, travelMatrixKey, type MatrixLocation } from "./travelTimeMatrix.ts";

const a: MatrixLocation = { id: "A", name: "Alpha", coordinates: { latitude: 7.1, longitude: 80.1 } };
const b: MatrixLocation = { id: "B", name: "Beta", coordinates: { latitude: 7.5, longitude: 80.5 } };
const c: MatrixLocation = { id: "C", name: "Unknown" };

function response(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

test("OSRM Table requests both road duration and distance, preserving directed identity", async () => {
  let requested = "";
  const matrix = await fetchTravelMatrix([b, a], {
    fetcher: async url => {
      requested = url;
      return response({ code: "Ok", durations: [[0, 5400], [6000, 0]], distances: [[0, 120000], [130000, 0]] });
    },
    now: () => "2026-10-09T00:00:00Z",
  });
  assert.match(requested, /\/table\/v1\/driving\/80\.1,7\.1;80\.5,7\.5\?annotations=duration,distance$/);
  assert.equal(requested.includes("fallback_speed"), false);
  assert.equal(matrix.generatedAt, "2026-10-09T00:00:00Z");
  assert.deepEqual(matrix.locations.map(location => location.id), ["A", "B"]);
  assert.deepEqual(matrixLeg(matrix, "A", "B"), {
    fromId: "A", toId: "B", status: "ROUTED", source: "OSRM_TABLE", durationMinutes: 90, distanceKm: 120,
  });
  assert.equal(matrixLeg(matrix, "B", "A")?.durationMinutes, 100);
});

test("null table cells are unroutable; partial data never becomes a complete road leg", async () => {
  const matrix = await fetchTravelMatrix([a, b], {
    fetcher: async () => response({ code: "Ok", durations: [[0, null], [3600, 0]], distances: [[0, null], [null, 0]] }),
  });
  assert.equal(matrixLeg(matrix, "A", "B")?.status, "UNROUTABLE");
  assert.equal(matrixLeg(matrix, "A", "B")?.distanceKm, undefined);
  assert.equal(matrixLeg(matrix, "B", "A")?.status, "PARTIAL");
  assert.equal(matrixLeg(matrix, "B", "A")?.durationMinutes, 60);
  assert.equal(matrixLeg(matrix, "B", "A")?.distanceKm, undefined);
});

test("OSRM NoTable reports unroutable valid pairs", async () => {
  const matrix = await fetchTravelMatrix([a, b], { fetcher: async () => response({ code: "NoTable" }) });
  assert.equal(matrix.source, "OSRM_TABLE");
  assert.equal(matrixLeg(matrix, "A", "B")?.status, "UNROUTABLE");
  assert.equal(matrixLeg(matrix, "A", "A")?.durationMinutes, 0);
});

test("missing coordinates are explicit and do not enter the OSRM request", async () => {
  let calls = 0;
  const matrix = await fetchTravelMatrix([a, b, c], {
    fetcher: async url => {
      calls += 1;
      assert.equal(url.includes("Unknown"), false);
      return response({ code: "Ok", durations: [[0, 3600], [3600, 0]], distances: [[0, 60000], [60000, 0]] });
    },
  });
  assert.equal(calls, 1);
  assert.equal(matrixLeg(matrix, "A", "C")?.status, "MISSING_COORDINATES");
  assert.equal(matrixLeg(matrix, "C", "A")?.durationMinutes, undefined);
});

test("service errors, malformed replies, and timeouts remain unavailable", async () => {
  const http = await fetchTravelMatrix([a, b], { fetcher: async () => response({}, false) });
  const malformed = await fetchTravelMatrix([a, b], { fetcher: async () => response({ code: "Ok", durations: [[0, 1]] }) });
  const network = await fetchTravelMatrix([a, b], { fetcher: async () => { throw new Error("offline"); } });
  const timeout = await fetchTravelMatrix([a, b], { timeoutMs: 1, fetcher: async (_url, init) => new Promise((_resolve, reject) => {
    init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
  }) });
  assert.equal(http.failure, "HTTP_ERROR");
  assert.equal(malformed.failure, "INVALID_RESPONSE");
  assert.equal(network.failure, "NETWORK_ERROR");
  assert.equal(timeout.failure, "TIMEOUT");
  for (const matrix of [http, malformed, network, timeout]) {
    assert.equal(matrixLeg(matrix, "A", "B")?.status, "UNAVAILABLE");
  }
});

test("stable order-independent keys support an injected in-memory cache", async () => {
  assert.equal(travelMatrixKey([a, b]), travelMatrixKey([b, a]));
  assert.notEqual(travelMatrixKey([a, b]), travelMatrixKey([a, b], "https://different-osrm.example"));
  const cache = new Map();
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return response({ code: "Ok", durations: [[0, 60], [60, 0]], distances: [[0, 1000], [1000, 0]] });
  };
  await fetchTravelMatrix([a, b], { fetcher, cache });
  await fetchTravelMatrix([b, a], { fetcher, cache });
  assert.equal(calls, 1);
});

test("failures are not cached and duplicate identity is rejected", async () => {
  const cache = new Map();
  let calls = 0;
  const fetcher = async () => { calls += 1; return response({}, false); };
  await fetchTravelMatrix([a, b], { fetcher, cache });
  await fetchTravelMatrix([a, b], { fetcher, cache });
  assert.equal(calls, 2);
  await assert.rejects(fetchTravelMatrix([a, a], { fetcher }), /unique/);
});

test("nonsensical numeric cells make a reply invalid, not unroutable", async () => {
  const matrix = await fetchTravelMatrix([a, b], {
    fetcher: async () => response({ code: "Ok", durations: [[0, -10], [60, 0]], distances: [[0, 1000], [1000, 0]] }),
  });
  assert.equal(matrix.failure, "INVALID_RESPONSE");
  assert.equal(matrixLeg(matrix, "A", "B")?.status, "UNAVAILABLE");
});
