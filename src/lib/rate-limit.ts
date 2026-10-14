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
 * offline fallback path. `cost` is how much of the budget this request uses
 * (1 per request by default; e.g. characters for a character budget).
 */
export function rateLimitMemory(
  key: string,
  limit: number,
  windowMs: number,
  cost = 1,
): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  if (bucket.count + cost > limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  bucket.count += cost;
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
  cost: number,
): Promise<RateLimitResult> {
  const limiter = getUpstashLimiter(limit, windowMs);
  const result = await limiter.limit(key, cost === 1 ? undefined : { rate: cost });
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
let warnedMissingUpstash = false;

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  /** Budget this request uses; 1 per request unless the budget is in other units. */
  cost = 1,
): Promise<RateLimitResult> {
  if (!hasUpstashRedis()) {
    if (
      process.env.NODE_ENV === "production" &&
      !warnedMissingUpstash &&
      process.env.VERCEL_ENV === "production"
    ) {
      warnedMissingUpstash = true;
      console.warn(
        "[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN unset in production; using per-instance memory limits (not horizontally safe)",
      );
    }
    return rateLimitMemory(key, limit, windowMs, cost);
  }

  try {
    return await rateLimitUpstash(key, limit, windowMs, cost);
  } catch (err) {
    // Limits keep working, but per server instance only (weaker): an error,
    // not a warning, so it is noticed.
    console.error("[rate-limit] Upstash unavailable; falling back to memory", {
      bucket: key.split(":")[0],
      error: err instanceof Error ? err.message : String(err),
    });
    return rateLimitMemory(key, limit, windowMs, cost);
  }
}
