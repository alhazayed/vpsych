/**
 * Request correlation IDs (Stage 12 / RT-12).
 *
 * Propagates or mints `X-Request-Id` across STT → message → TTS without
 * changing pipeline ownership. Safe for clients to echo on subsequent hops.
 */

const HEADER = "x-request-id";
const MAX_LEN = 128;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mintId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Accept a client-supplied id when well-formed; otherwise mint. */
export function resolveRequestId(request: Request): string {
  const raw = request.headers.get(HEADER)?.trim() ?? "";
  if (!raw || raw.length > MAX_LEN) return mintId();
  // Allow UUID or opaque alphanumerics / dashes / underscores.
  if (UUID_RE.test(raw) || /^[A-Za-z0-9._-]{8,128}$/.test(raw)) {
    return raw;
  }
  return mintId();
}

/** Headers object for NextResponse / fetch propagation. */
export function requestIdHeaders(requestId: string): Record<string, string> {
  return { "X-Request-Id": requestId };
}

export const REQUEST_ID_HEADER = "X-Request-Id";
