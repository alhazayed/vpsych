/**
 * Canonical Therapy Room feature flag.
 *
 * Single source of truth for Therapy Room Mode + Virtual Mental Health Center.
 * Classic VoiceSession remains default when unset/false.
 */

export function isTherapyRoomModeEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_THERAPY_ROOM_MODE;
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export function parseInteractionMode(
  value: unknown,
): "classic" | "therapy_room" {
  if (value === "therapy_room") return "therapy_room";
  return "classic";
}

/**
 * Resolve whether a new session should use Therapy Room Mode.
 * Requires the public flag AND an explicit therapy_room request.
 */
export function shouldUseTherapyRoom(requested?: unknown): boolean {
  if (!isTherapyRoomModeEnabled()) return false;
  return parseInteractionMode(requested) === "therapy_room";
}
