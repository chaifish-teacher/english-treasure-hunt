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
