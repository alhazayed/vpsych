/**
 * Longitudinal Adaptation carry across sessions (R-I1).
 * Alliance evolves via beginNextSession — never virgin reset when dyad continuum exists.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  beginNextSession,
  createAdaptationState,
  extractAdaptationFromMemory,
  type PatientAdaptationState,
} from "@/lib/adaptation";
import type { ClinicalIntelligenceMindState } from "@/lib/clinical-intelligence/types";
import { extractMindState } from "@/lib/clinical-intelligence/mind-state";
import {
  advanceRecoveryTrajectory,
  computeRelapseRisk,
  evolveBeliefStrengths,
  evolveInsightBand,
  evolveStressReservoir,
} from "@/lib/clinical-intelligence/recovery";
import { clamp01to100 } from "@/lib/clinical-intelligence/clamp";

export type DyadCarryResult = {
  adaptation: PatientAdaptationState | null;
  mind: ClinicalIntelligenceMindState | null;
  carried: boolean;
};

/**
 * Load most recent completed/expired session's case_memory for this therapist↔avatar dyad
 * and carry Adaptation + CI mind state into the new session continuum.
 */
export async function loadDyadClinicalCarry(
  supabase: SupabaseClient,
  input: {
    therapistId: string;
    avatarId: string;
    excludeSessionId?: string | null;
    newCaseInstanceId?: string | null;
  },
): Promise<DyadCarryResult> {
  try {
    let query = supabase
      .from("sessions")
      .select("id, case_instance_id, status, ended_at, started_at")
      .eq("therapist_id", input.therapistId)
      .eq("avatar_id", input.avatarId)
      .in("status", ["completed", "expired"])
      .order("ended_at", { ascending: false })
      .limit(1);
    if (input.excludeSessionId) {
      query = query.neq("id", input.excludeSessionId);
    }
    const { data: priorSessions, error } = await query;
    if (error || !priorSessions?.length) {
      return { adaptation: null, mind: null, carried: false };
    }
    const prior = priorSessions[0]!;
    if (!prior.case_instance_id) {
      return { adaptation: null, mind: null, carried: false };
    }

    const { data: memRow } = await supabase
      .from("case_memory")
      .select("memory")
      .eq("case_instance_id", prior.case_instance_id)
      .maybeSingle();

    if (!memRow?.memory || typeof memRow.memory !== "object") {
      return { adaptation: null, mind: null, carried: false };
    }

    const priorAdaptation = extractAdaptationFromMemory(memRow.memory);
    const priorMind = extractMindState(memRow.memory);

    let adaptation: PatientAdaptationState | null = null;
    if (priorAdaptation) {
      adaptation = beginNextSession(priorAdaptation);
      if (input.newCaseInstanceId) {
        adaptation.case_instance_id = input.newCaseInstanceId;
      }
    }

    let mind: ClinicalIntelligenceMindState | null = null;
    if (priorMind) {
      mind = {
        ...priorMind,
        case_instance_id: input.newCaseInstanceId ?? priorMind.case_instance_id,
        recovery: advanceRecoveryTrajectory(priorMind.recovery, {
          allianceTrust: adaptation?.trust.level ?? 40,
        }),
        belief_strength_overrides: evolveBeliefStrengths(
          priorMind.belief_strength_overrides,
          (priorMind.recovery.sessions_completed ?? 0) + 1,
          adaptation?.trust.level ?? 40,
        ),
        insight_band: priorMind.insight_band
          ? evolveInsightBand(
              priorMind.insight_band,
              true,
              (priorMind.recovery.sessions_completed ?? 0) + 1,
              0,
            )
          : priorMind.insight_band,
        stress_reservoir: evolveStressReservoir(
          priorMind.stress_reservoir,
          priorMind.stress_reservoir.acute,
          -2,
        ),
        decision_traces: [],
        updated_at: new Date().toISOString(),
      };
      mind.relapse_risk = computeRelapseRisk({
        recovery: mind.recovery,
        chronicStress: mind.stress_reservoir.chronic_load,
        allianceTrust: adaptation?.trust.level ?? 40,
        hope: 40,
      });
      if (mind.self_esteem_global !== undefined && adaptation) {
        mind.self_esteem_global = clamp01to100(
          mind.self_esteem_global + (adaptation.trust.level >= 60 ? 0.5 : 0),
        );
      }
    }

    return {
      adaptation,
      mind,
      carried: Boolean(adaptation || mind),
    };
  } catch {
    return { adaptation: null, mind: null, carried: false };
  }
}

/**
 * Resolve adaptation for a turn: prefer case_memory state; else dyad carry; else fresh.
 */
export function resolveAdaptationForSession(input: {
  loaded: PatientAdaptationState | null;
  carried: PatientAdaptationState | null;
  caseInstanceId: string | null;
  therapistId: string;
}): PatientAdaptationState {
  if (input.loaded) return input.loaded;
  if (input.carried) return input.carried;
  return createAdaptationState({
    caseInstanceId: input.caseInstanceId,
    therapistId: input.therapistId,
  });
}
