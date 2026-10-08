import { generateText, streamText } from "ai";
import { openAIService } from "@/lib/ai/openai";
import {
  isOpenAIServiceError,
  openaiErrorKind,
  type OpenAIErrorKind,
} from "@/lib/ai/openai/errors";
import {
  gatewayModelId,
  hasAnyAiKey,
  hasGatewayKey,
  openAiFallbackChatModel,
  preferOpenAiSdk,
  type AiSource,
} from "@/lib/ai/provider";
import type { ResolvedAvatar, SessionMessage } from "@/lib/types";
import { PATIENT_REPLY_TIMEOUT_MS } from "@/lib/ai/time-budget";

const DEFAULT_FALLBACK_REPLIES = [
  "I'm not sure how to answer that… could you say a bit more?",
  "Yeah… I've been feeling that way a lot lately.",
  "Hmm. I guess I haven't thought about it like that.",
  "Sorry, I zoned out for a second. What were you asking?",
  "It's hard to put into words, but I'll try.",
];

export type PatientReplyResult = {
  text: string;
  /** gpt | gateway | persona_fallback | cbe_direct — always set; never omit on fallback. */
  aiSource: AiSource;
  model?: string;
  /** Present when a model path failed before the returned source. */
  errorKind?: OpenAIErrorKind;
};

export type PatientReplyStreamHandlers = {
  onToken?: (token: string, fullText: string) => void;
  signal?: AbortSignal;
};

export type PatientReplyStreamResult = PatientReplyResult & {
  interrupted: boolean;
};

function logPatientAgent(
  event: string,
  details: Record<string, unknown>,
): void {
  console.warn("[patient-agent]", { event, ...details });
}

function isRateLimitedOrQuota(err: unknown): boolean {
  const kind = openaiErrorKind(err);
  if (kind === "rate_limit" || kind === "insufficient_quota") return true;
  if (isOpenAIServiceError(err) && err.status === 429) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /rate limit|429|too many requests|insufficient.?quota/i.test(msg);
}

function errorDetails(err: unknown) {
  if (isOpenAIServiceError(err)) {
    return {
      kind: err.kind,
      code: err.code,
      status: err.status,
      providerCode: err.providerCode ?? null,
      message: err.message,
      retryable: err.retryable,
    };
  }
  return {
    kind: openaiErrorKind(err),
    message: err instanceof Error ? err.message : String(err),
  };
}

/**
 * Generate a patient reply using the multilingual prompt engine output.
 * Call sites pass a ResolvedAvatar (from resolveAvatar + session.language).
 * `generatePatientReply` keeps the string return for backward compatibility.
 */
export async function generatePatientReply(params: {
  avatar: Pick<
    ResolvedAvatar,
    | "name"
    | "disorder"
    | "system_prompt"
    | "fallback_replies"
    | "per_turn_reinforcement"
  >;
  history: Pick<SessionMessage, "role" | "content">[];
  userMessage: string;
}): Promise<string> {
  const result = await generatePatientReplyDetailed(params);
  return result.text;
}

/** Same as generatePatientReply but exposes provider/source for observability. */
export async function generatePatientReplyDetailed(params: {
  avatar: Pick<
    ResolvedAvatar,
    | "name"
    | "disorder"
    | "system_prompt"
    | "fallback_replies"
    | "per_turn_reinforcement"
  >;
  history: Pick<SessionMessage, "role" | "content">[];
  userMessage: string;
  /**
   * Optional Conversation Behaviour Engine turn brief (Mission 7).
   * Merged into per-turn reinforcement so the patient does not instantly
   * over-disclose. Never persisted on the user message row.
   */
  behaviourReinforcement?: string | null;
}): Promise<PatientReplyResult> {
  const { avatar, history, userMessage, behaviourReinforcement } = params;
  const fallbacks =
    avatar.fallback_replies?.length > 0
      ? avatar.fallback_replies
      : DEFAULT_FALLBACK_REPLIES;

  const pickFallback = (errorKind?: OpenAIErrorKind): PatientReplyResult => {
    const idx =
      Math.abs(
        userMessage.split("").reduce((a, c) => a + c.charCodeAt(0), 0),
      ) % fallbacks.length;
    logPatientAgent("persona_fallback", {
      aiSource: "persona_fallback",
      errorKind: errorKind ?? null,
      avatar: avatar.name,
    });
    return {
      text: fallbacks[idx]!,
      aiSource: "persona_fallback",
      errorKind,
    };
  };

  if (!hasAnyAiKey()) {
    logPatientAgent("no_ai_key", { aiSource: "persona_fallback" });
    return pickFallback();
  }

  const prior = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-20)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  // Per-turn reinforcement (+ optional CBE block) is appended to the therapist
  // turn only — never stored on session_messages.
  const reinforcementParts = [
    avatar.per_turn_reinforcement?.trim(),
    behaviourReinforcement?.trim(),
  ].filter(Boolean);
  const reinforced =
    reinforcementParts.length > 0
      ? `${userMessage}\n\n${reinforcementParts.join("\n\n")}`
      : userMessage;

  const viaGateway = async (
    priorErrorKind?: OpenAIErrorKind,
  ): Promise<PatientReplyResult> => {
    const messages = [...prior, { role: "user" as const, content: reinforced }];
    const model = gatewayModelId();
    const { text } = await generateText({
      model,
      system: avatar.system_prompt,
      messages,
      temperature: 0.85,
      maxOutputTokens: 220,
      abortSignal: AbortSignal.timeout(PATIENT_REPLY_TIMEOUT_MS),
    });
    const trimmed = text.trim();
    if (!trimmed) return pickFallback(priorErrorKind);
    // Soft contentless check — hard gate + single regen lives in the message
    // route so TTS never sees invalid text. Empty string already falls back.
    logPatientAgent("reply_ok", { aiSource: "gateway", model });
    return {
      text: trimmed,
      aiSource: "gateway",
      model,
      errorKind: priorErrorKind,
    };
  };

  const viaOpenAi = async (
    model?: string,
    priorErrorKind?: OpenAIErrorKind,
  ): Promise<PatientReplyResult> => {
    const result = await openAIService.chat({
      messages: [
        { role: "system", content: avatar.system_prompt },
        ...prior,
        { role: "user", content: reinforced },
      ],
      temperature: 0.85,
      // Headroom so reasoning-model overhead doesn't starve the visible reply.
      maxCompletionTokens: 512,
      model,
      timeoutMs: PATIENT_REPLY_TIMEOUT_MS,
    });
    const text = result.text.trim();
    if (!text) return pickFallback(priorErrorKind);
    logPatientAgent("reply_ok", {
      aiSource: "gpt",
      model: result.model,
    });
    return {
      text,
      aiSource: "gpt",
      model: result.model,
      errorKind: priorErrorKind,
    };
  };

  // Prefer OpenAI GPT; on 429/quota try gpt-4o-mini (often separate quota),
  // then AI Gateway when configured, then persona fallback (always visible).
  if (preferOpenAiSdk()) {
    try {
      return await viaOpenAi();
    } catch (err) {
      const kind = openaiErrorKind(err);
      logPatientAgent("openai_chat_failed", {
        ...errorDetails(err),
        next: isRateLimitedOrQuota(err)
          ? openAiFallbackChatModel()
          : hasGatewayKey()
            ? "gateway"
            : "persona_fallback",
      });

      if (isRateLimitedOrQuota(err)) {
        const fallbackModel = openAiFallbackChatModel();
        try {
          logPatientAgent("openai_model_failover", {
            from: "primary",
            to: fallbackModel,
            reason: kind,
          });
          return await viaOpenAi(fallbackModel, kind);
        } catch (miniErr) {
          logPatientAgent("openai_fallback_model_failed", {
            model: fallbackModel,
            ...errorDetails(miniErr),
          });
        }
      }

      if (hasGatewayKey()) {
        try {
          logPatientAgent("gateway_failover", { reason: kind });
          return await viaGateway(kind);
        } catch (gatewayErr) {
          logPatientAgent("gateway_failed", {
            ...errorDetails(gatewayErr),
            next: "persona_fallback",
          });
          return pickFallback(kind);
        }
      }
      return pickFallback(kind);
    }
  }

  try {
    return await viaGateway();
  } catch (err) {
    const kind = openaiErrorKind(err);
    logPatientAgent("gateway_failed", {
      ...errorDetails(err),
      next: "persona_fallback",
    });
    return pickFallback(kind);
  }
}

/**
 * Thrown by `generatePatientReplyStream` when `personaFallback: false` and no
 * model produced a streamed reply. The caller decides what replaces it (the
 * realtime route falls back to the classic non-streaming generator), so a
 * stream failure is never silently presented as a model reply.
 */
export class PatientStreamUnavailableError extends Error {
  readonly errorKind?: OpenAIErrorKind;
  constructor(message: string, errorKind?: OpenAIErrorKind) {
    super(message);
    this.name = "PatientStreamUnavailableError";
    this.errorKind = errorKind;
  }
}

/**
 * Stage 11 — streaming patient reply. Same prompt construction as
 * `generatePatientReplyDetailed`; tokens are presentation-only.
 * Cognition owners upstream are unchanged.
 *
 * Abort semantics: once `signal` aborts, generation stops, no provider
 * failover or persona fallback runs, and the result is `interrupted: true`
 * with whatever partial text had streamed. Callers must never persist it.
 *
 * `onReset` fires before a provider failover when tokens were already
 * emitted, so the caller can discard the abandoned partial text instead of
 * concatenating two providers' output.
 */
export async function generatePatientReplyStream(params: {
  avatar: Pick<
    ResolvedAvatar,
    | "name"
    | "disorder"
    | "system_prompt"
    | "fallback_replies"
    | "per_turn_reinforcement"
  >;
  history: Pick<SessionMessage, "role" | "content">[];
  userMessage: string;
  behaviourReinforcement?: string | null;
  onToken?: PatientReplyStreamHandlers["onToken"];
  onReset?: () => void;
  signal?: AbortSignal;
  /**
   * Default true (legacy): fall back to a persona reply when every provider
   * fails. False: throw `PatientStreamUnavailableError` instead, so the caller
   * can use the classic generator. The no-key path still returns the persona
   * fallback because the classic generator would do the same.
   */
  personaFallback?: boolean;
}): Promise<PatientReplyStreamResult> {
  const { avatar, history, userMessage, behaviourReinforcement } = params;
  const allowPersonaFallback = params.personaFallback !== false;
  const fallbacks =
    avatar.fallback_replies?.length > 0
      ? avatar.fallback_replies
      : DEFAULT_FALLBACK_REPLIES;

  let emitted = false;
  const onToken = (token: string, fullText: string) => {
    if (params.signal?.aborted) return;
    emitted = true;
    params.onToken?.(token, fullText);
  };
  const reset = () => {
    if (emitted) params.onReset?.();
    emitted = false;
  };
  const interruptedResult = (
    text: string,
    aiSource: AiSource,
    model?: string,
    errorKind?: OpenAIErrorKind,
  ): PatientReplyStreamResult => ({
    text: text.trim(),
    aiSource,
    model,
    errorKind,
    interrupted: true,
  });

  const pickFallback = (
    errorKind?: OpenAIErrorKind,
    force = false,
  ): PatientReplyStreamResult => {
    if (params.signal?.aborted) {
      return interruptedResult("", "persona_fallback", undefined, errorKind);
    }
    if (!allowPersonaFallback && !force) {
      throw new PatientStreamUnavailableError(
        "No model produced a streamed patient reply",
        errorKind,
      );
    }
    const idx =
      Math.abs(
        userMessage.split("").reduce((a, c) => a + c.charCodeAt(0), 0),
      ) % fallbacks.length;
    const text = fallbacks[idx]!;
    reset();
    onToken(text, text);
    return {
      text,
      aiSource: "persona_fallback",
      errorKind,
      interrupted: false,
    };
  };

  if (!hasAnyAiKey()) {
    return pickFallback(undefined, true);
  }

  const prior = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-20)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  const reinforcementParts = [
    avatar.per_turn_reinforcement?.trim(),
    behaviourReinforcement?.trim(),
  ].filter(Boolean);
  const reinforced =
    reinforcementParts.length > 0
      ? `${userMessage}\n\n${reinforcementParts.join("\n\n")}`
      : userMessage;

  const viaGatewayStream = async (
    priorErrorKind?: OpenAIErrorKind,
  ): Promise<PatientReplyStreamResult> => {
    reset();
    const messages = [...prior, { role: "user" as const, content: reinforced }];
    const model = gatewayModelId();
    const result = streamText({
      model,
      system: avatar.system_prompt,
      messages,
      temperature: 0.85,
      maxOutputTokens: 220,
      abortSignal: params.signal,
    });
    let text = "";
    for await (const delta of result.textStream) {
      if (params.signal?.aborted) break;
      text += delta;
      onToken(delta, text);
    }
    if (params.signal?.aborted) {
      return interruptedResult(text, "gateway", model, priorErrorKind);
    }
    const trimmed = text.trim();
    if (!trimmed) return pickFallback(priorErrorKind);
    return {
      text: trimmed,
      aiSource: "gateway",
      model,
      errorKind: priorErrorKind,
      interrupted: false,
    };
  };

  const viaOpenAiStream = async (
    model?: string,
    priorErrorKind?: OpenAIErrorKind,
  ): Promise<PatientReplyStreamResult> => {
    reset();
    const result = await openAIService.chatStream(
      {
        messages: [
          { role: "system", content: avatar.system_prompt },
          ...prior,
          { role: "user", content: reinforced },
        ],
        temperature: 0.85,
        maxCompletionTokens: 512,
        model,
        timeoutMs: PATIENT_REPLY_TIMEOUT_MS,
      },
      {
        onToken,
        signal: params.signal,
      },
    );
    if (result.interrupted || params.signal?.aborted) {
      return interruptedResult(result.text, "gpt", result.model, priorErrorKind);
    }
    const text = result.text.trim();
    if (!text) return pickFallback(priorErrorKind);
    return {
      text,
      aiSource: "gpt",
      model: result.model,
      errorKind: priorErrorKind,
      interrupted: false,
    };
  };

  // An abort surfaces as a thrown AbortError from either SDK. It must end the
  // turn, never trigger a failover that would keep generating after barge-in.
  const abortedNow = () => Boolean(params.signal?.aborted);

  if (preferOpenAiSdk()) {
    try {
      return await viaOpenAiStream();
    } catch (err) {
      if (err instanceof PatientStreamUnavailableError) throw err;
      if (abortedNow()) return interruptedResult("", "gpt");
      const kind = openaiErrorKind(err);
      logPatientAgent("openai_stream_failed", {
        ...errorDetails(err),
        next: isRateLimitedOrQuota(err)
          ? openAiFallbackChatModel()
          : hasGatewayKey()
            ? "gateway"
            : allowPersonaFallback
              ? "persona_fallback"
              : "caller",
      });
      if (isRateLimitedOrQuota(err)) {
        try {
          return await viaOpenAiStream(openAiFallbackChatModel(), kind);
        } catch (miniErr) {
          if (miniErr instanceof PatientStreamUnavailableError) throw miniErr;
          if (abortedNow()) return interruptedResult("", "gpt");
          // fall through
        }
      }
      if (hasGatewayKey()) {
        try {
          return await viaGatewayStream(kind);
        } catch (gatewayErr) {
          if (gatewayErr instanceof PatientStreamUnavailableError) {
            throw gatewayErr;
          }
          if (abortedNow()) return interruptedResult("", "gateway");
          return pickFallback(kind);
        }
      }
      return pickFallback(kind);
    }
  }

  try {
    return await viaGatewayStream();
  } catch (err) {
    if (err instanceof PatientStreamUnavailableError) throw err;
    if (abortedNow()) return interruptedResult("", "gateway");
    logPatientAgent("gateway_stream_failed", {
      ...errorDetails(err),
      next: allowPersonaFallback ? "persona_fallback" : "caller",
    });
    return pickFallback(openaiErrorKind(err));
  }
}
