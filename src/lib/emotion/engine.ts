/**
 * Emotion Engine façade — session-turn orchestration.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { deriveExpression } from "@/lib/emotion/expression";
import {
  ensureEmotionState,
  saveEmotionState,
} from "@/lib/emotion/store";
import {
  initEmotionState,
  tickEmotion,
} from "@/lib/emotion/state-machine";
import type {
  EmotionExpression,
  EmotionState,
  EmotionTickResult,
  TherapistIntervention,
} from "@/lib/emotion/types";

export type ProcessEmotionTurnInput = {
  supabase: SupabaseClient;
  caseInstanceId: string | null | undefined;
  sessionId: string;
  disorderSlug?: string | null;
  therapistMessage: string;
  intervention?: TherapistIntervention;
  elapsedSeconds?: number;
};

export type ProcessEmotionTurnResult = {
  ok: true;
  state: EmotionState;
  expression: EmotionExpression;
  applied: EmotionTickResult["applied"];
  persisted: boolean;
} | {
  ok: false;
  reason: string;
};

/**
 * Load (or init) emotion state, apply therapist turn, persist.
 * Soft-fails when case_instance_id is missing (legacy sessions).
 */
export async function processEmotionTurn(
  input: ProcessEmotionTurnInput,
): Promise<ProcessEmotionTurnResult> {
  if (!input.caseInstanceId) {
    // Ephemeral state for legacy sessions without Case Engine
    const ephemeral = initEmotionState({
      sessionId: input.sessionId,
      disorderSlug: input.disorderSlug,
    });
    const tick = tickEmotion({
      state: ephemeral,
      therapistMessage: input.therapistMessage,
      intervention: input.intervention,
      disorderSlug: input.disorderSlug,
      elapsedSeconds: input.elapsedSeconds,
    });
    return {
      ok: true,
      state: tick.state,
      expression: tick.expression,
      applied: tick.applied,
      persisted: false,
    };
  }

  const state = await ensureEmotionState(input.supabase, {
    caseInstanceId: input.caseInstanceId,
    sessionId: input.sessionId,
    disorderSlug: input.disorderSlug,
  });

  if (!state) {
    return { ok: false, reason: "emotion_state_unavailable" };
  }

  const tick = tickEmotion({
    state,
    therapistMessage: input.therapistMessage,
    intervention: input.intervention,
    disorderSlug: input.disorderSlug,
    elapsedSeconds: input.elapsedSeconds,
  });

  const persisted = await saveEmotionState(
    input.supabase,
    input.caseInstanceId,
    tick.state,
  );

  return {
    ok: true,
    state: tick.state,
    expression: tick.expression,
    applied: tick.applied,
    persisted,
  };
}

/** Snapshot helper for GET APIs. */
export function emotionSnapshot(state: EmotionState): {
  state: EmotionState;
  expression: EmotionExpression;
} {
  return { state, expression: deriveExpression(state) };
}
