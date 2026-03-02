/**
 * In-memory sliding-window rate limiter.
 * Suitable for single-instance deployments (dev, small VPS, etc.).
 * For multi-instance / serverless at scale, swap the Map for Redis/Upstash.
 */

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 5; // requests allowed per window per IP

// ip -> array of request timestamps within the current window
const store = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Unix ms timestamp when the oldest slot expires
}

export function checkRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  // Keep only timestamps inside the current window
  const timestamps = (store.get(ip) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= MAX_REQUESTS) {
    // The window resets when the oldest request falls out
    const resetAt = timestamps[0] + WINDOW_MS;
    return { allowed: false, remaining: 0, resetAt };
  }

  timestamps.push(now);
  store.set(ip, timestamps);

  // Periodically prune IPs with no recent activity to prevent unbounded growth
  if (store.size > 5_000) pruneStore(windowStart);

  const remaining = MAX_REQUESTS - timestamps.length;
  return { allowed: true, remaining, resetAt: timestamps[0] + WINDOW_MS };
}

function pruneStore(windowStart: number) {
  for (const [ip, timestamps] of store) {
    if (timestamps.every((t) => t <= windowStart)) {
      store.delete(ip);
    }
  }
}
