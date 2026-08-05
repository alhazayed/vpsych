/**
 * HCE orchestrator — runTurn coordinates engines, reasoning, persistence hooks.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isCaseSnapshot } from "@/lib/case-engine/persist";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import { HCE_MAX_UTTERANCE_CHARS } from "@/lib/hce/config";
import {
  scanPatientUtterance,
  scanTherapistMessageForManipulation,
} from "@/lib/hce/bias";
import { buildTurnBrief } from "@/lib/hce/director";
import { behaviorTick, applyBehavior } from "@/lib/hce/engines/behavior";
import {
  clinicalTick,
  applyClinicalEvents,
  validateClinicalUtterance,
} from "@/lib/hce/engines/clinical";
import { emotionTick, applyEmotionDelta } from "@/lib/hce/engines/emotion";
import { environmentTick, applyEnvironment } from "@/lib/hce/engines/environment";
import {
  memoryTick,
  applyMemoryWrites,
} from "@/lib/hce/engines/memory";
import { voiceTick } from "@/lib/hce/engines/voice";
import { classifyTherapistMove } from "@/lib/hce/reasoning/classify-therapist-move";
import { generateHcePatientTurn } from "@/lib/hce/reasoning/patient-reasoner";
import { extractHceState, mergeCaseMemory } from "@/lib/hce/state";
import type {
  CaseMemoryRow,
  EngineSnapshots,
  HceTurnInput,
  HceTurnResult,
} from "@/lib/hce/types";

export type RunHceTurnParams = HceTurnInput & {
  writer: SupabaseClient;
};

export async function runHceTurn(
  params: RunHceTurnParams,
): Promise<HceTurnResult> {
  const start = Date.now();
  const turnIndex = params.history.length;
  const snapshot = params.caseSnapshot;

  const manipulation = scanTherapistMessageForManipulation(params.userMessage);
  if (!manipulation.ok) {
    console.warn("[hce] therapist message flagged", {
      sessionId: params.sessionId,
      violations: manipulation.violations,
    });
  }

  let state = extractHceState(params.memoryRow);
  const therapistMove = classifyTherapistMove(params.userMessage);

  const memoryOut = memoryTick(state, params.userMessage);
  const clinicalOut = clinicalTick(
    snapshot,
    state,
    therapistMove,
    params.userMessage,
  );
  const emotionOut = emotionTick(
    snapshot,
    state,
    therapistMove,
    params.userMessage,
  );
  const environmentOut = environmentTick(
    snapshot,
    state,
    params.elapsedSeconds,
    params.maxDurationSec,
  );
  const behaviorOut = behaviorTick(
    snapshot,
    state,
    therapistMove,
    emotionOut,
    environmentOut,
  );
  const voiceOut = voiceTick(emotionOut, behaviorOut);

  const turnBrief = buildTurnBrief({
    therapistMove,
    memory: memoryOut,
    clinical: clinicalOut,
    emotion: emotionOut,
    environment: environmentOut,
    behavior: behaviorOut,
    voice: voiceOut,
    sessionLanguage: params.sessionLanguage,
    locale: snapshot.locale,
  });

  const engineSnapshots: EngineSnapshots = {
    memory: memoryOut,
    emotion: emotionOut,
    clinical: clinicalOut,
    environment: environmentOut,
    behavior: behaviorOut,
    voice: voiceOut,
  };

  let reasoner = await generateHcePatientTurn({
    avatar: params.avatar,
    history: params.history,
    userMessage: params.userMessage,
    turnBrief,
    memory: memoryOut,
    hceState: state,
    reasoningMode: turnBrief.reasoning_mode,
  });

  let utterance = reasoner.output.patient_utterance.slice(
    0,
    HCE_MAX_UTTERANCE_CHARS,
  );

  const clinicalValidation = validateClinicalUtterance(
    utterance,
    snapshot.clinical_core,
    state,
  );
  const biasScan = scanPatientUtterance(utterance);

  if (!clinicalValidation.ok || !biasScan.ok) {
    console.warn("[hce] utterance rejected, retrying once", {
      sessionId: params.sessionId,
      clinical: clinicalValidation.reason,
      bias: biasScan.violations,
    });
    const retryBrief = {
      ...turnBrief,
      constraints: [
        ...turnBrief.constraints,
        "Previous reply violated simulation rules; comply strictly with withhold rules.",
      ],
    };
    reasoner = await generateHcePatientTurn({
      avatar: params.avatar,
      history: params.history,
      userMessage: params.userMessage,
      turnBrief: retryBrief,
      memory: memoryOut,
      hceState: state,
      reasoningMode: "deep",
    });
    utterance = reasoner.output.patient_utterance.slice(
      0,
      HCE_MAX_UTTERANCE_CHARS,
    );
  }

  state = applyEnvironment(state, environmentOut);
  state = applyEmotionDelta(state, reasoner.output.emotion_delta, emotionOut);
  state = applyClinicalEvents(
    state,
    reasoner.output.clinical_events,
    utterance,
    clinicalOut,
  );
  state = applyBehavior(state, behaviorOut, therapistMove);
  state = applyMemoryWrites(
    state,
    reasoner.output.memory_writes,
    turnIndex,
    params.userMessage,
  );

  await persistHceState(params.writer, params.caseInstanceId, params.memoryRow, state);
  await logHceTurn(params.writer, {
    sessionId: params.sessionId,
    turnIndex,
    therapistMessage: params.userMessage,
    patientUtterance: utterance,
    turnBrief,
    engineSnapshots,
    reasoningMode: turnBrief.reasoning_mode,
    model: reasoner.model,
    latencyMs: Date.now() - start,
  });

  return {
    text: utterance,
    aiSource: reasoner.aiSource,
    model: reasoner.model,
    errorKind: reasoner.errorKind,
    reasoningMode: turnBrief.reasoning_mode,
    voiceHints: {
      ...voiceOut,
      voice_markup: reasoner.output.voice_markup,
    },
    alliance: state.relationship.alliance,
    hceEnabled: true,
  };
}

async function persistHceState(
  writer: SupabaseClient,
  caseInstanceId: string,
  memoryRow: CaseMemoryRow | null,
  state: ReturnType<typeof extractHceState>,
): Promise<void> {
  const existing = memoryRow?.memory ?? { scope: "case_instance" };
  const merged = mergeCaseMemory(existing, state);

  const { error } = await writer
    .from("case_memory")
    .upsert({
      case_instance_id: caseInstanceId,
      memory: merged,
      updated_at: new Date().toISOString(),
    })
    .select("case_instance_id")
    .maybeSingle();

  if (error) {
    console.error("[hce] case_memory upsert failed", {
      caseInstanceId,
      error: error.message,
    });
  }
}

async function logHceTurn(
  writer: SupabaseClient,
  row: {
    sessionId: string;
    turnIndex: number;
    therapistMessage: string;
    patientUtterance: string;
    turnBrief: unknown;
    engineSnapshots: EngineSnapshots;
    reasoningMode: string;
    model?: string;
    latencyMs: number;
  },
): Promise<void> {
  const { error } = await writer.from("hce_turn_log").insert({
    session_id: row.sessionId,
    turn_index: row.turnIndex,
    therapist_message: row.therapistMessage.slice(0, 4000),
    patient_utterance: row.patientUtterance.slice(0, 4000),
    turn_brief: row.turnBrief,
    engine_snapshots: row.engineSnapshots,
    reasoning_mode: row.reasoningMode,
    gpt_model: row.model ?? null,
    latency_ms: row.latencyMs,
  });

  if (error?.code === "42P01") {
    return;
  }
  if (error) {
    console.warn("[hce] turn log insert failed", { error: error.message });
  }
}

export function parseCaseSnapshot(
  raw: unknown,
): CaseInstanceSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  if (!isCaseSnapshot(raw)) return null;
  return raw as CaseInstanceSnapshot;
}
