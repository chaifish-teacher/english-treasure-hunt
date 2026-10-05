import { GAS_API_URL } from "../config.js";
export async function postToScoreSystem(
  payload,
  fetchImpl = fetch,
  timeoutMs = 20000,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(GAS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Score system unavailable");
    const data = await response.json();
    if (data.success !== true) throw new Error("Score system rejected request");
    if (
      payload.action === "start" &&
      (typeof data.gameId !== "string" || !data.gameId.trim())
    )
      throw new Error("Missing game ID");
    return data;
  } finally {
    clearTimeout(timeout);
  }
}
export function createRequestId(cryptoImpl = globalThis.crypto) {
  if (typeof cryptoImpl.randomUUID === "function")
    return cryptoImpl.randomUUID();
  const bytes = cryptoImpl.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createStartAttempt(
  identity,
  previous = null,
  makeId = createRequestId,
) {
  // A failed response may hide a successful Sheet write. Manual Retry must
  // reuse the same requestId so GAS returns that row's existing gameId.
  if (
    previous &&
    previous.seatNo === identity.seatNo &&
    previous.name === identity.name
  )
    return previous;
  return Object.freeze({ action: "start", ...identity, requestId: makeId() });
}

export async function startGame(
  payload,
  fetchImpl = fetch,
  {
    timeoutMs = 15000,
    wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = {},
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await postToScoreSystem(payload, fetchImpl, timeoutMs);
    } catch (error) {
      if (attempt === 2) throw error;
      // Keep the payload (especially requestId) identical across all attempts.
      await wait((attempt + 1) * 1000);
    }
  }
}

// One request at a time, and no automatic duplicate after a confirmed save.
// Explicit retry after a failure uses the immutable original payload and gameId.
export function createCompletionSaver(post = postToScoreSystem) {
  const pending = new Map();
  const saved = new Map();
  return (payload) => {
    if (saved.has(payload.gameId))
      return Promise.resolve(saved.get(payload.gameId));
    if (pending.has(payload.gameId)) return pending.get(payload.gameId);
    const request = Promise.resolve()
      .then(() => post(payload))
      .then((data) => {
        saved.set(payload.gameId, data);
        return data;
      })
      .finally(() => pending.delete(payload.gameId));
    pending.set(payload.gameId, request);
    return request;
  };
}
