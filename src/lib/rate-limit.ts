/**
 * Rate limiting with optional Upstash Redis for multi-instance deployments.
 *
 * When `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are set, limits are
 * enforced via `@upstash/ratelimit` (sliding window). Otherwise — and on Redis
 * errors — falls back to the original in-memory bucket so local/CI behavior is
 * unchanged.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const upstashLimiters = new Map<string, Ratelimit>();

/** Test helper — clears in-memory buckets between cases. */
export function resetRateLimitMemory() {
  buckets.clear();
}

export function hasUpstashRedis(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}

/** Convert a millisecond window to an Upstash duration string. */
export function windowMsToDuration(
  windowMs: number,
): `${number} ${"ms" | "s" | "m" | "h" | "d"}` {
  if (windowMs <= 0) return "1 s";
  if (windowMs % 86_400_000 === 0) {
    return `${windowMs / 86_400_000} d`;
  }
  if (windowMs % 3_600_000 === 0) {
    return `${windowMs / 3_600_000} h`;
  }
  if (windowMs % 60_000 === 0) {
    return `${windowMs / 60_000} m`;
  }
  if (windowMs % 1_000 === 0) {
    return `${windowMs / 1_000} s`;
  }
  return `${windowMs} ms`;
}

/**
 * In-memory limiter (per server instance). Exported for unit tests and as the
 * offline fallback path.
 */
export function rateLimitMemory(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (existing.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  existing.count += 1;
  return { ok: true };
}

function getUpstashLimiter(limit: number, windowMs: number): Ratelimit {
  const cacheKey = `${limit}:${windowMs}`;
  let limiter = upstashLimiters.get(cacheKey);
  if (limiter) return limiter;

  limiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(limit, windowMsToDuration(windowMs)),
    prefix: "vpsych:ratelimit",
    analytics: false,
    ephemeralCache: new Map(),
  });
  upstashLimiters.set(cacheKey, limiter);
  return limiter;
}

async function rateLimitUpstash(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const limiter = getUpstashLimiter(limit, windowMs);
  const result = await limiter.limit(key);
  if (result.success) return { ok: true };
  return {
    ok: false,
    retryAfterSec: Math.max(
      1,
      Math.ceil((result.reset - Date.now()) / 1000),
    ),
  };
}

/**
 * Distributed-aware rate limit. Same result shape as the original sync helper.
 * Call sites should `await` — Redis path is async; memory path resolves immediately.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  if (!hasUpstashRedis()) {
    return rateLimitMemory(key, limit, windowMs);
  }

  try {
    return await rateLimitUpstash(key, limit, windowMs);
  } catch (err) {
    console.warn(
      "[rate-limit] Upstash unavailable; falling back to memory:",
      err instanceof Error ? err.message : String(err),
    );
    return rateLimitMemory(key, limit, windowMs);
  }
}
