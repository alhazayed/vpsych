/**
 * HCE → ACE bridge (Phase D — Layer 15).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { HceSessionSignals, HceMemoryState } from "@/lib/hce/types";
import { extractHceState } from "@/lib/hce/state";
import { buildLongitudinalCarryover } from "@/lib/hce/longitudinal";

export async function extractHceSessionSignals(
  writer: SupabaseClient,
  sessionId: string,
  caseInstanceId: string | null,
): Promise<HceSessionSignals | null> {
  if (!caseInstanceId) return null;

  const { data: mem } = await writer
    .from("case_memory")
    .select("memory")
    .eq("case_instance_id", caseInstanceId)
    .maybeSingle();

  const state = extractHceState(
    mem
      ? {
          case_instance_id: caseInstanceId,
          memory: mem.memory as Record<string, unknown>,
        }
      : null,
  );

  const { data: logs } = await writer
    .from("hce_turn_log")
    .select("latency_ms, engine_snapshots, turn_brief")
    .eq("session_id", sessionId)
    .order("turn_index", { ascending: true });

  const turnCount = logs?.length ?? 0;
  let latencySum = 0;
  let latencyCount = 0;
  let ruptures = 0;
  let repairs = 0;
  let triggers = 0;

  for (const log of logs ?? []) {
    if (log.latency_ms) {
      latencySum += log.latency_ms;
      latencyCount += 1;
    }
    const snapshots = log.engine_snapshots as {
      emotion?: { triggers_fired?: string[] };
      timing?: { pause_before_ms?: number };
    } | null;
    if (snapshots?.emotion?.triggers_fired?.length) {
      triggers += snapshots.emotion.triggers_fired.length;
    }
    const brief = log.turn_brief as { therapist_move?: string } | null;
    if (brief?.therapist_move === "invalidation") ruptures += 1;
    if (brief?.therapist_move === "rupture_repair") repairs += 1;
    if (snapshots?.timing?.pause_before_ms) {
      latencySum += snapshots.timing.pause_before_ms;
      latencyCount += 1;
    }
  }

  const missedSafety =
    state.safety.level !== "none" && !state.safety.si_assessed;

  return {
    final_alliance: state.relationship.alliance,
    final_trust: state.internal.trust,
    disclosure_depth: state.disclosure_layer,
    missed_safety: missedSafety,
    alliance_ruptures: ruptures,
    successful_repairs: repairs,
    emotional_triggers_fired: triggers,
    avg_response_latency_ms:
      latencyCount > 0 ? Math.round(latencySum / latencyCount) : 0,
    hce_turn_count: turnCount,
  };
}

export function hceSignalsToAceHints(signals: HceSessionSignals): {
  weaknessTags: string[];
  strengthTags: string[];
  difficultyBias: "easier" | "same" | "harder";
} {
  const weaknessTags: string[] = [];
  const strengthTags: string[] = [];

  if (signals.missed_safety) weaknessTags.push("risk_assessment");
  if (signals.alliance_ruptures > signals.successful_repairs) {
    weaknessTags.push("therapeutic_alliance");
  }
  if (signals.final_trust < 40) weaknessTags.push("empathy");
  if (signals.disclosure_depth < 2) weaknessTags.push("diagnostic_interview");
  if (signals.successful_repairs > 0) strengthTags.push("therapeutic_alliance");
  if (signals.final_trust > 70) strengthTags.push("empathy");

  let difficultyBias: "easier" | "same" | "harder" = "same";
  if (weaknessTags.length >= 2) difficultyBias = "easier";
  if (strengthTags.length >= 2 && weaknessTags.length === 0) {
    difficultyBias = "harder";
  }

  return { weaknessTags, strengthTags, difficultyBias };
}

export async function finalizeHceSessionMemory(
  writer: SupabaseClient,
  caseInstanceId: string,
  memory: Record<string, unknown>,
  sessionEndedWell: boolean,
): Promise<void> {
  const state = extractHceState({
    case_instance_id: caseInstanceId,
    memory,
  });
  const summary = buildLongitudinalCarryover(state, sessionEndedWell);
  const merged = {
    ...memory,
    hce: { ...state, longitudinal: summary },
  };
  await writer
    .from("case_memory")
    .update({ memory: merged, updated_at: new Date().toISOString() })
    .eq("case_instance_id", caseInstanceId);
}

export function adaptiveHcePresetFromSignals(
  signals: HceSessionSignals,
  baseDifficulty: string,
): {
  masking: string;
  resistance: string;
  insight: string;
} {
  const hints = hceSignalsToAceHints(signals);
  if (hints.difficultyBias === "harder") {
    return {
      masking: "high",
      resistance: "high",
      insight: "low",
    };
  }
  if (hints.difficultyBias === "easier") {
    return {
      masking: "low",
      resistance: "low",
      insight: "high",
    };
  }
  return {
    masking: "moderate",
    resistance: "moderate",
    insight: "moderate",
  };
}
