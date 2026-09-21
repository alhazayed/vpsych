import { timingSafeEqual } from "node:crypto";

/**
 * Authorize a cron Route Handler via `Authorization: Bearer $CRON_SECRET`.
 * Fail-closed when CRON_SECRET is unset. Uses timing-safe comparison.
 * Never returns whether the secret was "almost correct."
 */
export function authorizeCronRequest(
  request: Request,
): { ok: true } | { ok: false; status: 401 | 503; error: string } {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return {
      ok: false,
      status: 503,
      error: "Cron endpoint is not configured",
    };
  }

  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  return { ok: true };
}
