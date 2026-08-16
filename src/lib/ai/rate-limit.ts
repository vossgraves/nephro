/**
 * In-memory sliding-window rate limiter (per key).
 *
 * IMPORTANT: windows are per-process. On a horizontally scaled deployment
 * every serverless instance keeps its own counters, so effective limits can
 * exceed the nominal value under multi-instance load. This is an accepted
 * trade-off for this project (see research/production-upgrade-plan.md §37);
 * a shared store (Redis/Upstash) would be required for strict global limits.
 */

const windows = new Map<string, number[]>();

/** Cap on tracked keys; when exceeded, stale keys are pruned to bound memory. */
const MAX_TRACKED_KEYS = 10_000;

/**
 * Returns true when the request is allowed, false when it is over the limit.
 * A rejected request is not recorded, so the window slides normally for the
 * next attempt. Fails closed on non-positive limit/window configuration.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  if (!(limit > 0) || !(windowMs > 0)) return false;

  const now = Date.now();
  if (windows.size > MAX_TRACKED_KEYS) {
    for (const [candidate, timestamps] of windows) {
      const last = timestamps[timestamps.length - 1];
      if (last === undefined || last <= now - windowMs) {
        windows.delete(candidate);
      }
    }
  }

  let timestamps = windows.get(key);
  if (!timestamps) {
    timestamps = [];
    windows.set(key, timestamps);
  }

  const cutoff = now - windowMs;
  while (timestamps.length > 0 && timestamps[0] <= cutoff) {
    timestamps.shift();
  }

  if (timestamps.length >= limit) return false;
  timestamps.push(now);
  return true;
}