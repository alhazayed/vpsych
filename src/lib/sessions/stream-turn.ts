/**
 * Realtime streamed patient turn (transport for /api/sessions/:id/message/stream).
 *
 * Runs AFTER `prepareClinicalTurn` — the same cognition the classic route
 * uses — and drives the shared `generateValidatedReply` gate with a streaming
 * drafting function, so tokens reach the client as the model produces them.
 *
 * Event contract (every event carries a monotonically increasing sequence):
 *   started       therapist message persisted; voice hints for TTS
 *   token         provisional text delta for the current draft attempt
 *   sentence      a sentence the client may speak (progressive TTS)
 *   regenerating  the current draft was discarded (canonical rejection,
 *                 provider reset, stream failure, persona fallback) — the
 *                 client must drop its text AND any audio of earlier attempts
 *   interrupted   generation aborted (barge-in / disconnect); nothing persisted
 *   done          validated reply persisted; full /message response body
 *   error         turn failed; `assistantPersisted` is always false
 *
 * Invariants:
 *   - Partial text is presentation only. Only the validated final reply is
 *     persisted, exactly once, via `persistAssistantReply`.
 *   - `done` is emitted only after validation AND persistence succeed.
 *   - After abort no further token / sentence events are emitted, no
 *     failover runs, and nothing is persisted.
 *   - If streaming fails (before or after partial output), the partial draft
 *     is discarded and the classic non-streaming generator — the one
 *     /message uses — produces the draft that the canonical gate validates.
 */

import {
  generatePatientReplyDetailed,
  generatePatientReplyStream,
  type PatientReplyResult,
  type PatientReplyStreamResult,
} from "@/lib/ai/patient-agent";
import { clientSafeError } from "@/lib/api-errors";
import { createSentenceSegmenter } from "@/lib/realtime/sentence-segmenter";
import {
  buildCanonicalFacts,
  buildTurnResponse,
  generateValidatedReply,
  humanizationHintsFor,
  logAssistantReply,
  persistAssistantReply,
  type DraftAttempt,
  type PreparedClinicalTurn,
  type ReplyDraftGenerator,
} from "@/lib/sessions/clinical-turn";
import {
  createSpeechReleaseGate,
  type SpeechReleaseGate,
} from "@/lib/sessions/speech-release-gate";
import type { CanonicalReplyFacts } from "@/lib/ai/reply-validation";

export type StreamTurnEventType =
  | "started"
  | "token"
  | "sentence"
  | "regenerating"
  | "interrupted"
  | "done"
  | "error";

export type StreamTurnEmit = (
  type: StreamTurnEventType,
  payload: Record<string, unknown>,
) => void;

export type RegenerationReason =
  | "canonical_rejected"
  | "provider_reset"
  | "stream_failed"
  | "persona_fallback"
  | "final_text";

/** Raised inside drafting when the turn's signal aborts. Never persisted. */
export class TurnInterruptedError extends Error {
  constructor() {
    super("turn interrupted");
    this.name = "TurnInterruptedError";
  }
}

type StreamDraftFn = (input: {
  avatar: PreparedClinicalTurn["avatarForReply"];
  history: PreparedClinicalTurn["historyRows"];
  userMessage: string;
  behaviourReinforcement: string | null;
  onToken: (token: string, fullText: string) => void;
  onReset: () => void;
  signal: AbortSignal;
  personaFallback: false;
}) => Promise<PatientReplyStreamResult>;

export type StreamTurnDeps = {
  streamDraft: StreamDraftFn;
  classicDraft: ReplyDraftGenerator;
  persist: (
    turn: PreparedClinicalTurn,
    content: string,
  ) => ReturnType<typeof persistAssistantReply>;
};

const defaultDeps: StreamTurnDeps = {
  streamDraft: (input) => generatePatientReplyStream(input),
  classicDraft: ({ avatar, history, userMessage, behaviourReinforcement }) =>
    generatePatientReplyDetailed({
      avatar,
      history,
      userMessage,
      behaviourReinforcement,
    }),
  persist: (turn, content) => persistAssistantReply(turn, content),
};

export type StreamTurnOutcome = "done" | "interrupted" | "error";

/**
 * Presentation bookkeeping for draft attempts: provisional tokens, sentence
 * segmentation, and the speech release gate. Owns no clinical decision.
 */
function createAttemptPresenter(params: {
  emit: StreamTurnEmit;
  facts: CanonicalReplyFacts;
  signal: AbortSignal;
}) {
  const { emit, facts, signal } = params;
  let attempt = 0;
  let text = "";
  let sentenceIndex = 0;
  let segmenter = createSentenceSegmenter();
  let gate: SpeechReleaseGate = createSpeechReleaseGate(facts);

  const emitSentence = (sentence: string, validated: boolean) => {
    emit("sentence", {
      attempt,
      index: sentenceIndex++,
      text: sentence,
      validated,
    });
  };

  const beginAttempt = (reason: RegenerationReason | "initial") => {
    if (attempt === 0) {
      attempt = 1;
    } else if (text !== "" || sentenceIndex > 0) {
      attempt += 1;
      emit("regenerating", { attempt, reason });
    }
    text = "";
    sentenceIndex = 0;
    segmenter = createSentenceSegmenter();
    gate = createSpeechReleaseGate(facts);
  };

  const token = (delta: string) => {
    if (signal.aborted || !delta) return;
    if (attempt === 0) attempt = 1;
    text += delta;
    emit("token", { attempt, token: delta, text });
    for (const sentence of segmenter.push(delta)) {
      for (const released of gate.offer(sentence)) {
        emitSentence(released, false);
      }
    }
  };

  /**
   * Called only after the final reply is validated AND persisted. Speaks the
   * held remainder of the final attempt, or — when the final text is not the
   * text that streamed (direct reply, persona fallback) — replaces the draft
   * with the final text.
   */
  const finalize = (finalText: string, reason: RegenerationReason) => {
    if (signal.aborted) return;
    if (attempt === 0) beginAttempt("initial");
    if (text !== "" && text.trim() === finalText.trim()) {
      // Held sentences first (they precede the tail), then the tail; all of
      // it is validated now, so nothing stays gated.
      const tail = segmenter.flush();
      for (const held of gate.drain()) emitSentence(held, true);
      for (const sentence of tail) emitSentence(sentence, true);
      return;
    }
    beginAttempt(reason);
    text = finalText;
    emit("token", { attempt, token: finalText, text: finalText });
    for (const sentence of segmenter.push(finalText)) emitSentence(sentence, true);
    for (const sentence of segmenter.flush()) emitSentence(sentence, true);
  };

  return {
    beginAttempt,
    token,
    finalize,
    attempt: () => attempt,
  };
}

/**
 * Run one streamed clinical turn for an already-prepared turn. Never throws;
 * the outcome is also communicated through exactly one terminal event
 * (`done`, `interrupted`, or `error`).
 */
export async function runStreamingClinicalTurn(params: {
  turn: PreparedClinicalTurn;
  signal: AbortSignal;
  emit: StreamTurnEmit;
  deps?: Partial<StreamTurnDeps>;
}): Promise<StreamTurnOutcome> {
  const { turn, signal, emit } = params;
  const deps: StreamTurnDeps = { ...defaultDeps, ...params.deps };
  const humanizationHints = humanizationHintsFor(turn);

  emit("started", {
    userMessage: turn.userMsg,
    locale: turn.session.language ?? turn.resolved.language,
    voiceHints: humanizationHints?.voiceHints ?? null,
    humanizationEnabled: Boolean(turn.humanization),
  });

  const presenter = createAttemptPresenter({
    emit,
    facts: buildCanonicalFacts(turn),
    signal,
  });

  const interrupted = (stage: string): StreamTurnOutcome => {
    console.info("[sessions/message/stream] turn interrupted", {
      sessionId: turn.sessionId,
      stage,
    });
    emit("interrupted", { reason: "aborted", stage, assistantPersisted: false });
    return "interrupted";
  };

  const streamingDraft: ReplyDraftGenerator = async (input) => {
    presenter.beginAttempt(
      input.attempt === "regeneration" ? "canonical_rejected" : "initial",
    );
    if (signal.aborted) throw new TurnInterruptedError();
    try {
      const result = await deps.streamDraft({
        avatar: input.avatar,
        history: input.history,
        userMessage: input.userMessage,
        behaviourReinforcement: input.behaviourReinforcement,
        onToken: (delta) => presenter.token(delta),
        onReset: () => presenter.beginAttempt("provider_reset"),
        signal,
        personaFallback: false,
      });
      if (result.interrupted || signal.aborted) {
        throw new TurnInterruptedError();
      }
      return {
        text: result.text,
        aiSource: result.aiSource,
        model: result.model,
        errorKind: result.errorKind,
      };
    } catch (err) {
      if (err instanceof TurnInterruptedError || signal.aborted) {
        throw new TurnInterruptedError();
      }
      return classicAfterStreamFailure(input.attempt, err, input);
    }
  };

  const classicAfterStreamFailure = async (
    attempt: DraftAttempt,
    err: unknown,
    input: Parameters<ReplyDraftGenerator>[0],
  ): Promise<PatientReplyResult> => {
    // PHI-safe: error class only, never transcript or provider body.
    console.warn("[sessions/message/stream] stream draft failed; classic draft", {
      sessionId: turn.sessionId,
      attempt,
      error: err instanceof Error ? err.name : "unknown",
    });
    presenter.beginAttempt("stream_failed");
    const classic = await deps.classicDraft(input);
    if (signal.aborted) throw new TurnInterruptedError();
    presenter.token(classic.text);
    return classic;
  };

  let replyMeta: PatientReplyResult;
  try {
    replyMeta = await generateValidatedReply(turn, streamingDraft);
  } catch (err) {
    if (err instanceof TurnInterruptedError || signal.aborted) {
      return interrupted("generation");
    }
    console.error("[sessions/message] patient reply generation failed", {
      sessionId: turn.sessionId,
      language: turn.session.language,
      transport: "stream",
      error: err instanceof Error ? err.message : String(err),
    });
    emit("error", {
      message: "Failed to generate patient reply",
      status: 502,
      assistantPersisted: false,
    });
    return "error";
  }

  // Barge-in after validation but before persistence: the therapist cut the
  // patient off, so the reply is not persisted (same as mid-stream abort).
  if (signal.aborted) return interrupted("pre_persist");

  logAssistantReply(turn, replyMeta, "stream");

  const saved = await deps.persist(turn, replyMeta.text);
  if (!saved.ok) {
    emit("error", {
      message: clientSafeError("Failed to save reply", saved.error),
      status: 500,
      assistantPersisted: false,
    });
    return "error";
  }

  presenter.finalize(
    replyMeta.text,
    replyMeta.aiSource === "persona_fallback" ? "persona_fallback" : "final_text",
  );

  const response = buildTurnResponse(turn, replyMeta, saved.assistantMsg);
  emit("done", {
    ...response.body,
    attempt: presenter.attempt(),
    streamed: true,
    interrupted: false,
  });
  return "done";
}
