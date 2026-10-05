import test from "node:test";
import assert from "node:assert/strict";
import { postToScoreSystem, createCompletionSaver } from "../src/lib/api.js";
import { GAS_API_URL } from "../src/config.js";

test("API uses exact endpoint, text/plain JSON, POST and followed redirects", async () => {
  const payload = { action: "start", seatNo: "任何非空字串", name: "測試學生" };
  let calls = 0;
  const response = await postToScoreSystem(payload, async (url, options) => {
    calls++;
    assert.equal(url, GAS_API_URL);
    assert.match(url, /^https:\/\/script\.google\.com\/macros\/s\//);
    assert.equal(options.method, "POST");
    assert.deepEqual(options.headers, {
      "Content-Type": "text/plain;charset=utf-8",
    });
    assert.deepEqual(JSON.parse(options.body), payload);
    assert.equal(options.redirect, "follow");
    assert.ok(options.signal instanceof AbortSignal);
    return {
      ok: true,
      json: async () => ({ success: true, gameId: "live-format-id" }),
    };
  });
  assert.equal(calls, 1);
  assert.equal(response.gameId, "live-format-id");
});
test("network errors, rejected response, HTML/non-JSON and invalid game IDs do not start a game", async () => {
  const failures = [
    async () => {
      throw new Error("Network error");
    },
    async () => ({ ok: false }),
    async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError("HTML response");
      },
    }),
    ...[
      { success: false },
      { success: true },
      { success: true, gameId: "" },
      { success: true, gameId: "  " },
      { success: true, gameId: 123 },
    ].map((data) => async () => ({ ok: true, json: async () => data })),
  ];
  for (const fetchImpl of failures)
    await assert.rejects(postToScoreSystem({ action: "start" }, fetchImpl));
});
test("slow requests are aborted so students can retry", async () => {
  const fetchImpl = (_url, { signal }) =>
    new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("Aborted")), {
        once: true,
      });
    });
  await assert.rejects(
    postToScoreSystem({ action: "start" }, fetchImpl, 5),
    /Aborted/,
  );
});
test("completion request does not require a second gameId in the response", async () => {
  const response = await postToScoreSystem(
    { action: "complete", gameId: "same-id" },
    async () => ({ ok: true, json: async () => ({ success: true }) }),
  );
  assert.equal(response.success, true);
});
test("double tap and repeated effect-like calls share one request; successful save is cached", async () => {
  let count = 0;
  let resolve;
  const saver = createCompletionSaver(() => {
    count++;
    return new Promise((r) => {
      resolve = r;
    });
  });
  const payload = {
    action: "complete",
    gameId: "same-id",
    initialScore: "30/30",
  };
  const first = saver(payload);
  const second = saver(payload);
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(count, 1);
  resolve({ success: true });
  await Promise.all([first, second]);
  await saver(payload);
  assert.equal(count, 1);
});
test("failed completion can retry the same record; a new game can save separately", async () => {
  const requests = [];
  const saver = createCompletionSaver(async (payload) => {
    requests.push(payload);
    if (requests.length === 1) throw new Error("Unavailable");
    return { success: true };
  });
  const payload = Object.freeze({
    action: "complete",
    gameId: "same-id",
    finalMasteryScore: "28/30",
  });
  await assert.rejects(saver(payload));
  await saver(payload);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0], requests[1]);
  await saver({ ...payload, gameId: "new-id" });
  assert.equal(requests.length, 3);
});
