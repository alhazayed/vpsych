import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { messageRpcClient } from "@/lib/supabase/admin";
import { generatePatientReplyDetailed } from "@/lib/ai/patient-agent";
import { resolveAvatar } from "@/lib/avatars/resolve";
import {
  createAdaptationState,
  loadAdaptationState,
  processTherapistTurn,
  saveAdaptationState,
} from "@/lib/adaptation";
import { prepareMemoryForTurn } from "@/lib/patient-memory";
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
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import {
  expressionPromptBlock,
  processEmotionTurn,
} from "@/lib/emotion";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import type { Avatar, SessionMessage, TherapySession } from "@/lib/types";
import { MAX_SESSION_SECONDS } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id: sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`msg:${user.id}`, 120, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const body = (await request.json()) as {
    message?: string;
    /** True when the therapist barge-in / cut off the prior patient turn. */
    therapistInterrupted?: boolean;
  };
  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }
  if (message.length > 4000) {
    return NextResponse.json(
      { error: "message too long (max 4000 characters)" },
      { status: 400 },
    );
  }

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("*, avatars(*, voice_profile:voice_profiles(*))")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const typed = session as TherapySession & { avatars: Avatar };
  if (typed.therapist_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (typed.status !== "active") {
    return NextResponse.json({ error: "Session is not active" }, { status: 409 });
  }

  const remaining = remainingSeconds(typed.started_at, typed.max_duration_sec);
  if (remaining <= 0) {
    await expireStaleSession(supabase, typed);
    return NextResponse.json(
      { error: "Session time expired", expired: true },
      { status: 409 },
    );
  }

  // Mission 8 — Patient Adaptation (rapport / trust / withdrawal / disclosure).
  // Soft-fail: never block the patient reply path.
  const caseInstanceId = typed.case_instance_id ?? null;
  let adaptationBlock: string | null = null;
  try {
    const loaded = await loadAdaptationState(supabase, caseInstanceId);
    let adaptation =
      loaded.state ??
      createAdaptationState({
        caseInstanceId,
        therapistId: user.id,
      });
    const adapted = processTherapistTurn(adaptation, message);
    adaptation = adapted.state;
    adaptationBlock = adapted.expressionBlock;
    void saveAdaptationState(supabase, caseInstanceId, adaptation, loaded.raw);
  } catch (err) {
    console.warn("[sessions/message] adaptation engine soft-fail", {
      sessionId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Case Engine: diagnosis from immutable session snapshot when present.
  const resolved = resolveAvatar(typed.avatars, typed.language, {
    caseSnapshot: typed.clinical_snapshot,
    adaptationBlock,
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
  const avatarWithMemory = {
    ...resolved,
    system_prompt: memoryCtx.systemPrompt,
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
    return NextResponse.json(
      { error: clientSafeError("Failed to save message", userMsgError) },
      { status: 500 },
    );
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

  // Prefer service role; fall back to authenticated client. RPC bodies enforce
  // ownership, active status, and "assistant after user" turn order.
  const writer = messageRpcClient(supabase);

  // Emotion Engine (Mission 2) — best-effort; never blocks the reply path.
  const snap = typed.clinical_snapshot as CaseInstanceSnapshot | null | undefined;
  const disorderSlug = snap?.primary_diagnosis?.slug ?? null;
  const elapsedSec =
    typed.max_duration_sec -
    remainingSeconds(typed.started_at, typed.max_duration_sec);

  let emotionPayload: {
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
  } | null = null;

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
        therapistInterrupted: Boolean(body.therapistInterrupted),
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

  // Mission 10 — Humanization Layer (presentation-only; never blocks reply).
  let humanization: ReturnType<typeof buildHumanizationTurn> = null;
  try {
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
      // Patient Memory owns facts — humanization only learns if any were retrieved.
      hasPriorSessionMemory: (memoryCtx.retrieval?.hits?.length ?? 0) > 0,
      // Mission 2 owns affect — map delivery colour/timing from it when present.
      externalEmotion: emotionPayload
        ? {
            mode: emotionPayload.mode,
            facial_affect: emotionPayload.expression.facial_affect,
            openness: emotionPayload.expression.openness,
            hesitation_ms: emotionPayload.expression.hesitation_ms,
            variables: {
              current_mood: emotionPayload.variables.current_mood,
              trust: emotionPayload.variables.trust,
              anger: emotionPayload.variables.anger,
              hope: emotionPayload.variables.hope,
              fatigue: emotionPayload.variables.fatigue,
              fear: emotionPayload.variables.fear,
            },
          }
        : null,
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

  let replyMeta: Awaited<ReturnType<typeof generatePatientReplyDetailed>>;
  try {
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
      replyMeta = await generatePatientReplyDetailed({
        avatar: avatarForReply,
        history: historyRows,
        userMessage: message,
        behaviourReinforcement: behaviourPlan?.promptBlock ?? null,
      });
    }
  } catch (err) {
    console.error("[sessions/message] patient reply generation failed", {
      sessionId,
      language: typed.language,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to generate patient reply" },
      { status: 502 },
    );
  }

  console.info("[sessions/message] assistant reply", {
    sessionId,
    language: typed.language,
    aiSource: replyMeta.aiSource,
    aiModel: replyMeta.model ?? null,
    errorKind: replyMeta.errorKind ?? null,
    emotionMode: emotionPayload?.mode ?? null,
    cbePrimary: behaviourPlan?.primary ?? null,
    cbeGate: behaviourPlan?.disclosureGate ?? null,
    cbeRapport: behaviourPlan?.rapport ?? null,
    humanizationBehaviors: humanization?.behaviors ?? null,
  });

  const { data: assistantMsg, error: assistantError } = await writer.rpc(
    "insert_assistant_message",
    {
      p_session_id: sessionId,
      p_content: replyMeta.text,
    },
  );

  if (assistantError || !assistantMsg) {
    console.error("[sessions/message] assistant message save failed", {
      sessionId,
      error: assistantError?.message,
    });
    return NextResponse.json(
      { error: clientSafeError("Failed to save reply", assistantError) },
      { status: 500 },
    );
  }

  const humanizationHints = humanization ? toClientHints(humanization) : null;

  return NextResponse.json(
    {
      userMessage: userMsg,
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
      // Mission 10 — Humanization Engine (additive; clients may ignore).
      humanizationEnabled: Boolean(humanization),
      humanization: humanizationHints,
      voiceHints: humanizationHints?.voiceHints ?? null,
    },
    {
      headers: {
        "X-AI-Source": replyMeta.aiSource,
        ...(replyMeta.model ? { "X-AI-Model": replyMeta.model } : {}),
        ...(replyMeta.errorKind
          ? { "X-AI-Error-Kind": replyMeta.errorKind }
          : {}),
        ...(behaviourPlan?.primary
          ? { "X-CBE-Primary": behaviourPlan.primary }
          : {}),
        ...(humanization
          ? { "X-Humanization": humanization.behaviors.join(",") }
          : {}),
      },
    },
  );
}
