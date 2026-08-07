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
    });
    const trimmed = text.trim();
    if (!trimmed) return pickFallback(priorErrorKind);
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
 * Stage 11 — streaming patient reply. Same prompt construction as
 * `generatePatientReplyDetailed`; tokens are presentation-only.
 * Cognition owners upstream are unchanged.
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
  signal?: AbortSignal;
}): Promise<PatientReplyStreamResult> {
  const { avatar, history, userMessage, behaviourReinforcement } = params;
  const fallbacks =
    avatar.fallback_replies?.length > 0
      ? avatar.fallback_replies
      : DEFAULT_FALLBACK_REPLIES;

  const pickFallback = (
    errorKind?: OpenAIErrorKind,
  ): PatientReplyStreamResult => {
    const idx =
      Math.abs(
        userMessage.split("").reduce((a, c) => a + c.charCodeAt(0), 0),
      ) % fallbacks.length;
    const text = fallbacks[idx]!;
    params.onToken?.(text, text);
    return {
      text,
      aiSource: "persona_fallback",
      errorKind,
      interrupted: Boolean(params.signal?.aborted),
    };
  };

  if (!hasAnyAiKey()) {
    return pickFallback();
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
      if (params.signal?.aborted) {
        return {
          text: text.trim() || (await result.text).trim(),
          aiSource: "gateway",
          model,
          errorKind: priorErrorKind,
          interrupted: true,
        };
      }
      text += delta;
      params.onToken?.(delta, text);
    }
    const trimmed = text.trim() || (await result.text).trim();
    if (!trimmed) return pickFallback(priorErrorKind);
    return {
      text: trimmed,
      aiSource: "gateway",
      model,
      errorKind: priorErrorKind,
      interrupted: Boolean(params.signal?.aborted),
    };
  };

  const viaOpenAiStream = async (
    model?: string,
    priorErrorKind?: OpenAIErrorKind,
  ): Promise<PatientReplyStreamResult> => {
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
      },
      {
        onToken: params.onToken,
        signal: params.signal,
      },
    );
    const text = result.text.trim();
    if (!text) return pickFallback(priorErrorKind);
    return {
      text,
      aiSource: "gpt",
      model: result.model,
      errorKind: priorErrorKind,
      interrupted: result.interrupted,
    };
  };

  if (preferOpenAiSdk()) {
    try {
      return await viaOpenAiStream();
    } catch (err) {
      const kind = openaiErrorKind(err);
      if (isRateLimitedOrQuota(err)) {
        try {
          return await viaOpenAiStream(openAiFallbackChatModel(), kind);
        } catch {
          // fall through
        }
      }
      if (hasGatewayKey()) {
        try {
          return await viaGatewayStream(kind);
        } catch {
          return pickFallback(kind);
        }
      }
      return pickFallback(kind);
    }
  }

  try {
    return await viaGatewayStream();
  } catch (err) {
    return pickFallback(openaiErrorKind(err));
  }
}
