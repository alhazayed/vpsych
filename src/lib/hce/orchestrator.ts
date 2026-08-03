/**
 * HCE orchestrator — Phases A–D integrated turn pipeline.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isCaseSnapshot } from "@/lib/case-engine/persist";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import { HCE_MAX_UTTERANCE_CHARS } from "@/lib/hce/config";
import { splitUtteranceForStreaming } from "@/lib/hce/delivery";
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
  applyInternalDeltas,
  internalTick,
} from "@/lib/hce/engines/internal-state";
import {
  memoryTick,
  applyMemoryWrites,
} from "@/lib/hce/engines/memory";
import { timingTick } from "@/lib/hce/engines/timing";
import { voiceTick } from "@/lib/hce/engines/voice";
import { hydrateLongitudinalMemory } from "@/lib/hce/longitudinal";
import { classifyTherapistMove } from "@/lib/hce/reasoning/classify-therapist-move";
import { generateHcePatientTurn } from "@/lib/hce/reasoning/patient-reasoner";
import { extractHceState, mergeCaseMemory } from "@/lib/hce/state";
import type {
  CaseMemoryRow,
  DeliveryTag,
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
  state = await hydrateLongitudinalMemory(
    params.writer,
    params.memoryRow?.longitudinal_group_id,
    state,
  );

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
  const timingOut = timingTick(snapshot, emotionOut, turnIndex);
  const internalOut = internalTick(state);

  const turnBriefPreVoice = buildTurnBrief({
    snapshot,
    therapistMove,
    memory: memoryOut,
    clinical: clinicalOut,
    emotion: emotionOut,
    environment: environmentOut,
    behavior: behaviorOut,
    voice: {
      stability: 0.4,
      similarity_boost: 0.75,
      style: 0.2,
      pause_before_ms: timingOut.pause_before_ms,
      speech_rate: timingOut.speech_rate,
      volume_hint: 1,
      tremor_hint: 0,
      breathiness_hint: 0,
      directives: [],
    },
    timing: timingOut,
    internal: internalOut,
    sessionLanguage: params.sessionLanguage,
    locale: snapshot.locale,
    therapistBargeIn: params.therapistBargeIn,
  });

  const deliveryTags = parseDeliveryTags(turnBriefPreVoice.delivery_directives);
  const voiceOut = voiceTick(
    emotionOut,
    behaviorOut,
    timingOut.pause_before_ms,
    timingOut.speech_rate,
    deliveryTags,
  );

  const turnBrief = { ...turnBriefPreVoice, voice_directives: voiceOut.directives };

  const engineSnapshots: EngineSnapshots = {
    memory: memoryOut,
    emotion: emotionOut,
    clinical: clinicalOut,
    environment: environmentOut,
    behavior: behaviorOut,
    voice: voiceOut,
    timing: timingOut,
    internal: internalOut,
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
  const outputTags: DeliveryTag[] =
    reasoner.output.delivery_tags ?? deliveryTags;

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
  state = applyInternalDeltas(state, therapistMove, emotionOut, environmentOut);
  state = applyMemoryWrites(
    state,
    reasoner.output.memory_writes,
    reasoner.output.emotional_memory_writes,
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
    engineSnapshots: {
      ...engineSnapshots,
      internal: state.internal,
    },
    reasoningMode: turnBrief.reasoning_mode,
    model: reasoner.model,
    latencyMs: Date.now() - start,
  });

  const streamChunks = splitUtteranceForStreaming(utterance);
  const finalTags = reasoner.output.delivery_tags ?? outputTags;

  return {
    text: utterance,
    aiSource: reasoner.aiSource,
    model: reasoner.model,
    errorKind: reasoner.errorKind,
    reasoningMode: turnBrief.reasoning_mode,
    voiceHints: {
      ...voiceOut,
      voice_markup: reasoner.output.voice_markup,
      delivery_tags: finalTags,
      stream_chunks: streamChunks.length > 1 ? streamChunks : undefined,
    },
    alliance: state.relationship.alliance,
    trust: state.internal.trust,
    directorAction: turnBrief.director_action,
    disclosureClass: turnBrief.disclosure_class,
    emotionVector: state.emotion.vector,
    deliveryTags: finalTags,
    patientInterrupt: turnBrief.patient_should_interrupt,
    hceEnabled: true,
  };
}

function parseDeliveryTags(directives: string[]): DeliveryTag[] {
  const tags: DeliveryTag[] = [];
  const line = directives.find((d) => d.startsWith("tags:"));
  if (!line) return tags;
  const raw = line.replace("tags:", "").split(",");
  const allowed: DeliveryTag[] = [
    "hesitation",
    "trail_off",
    "self_correct",
    "sigh",
    "nervous_laugh",
    "whisper",
    "repeat_word",
    "false_start",
    "topic_shift",
    "filler_words",
    "cry",
    "long_pause",
  ];
  for (const t of raw) {
    const key = t.trim() as DeliveryTag;
    if (allowed.includes(key)) tags.push(key);
  }
  return tags;
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

  if (error?.code === "42P01") return;
  if (error) {
    console.warn("[hce] turn log insert failed", { error: error.message });
  }
}

export function parseCaseSnapshot(raw: unknown): CaseInstanceSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  if (!isCaseSnapshot(raw)) return null;
  return raw as CaseInstanceSnapshot;
}
