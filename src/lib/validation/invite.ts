import { createHash, timingSafeEqual } from "node:crypto";

/** HttpOnly cookie set after a valid invitation code is redeemed. */
export const VALIDATION_ACCESS_COOKIE = "vpsych_validation_access";

/** Cookie TTL: 14 days — long enough for a multi-session review window. */
export const VALIDATION_ACCESS_MAX_AGE_SEC = 60 * 60 * 24 * 14;

/**
 * Invitation codes for the expert evaluation portal.
 * Comma-separated in `VALIDATION_INVITE_CODES`. In non-production, falls back
 * to `RC1-PREVIEW` when unset so local review of `/validation` works.
 */
export function configuredInviteCodes(): string[] {
  const raw = process.env.VALIDATION_INVITE_CODES?.trim();
  if (raw) {
    return [
      ...new Set(
        raw
          .split(",")
          .map((c) => normalizeInviteCode(c))
          .filter(Boolean),
      ),
    ];
  }
  if (process.env.NODE_ENV !== "production") {
    return ["RC1-PREVIEW"];
  }
  return [];
}

export function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Constant-time membership check against configured invite codes. */
export function isValidInviteCode(candidate: string): boolean {
  const normalized = normalizeInviteCode(candidate);
  if (!normalized) return false;

  const codes = configuredInviteCodes();
  if (codes.length === 0) return false;

  const candidateDigest = digest(normalized);
  let matched = false;
  for (const code of codes) {
    const codeDigest = digest(code);
    if (
      candidateDigest.length === codeDigest.length &&
      timingSafeEqual(candidateDigest, codeDigest)
    ) {
      matched = true;
    }
  }
  return matched;
}

/**
 * Opaque cookie payload: HMAC-like digest of a fixed purpose string + code.
 * Verified only by re-hashing against configured codes (no shared secret needed
 * beyond the env list itself).
 */
export function accessCookieValueForCode(code: string): string {
  const normalized = normalizeInviteCode(code);
  return digest(`vpsych-validation-access:v1:${normalized}`).toString("hex");
}

export function isValidAccessCookie(value: string | undefined | null): boolean {
  if (!value || !/^[a-f0-9]{64}$/i.test(value)) return false;
  const codes = configuredInviteCodes();
  const presented = Buffer.from(value.toLowerCase(), "utf8");
  let matched = false;
  for (const code of codes) {
    const expected = Buffer.from(accessCookieValueForCode(code), "utf8");
    if (
      presented.length === expected.length &&
      timingSafeEqual(presented, expected)
    ) {
      matched = true;
    }
  }
  return matched;
}
