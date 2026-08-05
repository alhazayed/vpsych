/**
 * GPT patient reasoner — modular prompt + structured JSON output.
 */

import { generateText } from "ai";
import {
  isOpenAIServiceError,
  openaiErrorKind,
  type OpenAIErrorKind,
} from "@/lib/ai/openai/errors";
import { openAIService } from "@/lib/ai/openai";
import {
  gatewayModelId,
  hasAnyAiKey,
  hasGatewayKey,
  openAiFallbackChatModel,
  preferOpenAiSdk,
  type AiSource,
} from "@/lib/ai/provider";
import { hceDeepReasoningEffort } from "@/lib/hce/config";
import { HCE_ANTI_BIAS_DIRECTIVES } from "@/lib/hce/bias";
import { formatTurnBriefForPrompt } from "@/lib/hce/director";
import { summarizeEpisodicForPrompt } from "@/lib/hce/engines/memory";
import type {
  GptTurnOutput,
  HceMemoryState,
  MemoryEngineOutput,
  ReasoningMode,
  TurnBrief,
} from "@/lib/hce/types";
import type { ResolvedAvatar, SessionMessage } from "@/lib/types";

const DEFAULT_FALLBACK_REPLIES = [
  "I'm not sure how to answer that… could you say a bit more?",
  "Yeah… I've been feeling that way a lot lately.",
  "Hmm. I guess I haven't thought about it like that.",
];

export type ReasonerResult = {
  output: GptTurnOutput;
  aiSource: AiSource;
  model?: string;
  errorKind?: OpenAIErrorKind;
};

export async function generateHcePatientTurn(params: {
  avatar: Pick<
    ResolvedAvatar,
    "name" | "disorder" | "fallback_replies" | "per_turn_reinforcement"
  >;
  history: Pick<SessionMessage, "role" | "content">[];
  userMessage: string;
  turnBrief: TurnBrief;
  memory: MemoryEngineOutput;
  hceState: HceMemoryState;
  reasoningMode: ReasoningMode;
}): Promise<ReasonerResult> {
  const fallbacks =
    params.avatar.fallback_replies?.length > 0
      ? params.avatar.fallback_replies
      : DEFAULT_FALLBACK_REPLIES;

  const pickFallback = (errorKind?: OpenAIErrorKind): ReasonerResult => {
    const idx =
      Math.abs(
        params.userMessage.split("").reduce((a, c) => a + c.charCodeAt(0), 0),
      ) % fallbacks.length;
    return {
      output: { patient_utterance: fallbacks[idx]! },
      aiSource: "persona_fallback",
      errorKind,
    };
  };

  if (!hasAnyAiKey()) return pickFallback();

  const prior = params.history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-20)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  const reinforced = params.avatar.per_turn_reinforcement
    ? `${params.userMessage}\n\n${params.avatar.per_turn_reinforcement}`
    : params.userMessage;

  const system = buildHceSystemPrompt(params);

  const jsonInstruction = `Respond with a single JSON object only:
{
  "patient_utterance": "what the patient says aloud (1-4 sentences, ~${params.hceState.behavior.turn_length_target} words max)",
  "memory_writes": [{"key":"topic","value":"brief fact"}],
  "emotion_delta": {"intensity_delta": 0},
  "clinical_events": [{"type":"disclosed_topic","topic":"..."}],
  "voice_markup": {"breaks":[]}
}
Do not include internal_note in output. patient_utterance must be natural speech only.`;

  const viaOpenAi = async (
    model?: string,
    priorErrorKind?: OpenAIErrorKind,
  ): Promise<ReasonerResult> => {
    const deep = params.reasoningMode === "deep";
    const result = await openAIService.chat({
      messages: [
        { role: "system", content: system },
        ...prior,
        { role: "user", content: `${reinforced}\n\n${jsonInstruction}` },
      ],
      maxCompletionTokens: deep ? 768 : 512,
      model,
      json: true,
      reasoningEffort: deep ? hceDeepReasoningEffort() : "minimal",
    });
    const parsed = parseGptOutput(result.text);
    if (!parsed) return pickFallback(priorErrorKind);
    return {
      output: parsed,
      aiSource: "gpt",
      model: result.model,
      errorKind: priorErrorKind,
    };
  };

  const viaGateway = async (
    priorErrorKind?: OpenAIErrorKind,
  ): Promise<ReasonerResult> => {
    const model = gatewayModelId();
    const { text } = await generateText({
      model,
      system: `${system}\n\n${jsonInstruction}`,
      messages: [...prior, { role: "user", content: reinforced }],
      temperature: 0.85,
      maxOutputTokens: 400,
    });
    const parsed = parseGptOutput(text);
    if (!parsed) return pickFallback(priorErrorKind);
    return {
      output: parsed,
      aiSource: "gateway",
      model,
      errorKind: priorErrorKind,
    };
  };

  if (preferOpenAiSdk()) {
    try {
      return await viaOpenAi();
    } catch (err) {
      const kind = openaiErrorKind(err);
      if (isRateLimitedOrQuota(err)) {
        try {
          return await viaOpenAi(openAiFallbackChatModel(), kind);
        } catch {
          /* continue failover */
        }
      }
      if (hasGatewayKey()) {
        try {
          return await viaGateway(kind);
        } catch {
          return pickFallback(kind);
        }
      }
      return pickFallback(kind);
    }
  }

  try {
    return await viaGateway();
  } catch (err) {
    return pickFallback(openaiErrorKind(err));
  }
}

function buildHceSystemPrompt(params: {
  avatar: Pick<ResolvedAvatar, "name" | "disorder">;
  turnBrief: TurnBrief;
  memory: MemoryEngineOutput;
  hceState: HceMemoryState;
}): string {
  const episodic = summarizeEpisodicForPrompt(params.hceState.episodic);
  return [
    `You are ${params.avatar.name}, a patient in a therapy training simulation.`,
    `Condition (authored): ${params.avatar.disorder}`,
    formatTurnBriefForPrompt(params.turnBrief, params.memory),
    "EPISODIC MEMORY:",
    episodic,
    "ANTI-BIAS:",
    HCE_ANTI_BIAS_DIRECTIVES.join("\n"),
  ].join("\n\n");
}

function parseGptOutput(text: string): GptTurnOutput | null {
  const trimmed = text.trim();
  let jsonStr = trimmed;
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) jsonStr = fence[1]!.trim();
  try {
    const obj = JSON.parse(jsonStr) as GptTurnOutput;
    const utterance = obj.patient_utterance?.trim();
    if (!utterance) return null;
    return { ...obj, patient_utterance: utterance };
  } catch {
    if (trimmed.length > 0 && trimmed.length < 800 && !trimmed.startsWith("{")) {
      return { patient_utterance: trimmed };
    }
    return null;
  }
}

function isRateLimitedOrQuota(err: unknown): boolean {
  const kind = openaiErrorKind(err);
  if (kind === "rate_limit" || kind === "insufficient_quota") return true;
  if (isOpenAIServiceError(err) && err.status === 429) return true;
  return false;
}
