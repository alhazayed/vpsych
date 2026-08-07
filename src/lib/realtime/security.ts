/**
 * Realtime security helpers — tokens, replay protection, media assumptions.
 * Complements route-level auth + rate limits; never replaces them.
 */

import { createHash, randomBytes } from "node:crypto";
import type { RealtimeSecurityContext } from "@/lib/realtime/types";

export function createSecurityContext(opts?: {
  tokenTtlSec?: number;
  now?: number;
}): RealtimeSecurityContext {
  const now = opts?.now ?? Date.now();
  const ttl = (opts?.tokenTtlSec ?? 300) * 1000;
  const nonce = randomBytes(16).toString("hex");
  return {
    mediaEncrypted: true, // TLS in transit on Vercel / HTTPS
    streamingSecure: true,
    permissionValidated: false,
    tokenExpiresAt: new Date(now + ttl).toISOString(),
    rateLimited: false,
    replayProtected: true,
    nonce,
  };
}

export function markPermissionValidated(
  ctx: RealtimeSecurityContext,
): RealtimeSecurityContext {
  return { ...ctx, permissionValidated: true };
}

export function rotateStreamToken(
  ctx: RealtimeSecurityContext,
  ttlSec = 300,
  now = Date.now(),
): RealtimeSecurityContext {
  return {
    ...ctx,
    nonce: randomBytes(16).toString("hex"),
    tokenExpiresAt: new Date(now + ttlSec * 1000).toISOString(),
    replayProtected: true,
  };
}

export function isTokenExpired(
  ctx: RealtimeSecurityContext,
  now = Date.now(),
): boolean {
  if (!ctx.tokenExpiresAt) return true;
  return new Date(ctx.tokenExpiresAt).getTime() <= now;
}

/** HMAC-like replay id from session + nonce + sequence (no secrets in client). */
export function buildReplayId(
  sessionId: string,
  nonce: string,
  sequence: number,
): string {
  return createHash("sha256")
    .update(`${sessionId}\n${nonce}\n${sequence}`)
    .digest("hex")
    .slice(0, 32);
}

export function createReplayGuard(windowSize = 128) {
  const seen = new Set<string>();
  const order: string[] = [];

  return {
    accept(id: string): boolean {
      if (seen.has(id)) return false;
      seen.add(id);
      order.push(id);
      while (order.length > windowSize) {
        const old = order.shift();
        if (old) seen.delete(old);
      }
      return true;
    },
    size() {
      return seen.size;
    },
  };
}
