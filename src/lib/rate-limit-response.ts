import { NextResponse } from "next/server";
import type { RateLimitResult } from "@/lib/rate-limit";
import { ConcurrencyBusyError } from "@/lib/concurrency";

/** Standard 429 body used across VPsych API routes. */
export function tooManyRequests(limited: Extract<RateLimitResult, { ok: false }>) {
  return NextResponse.json(
    { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
    {
      status: 429,
      headers: { "Retry-After": String(limited.retryAfterSec) },
    },
  );
}

/** 503 when a per-instance concurrency gate is saturated. */
export function serverBusy(err: ConcurrencyBusyError) {
  return NextResponse.json(
    {
      error: "Server busy",
      code: err.code,
      retryAfterSec: err.retryAfterSec,
    },
    {
      status: 503,
      headers: { "Retry-After": String(err.retryAfterSec) },
    },
  );
}

export function isConcurrencyBusy(err: unknown): err is ConcurrencyBusyError {
  return err instanceof ConcurrencyBusyError;
}
