/**
 * Soft-fail realtime metrics stamp after assessment pipeline.
 * Never blocks report. Never writes clinical_snapshot / case_memory /
 * patient_long_term_memory / DecisionPlan / patient prompt.
 * Never owns Emotion, Adaptation, Case Engine, Clinical Intelligence,
 * Validation, Supervisor, or Enterprise tenancy.
 */

import { runRealtimeEngine } from "@/lib/realtime/engine";
import { realtimeMetrics } from "@/lib/realtime/observability";
import type { RealtimeBundle } from "@/lib/realtime/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RealtimeBridgeResult = {
  ok: boolean;
  bundle: RealtimeBundle | null;
  error: string | null;
};

/**
 * Best-effort Stage 11 realtime hook.
 * Observability / presentation summary only.
 */
export async function runRealtimeAfterAssessment(
  _supabase: SupabaseClient,
  opts: {
    userId: string;
    sessionId: string;
    locale?: string | null;
    remainingSec?: number;
  },
): Promise<RealtimeBridgeResult> {
  try {
    const bundle = runRealtimeEngine({
      sessionId: opts.sessionId,
      locale: opts.locale,
      remainingSec: opts.remainingSec,
      waitingRoom: false,
    });
    realtimeMetrics.record({
      kind: "latency",
      sessionId: opts.sessionId,
      value: bundle.session.latencyMs ?? 0,
      detail: `post_assessment:${opts.userId.slice(0, 8)}`,
    });
    return { ok: true, bundle, error: null };
  } catch (err) {
    return {
      ok: false,
      bundle: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
