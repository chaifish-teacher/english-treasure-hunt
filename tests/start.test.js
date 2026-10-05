import test from "node:test";
import assert from "node:assert/strict";
import {
  createRequestId,
  createStartAttempt,
  startGame,
} from "../src/lib/api.js";
import { GAS_API_URL } from "../src/config.js";

const identity = { seatNo: "12", name: "測試學生" };
const successful = () => ({
  ok: true,
  json: async () => ({ success: true, gameId: "returned-game-id" }),
});
const noWait = async () => {};

test("one logical Start generates one requestId; manual retry retains the same frozen payload", () => {
  let generated = 0;
  const makeId = () => `request-${++generated}`;
  const attempt = createStartAttempt(identity, null, makeId);
  assert.deepEqual(attempt, {
    action: "start",
    ...identity,
    requestId: "request-1",
  });
  assert.ok(Object.isFrozen(attempt));
  assert.equal(createStartAttempt(identity, attempt, makeId), attempt);
  assert.equal(generated, 1);
});

test("changed seat/name, reset identity or Play Again produces a new requestId", () => {
  let generated = 0;
  const makeId = () => `request-${++generated}`;
  const attempt = createStartAttempt(identity, null, makeId);
  for (const changed of [
    { ...identity, seatNo: "13" },
    { ...identity, name: "另一位學生" },
  ]) {
    assert.notEqual(
      createStartAttempt(changed, attempt, makeId).requestId,
      attempt.requestId,
    );
  }
  // Clearing the pending attempt on success/reset makes an unchanged identity a new game.
  assert.notEqual(
    createStartAttempt(identity, null, makeId).requestId,
    attempt.requestId,
  );
});

test("request IDs use randomUUID, or a cryptographically random UUIDv4 fallback", () => {
  assert.equal(
    createRequestId({ randomUUID: () => "native-uuid" }),
    "native-uuid",
  );
  const fallback = createRequestId({
    getRandomValues: (bytes) => {
      bytes.fill(255);
      return bytes;
    },
  });
  assert.equal(fallback, "ffffffff-ffff-4fff-bfff-ffffffffffff");
  const ids = Array.from({ length: 100 }, () => createRequestId());
  assert.equal(new Set(ids).size, 100);
});

test("first success includes requestId and preserves GAS's POST/text/plain/redirect format; stops immediately", async () => {
  const payload = createStartAttempt(identity);
  let attempts = 0;
  const data = await startGame(
    payload,
    async (url, options) => {
      attempts++;
      assert.equal(url, GAS_API_URL);
      assert.equal(options.method, "POST");
      assert.deepEqual(options.headers, {
        "Content-Type": "text/plain;charset=utf-8",
      });
      assert.equal(options.redirect, "follow");
      assert.deepEqual(JSON.parse(options.body), payload);
      return successful();
    },
    {
      wait: () => {
        throw new Error("Must not wait after success");
      },
    },
  );
  assert.equal(data.gameId, "returned-game-id");
  assert.equal(attempts, 1);
});

test("network failure followed by success returns the gameId using an identical payload", async () => {
  const payload = createStartAttempt(identity);
  const requests = [],
    delays = [];
  const data = await startGame(
    payload,
    async (_url, options) => {
      requests.push(options.body);
      if (requests.length === 1)
        throw new TypeError("Lost response after Sheet write");
      return successful();
    },
    {
      wait: async (ms) => {
        delays.push(ms);
      },
    },
  );
  assert.equal(data.gameId, "returned-game-id");
  assert.deepEqual(requests, [
    JSON.stringify(payload),
    JSON.stringify(payload),
  ]);
  assert.deepEqual(delays, [1000]);
});

test("timeout aborts attempt one; attempt two has a fresh signal, same requestId, and succeeds", async () => {
  const payload = createStartAttempt(identity);
  const signals = [],
    requests = [];
  const data = await startGame(
    payload,
    async (_url, options) => {
      signals.push(options.signal);
      requests.push(JSON.parse(options.body));
      if (signals.length === 1)
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener(
            "abort",
            () => reject(new Error("Timed out")),
            { once: true },
          );
        });
      return successful();
    },
    { timeoutMs: 5, wait: noWait },
  );
  assert.equal(data.gameId, "returned-game-id");
  assert.equal(signals[0].aborted, true);
  assert.notEqual(signals[0], signals[1]);
  assert.equal(signals[1].aborted, false);
  assert.deepEqual(requests[0], requests[1]);
});

test("three failed attempts only, increasing delays; a later manual retry recovers the existing game", async () => {
  const payload = createStartAttempt(identity);
  const requests = [],
    delays = [];
  const unavailable = async (_url, options) => {
    requests.push(JSON.parse(options.body));
    throw new Error("Lost response");
  };
  await assert.rejects(
    startGame(payload, unavailable, {
      wait: async (ms) => {
        delays.push(ms);
      },
    }),
    /Lost response/,
  );
  assert.equal(requests.length, 3);
  assert.deepEqual(delays, [1000, 2000]);
  assert.ok(requests.every((p) => p.requestId === payload.requestId));
  const retry = createStartAttempt(identity, payload);
  const data = await startGame(
    retry,
    async (_url, options) => {
      assert.deepEqual(JSON.parse(options.body), requests[0]);
      return successful();
    },
    { wait: noWait },
  );
  assert.equal(data.gameId, "returned-game-id");
});

test("invalid responses are retried, never accepted without success true and a nonempty string gameId", async () => {
  const invalid = [
    () => ({ ok: false }),
    () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError("HTML response");
      },
    }),
    ...[
      null,
      { success: false, gameId: "id" },
      { success: "true", gameId: "id" },
      { success: true },
      { success: true, gameId: "" },
      { success: true, gameId: "  " },
      { success: true, gameId: 12 },
    ].map((data) => () => ({ ok: true, json: async () => data })),
  ];
  for (const response of invalid) {
    let attempts = 0;
    await assert.rejects(
      startGame(
        createStartAttempt(identity),
        async () => {
          attempts++;
          return response();
        },
        { wait: noWait },
      ),
    );
    assert.equal(attempts, 3);
  }
});
