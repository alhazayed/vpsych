/**
 * Learner-facing view of the Emotion Engine state.
 *
 * `EmotionState.disorder_slug` is the case's primary diagnosis. In a skill
 * test the case is sealed from the trainee, so the session-owner API must
 * never return it. Admins keep the full state.
 */

import type { EmotionState } from "@/lib/emotion/types";

export type PublicEmotionState = Omit<EmotionState, "disorder_slug">;

export function publicEmotionState(state: EmotionState): PublicEmotionState {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { disorder_slug, ...rest } = state;
  return rest;
}
