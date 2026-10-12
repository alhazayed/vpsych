/**
 * Request-body checks for the Therapy Room write routes (notes, clinic
 * appointments, immersion metrics). The database enums reject a bad format
 * or status too, but only as a 500; these answer 400 before any write, and
 * cover what the database does not check (URL scheme, JSON size).
 */

import type { AppointmentStatus, NoteFormat } from "./types";

export const NOTE_FORMATS: readonly NoteFormat[] = [
  "soap",
  "dap",
  "birp",
  "free",
  "voice",
];

export const APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
  "scheduled",
  "checked_in",
  "in_session",
  "completed",
  "no_show",
  "cancelled",
];

export function isNoteFormat(value: unknown): value is NoteFormat {
  return (NOTE_FORMATS as readonly unknown[]).includes(value);
}

export function isAppointmentStatus(value: unknown): value is AppointmentStatus {
  return (APPOINTMENT_STATUSES as readonly unknown[]).includes(value);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export const VOICE_URL_MAX_CHARS = 2048;

/**
 * A note's voice recording link: absent/empty is `null`; otherwise an
 * https URL of at most 2,048 characters. Anything else (javascript:, data:,
 * http:, not a string) is rejected.
 */
export function parseVoiceUrl(
  value: unknown,
): { ok: true; value: string | null } | { ok: false } {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: null };
  }
  if (typeof value !== "string" || value.length > VOICE_URL_MAX_CHARS) {
    return { ok: false };
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? { ok: true, value } : { ok: false };
  } catch {
    return { ok: false };
  }
}

/** The room's own metrics are well under 2 KB; this leaves ample headroom. */
export const IMMERSION_METRICS_MAX_BYTES = 16 * 1024;

/** A plain JSON object no larger than `IMMERSION_METRICS_MAX_BYTES`. */
export function isImmersionMetrics(
  value: unknown,
): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  let json: string;
  try {
    json = JSON.stringify(value);
  } catch {
    return false;
  }
  return new TextEncoder().encode(json).length <= IMMERSION_METRICS_MAX_BYTES;
}
