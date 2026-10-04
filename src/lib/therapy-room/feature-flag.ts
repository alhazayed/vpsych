/**
 * Session interaction mode.
 *
 * The Therapy Room is the only way to run a session. "classic" survives only
 * as a stored value on past `sessions` rows; no new session is created with it.
 */

/** Every new session (learner or admin test) runs in the Therapy Room. */
export const NEW_SESSION_INTERACTION_MODE = "therapy_room" as const;

/** Read a stored `sessions.interaction_mode` value (past rows may be "classic"). */
export function parseInteractionMode(
  value: unknown,
): "classic" | "therapy_room" {
  if (value === "therapy_room") return "therapy_room";
  return "classic";
}
