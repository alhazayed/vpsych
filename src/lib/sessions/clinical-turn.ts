/**
 * Shared clinical turn pipeline for POST /api/sessions/:id/message (classic)
 * and POST /api/sessions/:id/message/stream (realtime SSE).
 *
 * This module is the single owner of patient-turn cognition on the request
 * path. Both routes call the same three steps:
 *
 *   prepareClinicalTurn()    session checks → Adaptation → resolveAvatar →
 *                            Memory → user message insert → Emotion → CBE →
 *                            PatientDecisionPlan → Humanization
 *   generateValidatedReply() draft → canonical-fact gate → ONE regeneration →
 *                            persona fallback (the caller supplies the drafting
 *                            function: blocking for classic, streaming for SSE)
 *   persistAssistantReply()  insert_assistant_message (live 4-arg contract)
 *
 * The routes differ only in transport. Nothing here may be forked into a
 * route: a second copy of this pipeline is exactly the drift that produced a
 * persona with two different minds.
 */

import { withSkillTestCase } from "@/lib/skill-tests";
import type { SupabaseClient } from "@supabase/supabase-js";
import { messageRpcClient, prepareMessageRpc } from "@/lib/supabase/admin";
import type { PatientReplyResult } from "@/lib/ai/patient-agent";
import {
  validatePatientReply,
  type CanonicalReplyFacts,
  type ReplyValidationResult,
} from "@/lib/ai/reply-validation";
import { resolveMedicationFacts } from "@/lib/ai/medication-facts";
import { resolveCaseFile } from "@/lib/ai/canonical-facts";
import { resolveAvatar } from "@/lib/avatars/resolve";
import {
  embedAdaptationInMemory,
  loadAdaptationState,
  processTherapistTurn,
  saveAdaptationState,
  type CaseMemoryBlob,
} from "@/lib/adaptation";
import { prepareMemoryForTurn } from "@/lib/patient-memory";
import { injectTherapyCourseIntoSystemPrompt } from "@/lib/therapy-course";
import { injectCrisisEscalationIntoSystemPrompt } from "@/lib/session-practice";
import {
  isConversationBehaviourEnabled,
  planConversationBehaviour,
  type ConversationBehaviourPlan,
} from "@/lib/conversation-behaviour";
import {
  buildHumanizationTurn,
  toClientHints,
} from "@/lib/humanization";
import { remainingSeconds } from "@/lib/session-timer";
import { expireStaleSession } from "@/lib/session-expiry";
import { clientSafeError } from "@/lib/api-errors";
import {
  expressionPromptBlock,
  processEmotionTurn,
} from "@/lib/emotion";
import {
  appendDecisionTrace,
  buildBehaviorProfile,
  createMindState,
  decidePatientTurn,
  embedMindState,
  extractMindState,
  formatDecisionPlanForPrompt,
  loadDyadClinicalCarry,
  normalizeTherapyResponseProfile,
  resolveAdaptationForSession,
  therapyAllianceFromAdaptation,
  updateHomeworkAdherence,
  recomputeTreatmentOverall,
  type PatientDecisionPlan,
} from "@/lib/clinical-intelligence";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import type {
  Avatar,
  ResolvedAvatar,
  SessionMessage,
  TherapySession,
} from "@/lib/types";
import { MAX_SESSION_SECONDS } from "@/lib/types";

/** Max therapist turn length, shared by both transports. */
export const MAX_TURN_MESSAGE_CHARS = 4000;

export type TurnFailure = {
  ok: false;
  status: number;
  body: Record<string, unknown>;
};

/** Validate the request body's therapist message (trim + bounds). */
export function parseTurnMessage(
  body: { message?: unknown } | null | undefined,
): { ok: true; message: string } | TurnFailure {
  const message =
    typeof body?.message === "string" ? body.message.trim() : undefined;
  if (!message) {
    return { ok: false, status: 400, body: { error: "message required" } };
  }
  if (message.length > MAX_TURN_MESSAGE_CHARS) {
    return {
      ok: false,
      status: 400,
      body: { error: "message too long (max 4000 characters)" },
    };
  }
  return { ok: true, message };
}

export type EmotionPayload = {
  mode: string;
  variables: Record<string, number>;
  expression: {
    facial_affect: string;
    voice: Record<string, number>;
    hesitation_ms: number;
    word_choice: string[];
    body_language: string[];
    animation_hooks: string[];
    openness: number;
    summary: string;
  };
  applied: { intervention: string };
};

export type HumanizationTurn = ReturnType<typeof buildHumanizationTurn>;

/** Everything the patient generator needs, produced once per therapist turn. */
export type PreparedClinicalTurn = {
  sessionId: string;
  userId: string;
  message: string;
  therapistInterrupted: boolean;
  supabase: SupabaseClient;
  session: TherapySession & { avatars: Avatar };
  resolved: ResolvedAvatar;
  /** Fully reinforced avatar: memory + emotion + decision + humanization. */
  avatarForReply: ResolvedAvatar;
  historyRows: Pick<SessionMessage, "role" | "content">[];
  turnIndex: number;
  /** The persisted therapist message; the assistant reply is linked to it. */
  userMsg: SessionMessage;
  emotionPayload: EmotionPayload | null;
  behaviourPlan: ConversationBehaviourPlan | null;
  decisionPlan: PatientDecisionPlan | null;
  humanization: HumanizationTurn;
};

/**
 * Everything before patient generation. Clinical order is load-bearing and
 * guarded by architecture.test.ts:
 * Adaptation → resolveAvatar → Memory → Emotion → CBE → Decision → Humanization.
 *
 * Returns a TurnFailure (status + JSON body) for every pre-generation error so
 * both transports answer with identical HTTP semantics. The therapist message
 * is persisted here; nothing after a successful return can un-persist it.
 */
export async function prepareClinicalTurn(params: {
  supabase: SupabaseClient;
  userId: string;
  sessionId: string;
  message: string;
  therapistInterrupted: boolean;
}): Promise<{ ok: true; turn: PreparedClinicalTurn } | TurnFailure> {
  const { supabase, sessionId, message } = params;
  const user = { id: params.userId };

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("*, avatars(*, voice_profile:voice_profiles(*))")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return { ok: false, status: 404, body: { error: "Session not found" } };
  }

  if ((session as TherapySession).therapist_id !== user.id) {
    return { ok: false, status: 403, body: { error: "Forbidden" } };
  }
  // A skill test session keeps its case sealed; open it for the Patient Agent.
  const opened = withSkillTestCase(session as TherapySession & { avatars: Avatar });
  if (!opened.ok) {
    return {
      ok: false,
      status: 500,
      body: { error: "This test session could not be loaded. Please try again." },
    };
  }
  const typed = opened.session;
  if (typed.status !== "active") {
    return { ok: false, status: 409, body: { error: "Session is not active" } };
  }

  const remaining = remainingSeconds(typed.started_at, typed.max_duration_sec);
  if (remaining <= 0) {
    await expireStaleSession(supabase, typed);
    return {
      ok: false,
      status: 409,
      body: { error: "Session time expired", expired: true },
    };
  }

  // Mission 8 — Patient Adaptation (rapport / trust / withdrawal / disclosure).
  // Best-effort: missing case_memory must never block the reply.
  // Stage 6: when no in-case state, carry dyad Adaptation via beginNextSession (R-I1).
  const caseInstanceId = typed.case_instance_id ?? null;
  const loaded = await loadAdaptationState(supabase, caseInstanceId);
  let carriedAdaptation = null as Awaited<
    ReturnType<typeof loadDyadClinicalCarry>
  >["adaptation"];
  let carriedMind = null as Awaited<
    ReturnType<typeof loadDyadClinicalCarry>
  >["mind"];
  if (!loaded.state) {
    try {
      const carry = await loadDyadClinicalCarry(supabase, {
        therapistId: user.id,
        avatarId: typed.avatar_id,
        excludeSessionId: sessionId,
        newCaseInstanceId: caseInstanceId,
      });
      carriedAdaptation = carry.adaptation;
      carriedMind = carry.mind;
    } catch (err) {
      console.warn("[sessions/message] dyad carry soft-fail", {
        sessionId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  let adaptation = resolveAdaptationForSession({
    loaded: loaded.state,
    carried: carriedAdaptation,
    caseInstanceId,
    therapistId: user.id,
  });
  const adapted = processTherapistTurn(adaptation, message);
  adaptation = adapted.state;
  let memoryRaw: CaseMemoryBlob = loaded.raw ?? {};
  if (carriedMind && !extractMindState(memoryRaw)) {
    memoryRaw = embedMindState(memoryRaw, {
      ...carriedMind,
      case_instance_id: caseInstanceId,
    }) as CaseMemoryBlob;
  }
  void saveAdaptationState(supabase, caseInstanceId, adaptation, memoryRaw);

  // Case Engine: diagnosis from immutable session snapshot when present.
  const resolved = resolveAvatar(typed.avatars, typed.language, {
    caseSnapshot: typed.clinical_snapshot,
    adaptationBlock: adapted.expressionBlock,
  });

  // Mission 4 — Long-Term Patient Memory: retrieve prior facts for this dyad.
  // Best-effort; never blocks the turn if the table is missing.
  const memoryCtx = await prepareMemoryForTurn(supabase, {
    therapistId: user.id,
    avatarId: typed.avatar_id,
    longitudinalGroupId: null,
    userMessage: message,
    systemPrompt: resolved.system_prompt,
    identity: resolved.personality?.identity ?? null,
  });
  // Therapy course — which visit this is and the trainee's treatment plan,
  // frozen on the session snapshot. Empty for standalone sessions.
  const avatarWithMemory = {
    ...resolved,
    system_prompt: injectTherapyCourseIntoSystemPrompt(
      memoryCtx.systemPrompt,
      typed.clinical_snapshot?.therapy_course,
    ),
  };

  const { data: userMsg, error: userMsgError } = await supabase
    .from("session_messages")
    .insert({
      session_id: sessionId,
      role: "user",
      content: message,
    })
    .select("*")
    .single();

  if (userMsgError || !userMsg) {
    console.error("[sessions/message] user message save failed", {
      sessionId,
      error: userMsgError?.message,
    });
    return {
      ok: false,
      status: 500,
      body: { error: clientSafeError("Failed to save message", userMsgError) },
    };
  }

  const { data: history } = await supabase
    .from("session_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const historyRows = (history ?? []) as Pick<
    SessionMessage,
    "role" | "content"
  >[];
  // History includes the user message just inserted; assistant count ≈ prior turns.
  const turnIndex = historyRows.filter((m) => m.role === "assistant").length;

  // Prefer service role; fall back to authenticated client with HMAC p_sig
  // (Phase 8.2 / CQG-011). RPC bodies still enforce ownership / turn order.
  const writer = messageRpcClient(supabase);

  // Emotion Engine (Mission 2) — best-effort; never blocks the reply path.
  const snap = typed.clinical_snapshot as CaseInstanceSnapshot | null | undefined;
  const disorderSlug = snap?.primary_diagnosis?.slug ?? null;
  const elapsedSec =
    typed.max_duration_sec -
    remainingSeconds(typed.started_at, typed.max_duration_sec);

  let emotionPayload: EmotionPayload | null = null;

  let emotionSystemExtra = "";
  try {
    const emotionResult = await processEmotionTurn({
      supabase: writer,
      caseInstanceId: typed.case_instance_id,
      sessionId,
      disorderSlug,
      therapistMessage: message,
      elapsedSeconds: Math.max(0, elapsedSec),
    });
    if (emotionResult.ok) {
      emotionSystemExtra = `\n\n${expressionPromptBlock(emotionResult.expression)}`;
      emotionPayload = {
        mode: emotionResult.state.mode,
        variables: emotionResult.state.variables,
        expression: {
          facial_affect: emotionResult.expression.facial_affect,
          voice: emotionResult.expression.voice,
          hesitation_ms: emotionResult.expression.hesitation_ms,
          word_choice: emotionResult.expression.word_choice,
          body_language: emotionResult.expression.body_language,
          animation_hooks: emotionResult.expression.animation_hooks,
          openness: emotionResult.expression.openness,
          summary: emotionResult.expression.summary,
        },
        applied: { intervention: emotionResult.applied.intervention },
      };
    }
  } catch (err) {
    console.warn("[sessions/message] emotion engine soft-fail", {
      sessionId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  let avatarForReply = emotionSystemExtra
    ? {
        ...avatarWithMemory,
        system_prompt: `${avatarWithMemory.system_prompt}${emotionSystemExtra}`,
      }
    : avatarWithMemory;

  // Crisis escalation — only for cases that already carry active suicidal
  // ideation; every other session's prompt is unchanged.
  const crisisPrompt = injectCrisisEscalationIntoSystemPrompt(
    avatarForReply.system_prompt,
    {
      risk: snap?.clinical_core?.risk_profile ?? null,
      replyNumber: turnIndex + 1,
      previousReplies: historyRows
        .filter((m) => m.role === "assistant")
        .map((m) => m.content ?? ""),
    },
  );
  if (crisisPrompt !== avatarForReply.system_prompt) {
    avatarForReply = { ...avatarForReply, system_prompt: crisisPrompt };
  }

  // Mission 7 — Conversation Behaviour Engine (best-effort; never blocks reply).
  let behaviourPlan: ConversationBehaviourPlan | null = null;
  if (isConversationBehaviourEnabled()) {
    try {
      behaviourPlan = planConversationBehaviour({
        sessionId,
        turnIndex,
        userMessage: message,
        history: historyRows,
        difficulty: typed.clinical_snapshot?.difficulty_modifiers ?? null,
        disorderSlug: typed.clinical_snapshot?.primary_diagnosis?.slug ?? null,
        therapistInterrupted: params.therapistInterrupted,
        language: typed.language,
      });
    } catch (err) {
      console.warn("[sessions/message] CBE plan failed", {
        sessionId,
        error: err instanceof Error ? err.message : String(err),
      });
      behaviourPlan = null;
    }
  }

  // Stage 6 — PatientDecisionPlan façade (aggregates Adaptation + Emotion + CBE).
  // Soft-fail; never blocks reply. Does not replace CBE / Emotion / Adaptation.
  let decisionPlan: PatientDecisionPlan | null = null;
  try {
    const therapyProfile = snap
      ? normalizeTherapyResponseProfile(
          snap.therapy_reaction_rules,
          snap.therapy_modality,
        )
      : null;
    decisionPlan = decidePatientTurn({
      adaptation,
      emotion: emotionPayload
        ? {
            mode: emotionPayload.mode as
              | "engaged"
              | "guarded"
              | "withdrawn"
              | "activated"
              | "collapsed"
              | "warming",
            variables: emotionPayload.variables as {
              baseline_mood: number;
              current_mood: number;
              stress: number;
              fear: number;
              anger: number;
              hope: number;
              trust: number;
              rapport: number;
              fatigue: number;
              motivation: number;
            },
          }
        : null,
      behaviour: behaviourPlan,
      formulation: snap?.clinical_core?.formulation ?? null,
      therapyProfile,
      modality: snap?.therapy_modality ?? null,
      therapistMessage: message,
      disorderSlug,
      dissociationBias:
        /ptsd|trauma|cptsd/i.test(disorderSlug ?? "")
          ? "mild_detachment"
          : "none",
    });

    const decisionBlock = formatDecisionPlanForPrompt(decisionPlan);
    if (decisionBlock) {
      avatarForReply = {
        ...avatarForReply,
        system_prompt: `${avatarForReply.system_prompt}\n\n${decisionBlock}`,
      };
    }

    // Best-effort mind-state update (namespaced; never clobbers emotion/adaptation).
    if (caseInstanceId) {
      let mind =
        extractMindState(memoryRaw) ??
        carriedMind ??
        createMindState({
          caseInstanceId,
          formulation: snap?.clinical_core?.formulation ?? null,
        });
      mind = appendDecisionTrace(mind, {
        plan: decisionPlan,
        turn_index: turnIndex,
        at: new Date().toISOString(),
      });
      const alliance = therapyAllianceFromAdaptation(adaptation);
      if (
        decisionPlan.meta.therapy_bias?.includes("resist_advice") === false &&
        /\b(homework|thought record|worksheet)\b/i.test(message)
      ) {
        mind.adherence = recomputeTreatmentOverall(
          {
            ...mind.adherence,
            homework: updateHomeworkAdherence({
              current: mind.adherence.homework,
              allianceTrust: alliance.trust,
              conscientiousness:
                snap?.human_personality?.conscientiousness ?? 3,
              assignedThisTurn: true,
              delta: 1,
            }),
          },
          alliance,
        );
      }
      const patched = embedMindState(
        embedAdaptationInMemory(memoryRaw, adaptation),
        mind,
      );
      void supabase.from("case_memory").upsert({
        case_instance_id: caseInstanceId,
        memory: patched,
        updated_at: new Date().toISOString(),
      });
      // Keep BehaviorProfile construction referenced for observability.
      void buildBehaviorProfile({
        plan: decisionPlan,
        behaviour: behaviourPlan,
        patternTags: [],
        engagement: alliance.engagement,
      });
    }
  } catch (err) {
    console.warn("[sessions/message] decision plan soft-fail", {
      sessionId,
      error: err instanceof Error ? err.message : String(err),
    });
    decisionPlan = null;
  }

  // Mission 10 — Humanization Layer (subtle realism only; never blocks reply).
  let humanization: HumanizationTurn = null;
  try {
    let caseMemory: Record<string, unknown> | null = null;
    if (typed.case_instance_id) {
      const { data: memRow } = await supabase
        .from("case_memory")
        .select("memory")
        .eq("case_instance_id", typed.case_instance_id)
        .maybeSingle();
      if (memRow?.memory && typeof memRow.memory === "object") {
        caseMemory = memRow.memory as Record<string, unknown>;
      }
    }

    const maxDur = typed.max_duration_sec ?? MAX_SESSION_SECONDS;
    const elapsedSeconds = Math.max(
      0,
      Math.floor((Date.now() - new Date(typed.started_at).getTime()) / 1000),
    );

    humanization = buildHumanizationTurn({
      sessionId,
      caseSnapshot: typed.clinical_snapshot ?? null,
      clinicalCore: typed.clinical_snapshot?.clinical_core ?? null,
      history: historyRows,
      userMessage: message,
      sessionLanguage: typed.language ?? "en",
      elapsedSeconds,
      maxDurationSec: maxDur,
      caseMemory,
    });

    if (humanization) {
      avatarForReply = {
        ...avatarForReply,
        system_prompt: `${avatarForReply.system_prompt}\n\n${humanization.prompt_cue}`,
        per_turn_reinforcement: [
          avatarForReply.per_turn_reinforcement?.trim(),
          humanization.per_turn_cue,
        ]
          .filter(Boolean)
          .join("\n"),
      };
    }
  } catch (err) {
    console.warn("[sessions/message] humanization soft-fail", {
      sessionId,
      error: err instanceof Error ? err.message : String(err),
    });
    humanization = null;
  }

  return {
    ok: true,
    turn: {
      sessionId,
      userId: user.id,
      message,
      therapistInterrupted: params.therapistInterrupted,
      supabase,
      session: typed,
      resolved,
      avatarForReply,
      historyRows,
      turnIndex,
      userMsg: userMsg as SessionMessage,
      emotionPayload,
      behaviourPlan,
      decisionPlan,
      humanization,
    },
  };
}

/* ───────────────────────── generation + canonical gate ───────────────────────── */

/** Which pass of the canonical gate a draft belongs to. */
export type DraftAttempt = "initial" | "regeneration";

/** Drafting function the transport supplies (blocking or streaming). */
export type ReplyDraftGenerator = (input: {
  avatar: ResolvedAvatar;
  history: Pick<SessionMessage, "role" | "content">[];
  userMessage: string;
  behaviourReinforcement: string | null;
  attempt: DraftAttempt;
}) => Promise<PatientReplyResult>;

export type ValidatedReplyHooks = {
  /** A draft was rejected by the canonical gate (PHI-safe verdict only). */
  onRejected?: (
    verdict: Extract<ReplyValidationResult, { ok: false }>,
    attempt: DraftAttempt,
  ) => void;
  /** Both drafts were rejected; the persona fallback replaces them. */
  onPersonaFallback?: () => void;
};

/** Correction cue for the single regeneration. Shared verbatim by both routes. */
export function canonicalCorrectionCue(
  reason: Extract<ReplyValidationResult, { ok: false }>["reason"],
): string {
  return reason === "age_contradiction" ||
    reason === "medication_contradiction"
    ? "Your previous draft accepted a clinical fact the therapist stated that contradicts your authored history. Correct the therapist plainly, restate YOUR fact, and carry on. Never invent a new fact, and never take on a family member's medication."
    : "Your previous draft was empty or punctuation-only. Reply with at least one real spoken word as this patient. Do not answer with ellipsis alone.";
}

/**
 * Authored facts the reply is checked against.
 *
 * Facts come from the resolved core first and the authored slug table
 * second, so an avatar whose snapshot dropped case_file is still enforced.
 * The therapist turn is passed because the recorded live failure was
 * anaphoric ("آه، باخده") — the drug appears only in the therapist's words.
 */
export function buildCanonicalFacts(
  turn: Pick<PreparedClinicalTurn, "avatarForReply" | "session" | "message">,
): CanonicalReplyFacts {
  const { avatarForReply } = turn;
  const avatarSlug = turn.session.avatars?.slug ?? null;
  return {
    age: avatarForReply.age,
    medications: resolveMedicationFacts(
      resolveCaseFile(
        avatarForReply.clinical_core ?? { age: avatarForReply.age } as never,
        avatarSlug,
      )?.medications,
      avatarSlug,
    ),
    locale: avatarForReply.locale,
    therapistMessage: turn.message,
  };
}

/**
 * Draft → canonical-fact + contentless gate → at most ONE regeneration →
 * persona fallback. Never persist or hand to TTS until this returns.
 *
 * Throws whatever the drafting function throws (the classic route maps that
 * to 502; the stream route maps an abort to `interrupted`).
 */
export async function generateValidatedReply(
  turn: Pick<
    PreparedClinicalTurn,
    | "sessionId"
    | "message"
    | "avatarForReply"
    | "historyRows"
    | "behaviourPlan"
    | "session"
  >,
  generate: ReplyDraftGenerator,
  hooks: ValidatedReplyHooks = {},
): Promise<PatientReplyResult> {
  const { sessionId, message, avatarForReply, historyRows, behaviourPlan } =
    turn;
  let replyMeta: PatientReplyResult;

  // Guaranteed silence / interruption stall when the engine short-circuits.
  if (behaviourPlan?.directReply?.trim()) {
    replyMeta = {
      text: behaviourPlan.directReply.trim(),
      aiSource: "cbe_direct",
    };
    console.info("[sessions/message] cbe_direct_reply", {
      sessionId,
      primary: behaviourPlan.primary,
      gate: behaviourPlan.disclosureGate,
    });
  } else {
    replyMeta = await generate({
      avatar: avatarForReply,
      history: historyRows,
      userMessage: message,
      behaviourReinforcement: behaviourPlan?.promptBlock ?? null,
      attempt: "initial",
    });
  }

  // Canonical-fact + contentless gate. At most ONE regeneration.
  // Never persist or hand to TTS until a valid utterance exists.
  const canonicalFacts = buildCanonicalFacts(turn);
  const firstVerdict = validatePatientReply(replyMeta.text, canonicalFacts);
  if (!firstVerdict.ok) {
    console.warn("[sessions/message] reply rejected by canonical gate", {
      sessionId,
      reason: firstVerdict.reason,
      // PHI-safe: fact id / numeric mismatch only, never transcript content.
      detail: firstVerdict.detail ?? null,
      aiSource: replyMeta.aiSource,
    });
    hooks.onRejected?.(firstVerdict, "initial");
    replyMeta = await generate({
      avatar: avatarForReply,
      history: historyRows,
      userMessage: message,
      behaviourReinforcement: [
        behaviourPlan?.promptBlock ?? null,
        canonicalCorrectionCue(firstVerdict.reason),
      ]
        .filter(Boolean)
        .join("\n\n"),
      attempt: "regeneration",
    });
    const secondVerdict = validatePatientReply(replyMeta.text, canonicalFacts);
    if (!secondVerdict.ok) {
      console.error("[sessions/message] reply rejected twice", {
        sessionId,
        reason: secondVerdict.reason,
        detail: secondVerdict.detail ?? null,
      });
      hooks.onRejected?.(secondVerdict, "regeneration");
      hooks.onPersonaFallback?.();
      // Second failure → persona fallback (already a lexical string).
      const fallbacks =
        avatarForReply.fallback_replies?.length > 0
          ? avatarForReply.fallback_replies
          : ["Mm.", "آه."];
      const idx =
        Math.abs(
          message.split("").reduce((a, c) => a + c.charCodeAt(0), 0),
        ) % fallbacks.length;
      replyMeta = {
        text: fallbacks[idx]!,
        aiSource: "persona_fallback",
        errorKind: replyMeta.errorKind,
      };
    }
  }
  return replyMeta;
}

/** PHI-safe per-turn observability line (no transcript content). */
export function logAssistantReply(
  turn: PreparedClinicalTurn,
  replyMeta: PatientReplyResult,
  transport: "classic" | "stream",
): void {
  console.info("[sessions/message] assistant reply", {
    sessionId: turn.sessionId,
    transport,
    language: turn.session.language,
    aiSource: replyMeta.aiSource,
    aiModel: replyMeta.model ?? null,
    errorKind: replyMeta.errorKind ?? null,
    emotionMode: turn.emotionPayload?.mode ?? null,
    cbePrimary: turn.behaviourPlan?.primary ?? null,
    cbeGate: turn.behaviourPlan?.disclosureGate ?? null,
    cbeRapport: turn.behaviourPlan?.rapport ?? null,
    decisionSpeak: turn.decisionPlan?.speak ?? null,
    decisionAct: turn.decisionPlan?.act ?? null,
    humanizationBehaviors: turn.humanization?.behaviors ?? null,
  });
}

/* ───────────────────────────── persistence ───────────────────────────── */

/**
 * Persist the final validated reply exactly once through the live 4-argument
 * insert_assistant_message contract, linked to the originating therapist
 * message. Only a validated reply may reach this function — never a partial
 * stream.
 */
export async function persistAssistantReply(
  turn: Pick<PreparedClinicalTurn, "supabase" | "sessionId" | "userMsg">,
  content: string,
): Promise<
  | { ok: true; assistantMsg: SessionMessage }
  | { ok: false; error: { message?: string } | null }
> {
  const { supabase, sessionId, userMsg } = turn;
  const { data: assistantMsg, error: assistantError } = await (async () => {
    const prepared = prepareMessageRpc(supabase, {
      sessionId,
      content,
      role: "assistant",
      userMessageId: String(userMsg.id),
    });
    if (!prepared.ok) {
      return {
        data: null,
        error: { message: prepared.error },
      };
    }
    return prepared.client.rpc("insert_assistant_message", prepared.args);
  })();

  if (assistantError || !assistantMsg) {
    console.error("[sessions/message] assistant message save failed", {
      sessionId,
      error: assistantError?.message,
    });
    return { ok: false, error: assistantError ?? null };
  }
  return { ok: true, assistantMsg: assistantMsg as SessionMessage };
}

/* ───────────────────────────── response shape ───────────────────────────── */

export function humanizationHintsFor(turn: Pick<PreparedClinicalTurn, "humanization">) {
  return turn.humanization ? toClientHints(turn.humanization) : null;
}

/**
 * The /message JSON body and observability headers. The stream route reuses
 * it for its `done` event so both transports report identical metadata.
 */
export function buildTurnResponse(
  turn: PreparedClinicalTurn,
  replyMeta: PatientReplyResult,
  assistantMsg: SessionMessage,
): { body: Record<string, unknown>; headers: Record<string, string> } {
  const { session: typed, resolved, behaviourPlan, decisionPlan, humanization } =
    turn;
  const emotionPayload = turn.emotionPayload;
  const humanizationHints = humanizationHintsFor(turn);

  return {
    body: {
      userMessage: turn.userMsg,
      assistantMessage: assistantMsg,
      remainingSeconds: remainingSeconds(
        typed.started_at,
        typed.max_duration_sec,
      ),
      // Additive: session language used for this turn (AR/EN pipeline).
      locale: typed.language ?? resolved.language,
      // Additive observability — never hide persona fallback usage.
      aiSource: replyMeta.aiSource,
      aiModel: replyMeta.model ?? null,
      aiErrorKind: replyMeta.errorKind ?? null,
      // Additive Emotion Engine packet (Mission 2) — null when soft-failed.
      emotion: emotionPayload,
      // Mission 7 CBE — additive; never clinical ground truth for the trainee UI.
      cbeEnabled: Boolean(behaviourPlan),
      cbePrimary: behaviourPlan?.primary ?? null,
      cbeDisclosureGate: behaviourPlan?.disclosureGate ?? null,
      cbeRapport: behaviourPlan?.rapport ?? null,
      // Stage 6 DecisionPlan — additive observability only.
      decisionSpeak: decisionPlan?.speak ?? null,
      decisionAct: decisionPlan?.act ?? null,
      decisionDisclosure: decisionPlan?.disclosure ?? null,
      decisionCognitiveMove: decisionPlan?.cognitive_move ?? null,
      // Mission 10 — Humanization Engine (additive; clients may ignore).
      humanizationEnabled: Boolean(humanization),
      humanization: humanizationHints,
      voiceHints: humanizationHints?.voiceHints ?? null,
    },
    headers: {
      "X-AI-Source": replyMeta.aiSource,
      ...(replyMeta.model ? { "X-AI-Model": replyMeta.model } : {}),
      ...(replyMeta.errorKind
        ? { "X-AI-Error-Kind": replyMeta.errorKind }
        : {}),
      ...(behaviourPlan?.primary
        ? { "X-CBE-Primary": behaviourPlan.primary }
        : {}),
      ...(decisionPlan?.speak ? { "X-CI-Speak": decisionPlan.speak } : {}),
      ...(decisionPlan?.act
        ? { "X-CI-Act": String(decisionPlan.act) }
        : {}),
      ...(humanization
        ? { "X-Humanization": humanization.behaviors.join(",") }
        : {}),
    },
  };
}
