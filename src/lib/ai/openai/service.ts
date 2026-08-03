import OpenAI, { toFile } from "openai";
import {
  getOpenAIClient,
  hasOpenAIApiKey,
  OpenAIConfigError,
} from "@/lib/ai/openai/client";
import {
  toOpenAIServiceError,
  OpenAIServiceError,
} from "@/lib/ai/openai/errors";
import { withOpenAIRetry } from "@/lib/ai/openai/retry";
import {
  BackpressureError,
  CircuitOpenError,
  openaiCircuit,
  openaiLimiter,
} from "@/lib/performance/resilience";

async function withOpenAIProtection<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await openaiLimiter.run(() => openaiCircuit.exec(fn));
  } catch (err) {
    if (err instanceof CircuitOpenError || err instanceof BackpressureError) {
      throw new OpenAIServiceError(err.message, {
        code: "OPENAI_API",
        kind: "api",
        status: 503,
        retryable: false,
        providerCode: err.code,
        cause: err,
      });
    }
    throw err;
  }
}

/** Default GPT-5 chat model; override with OPENAI_CHAT_MODEL. */
export const DEFAULT_OPENAI_CHAT_MODEL = "gpt-5";

/** Default STT model; override with OPENAI_STT_MODEL. */
export const DEFAULT_OPENAI_STT_MODEL = "gpt-4o-transcribe";

type ReasoningEffort = "minimal" | "low" | "medium" | "high";

/**
 * Reasoning-family chat models (gpt-5*, o1*, o3*, o4*) reject a non-default
 * `temperature` (only 1 is allowed) and instead accept `reasoning_effort`.
 * Sending `temperature` to them returns HTTP 400, which previously surfaced as
 * a hard "Failed to generate patient reply" (502) on every turn.
 */
export function isReasoningModel(model: string): boolean {
  return /^(gpt-5|o1|o3|o4)/i.test(model.trim());
}

/** Reasoning effort for reasoning models; `minimal` keeps replies fast + within token budget. */
function reasoningEffort(): ReasoningEffort {
  const v = process.env.OPENAI_REASONING_EFFORT?.trim().toLowerCase();
  if (v === "minimal" || v === "low" || v === "medium" || v === "high") {
    return v;
  }
  return "minimal";
}

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "developer";
  content: string;
};

export type ChatCompletionParams = {
  messages: ChatMessage[];
  /** Defaults to OPENAI_CHAT_MODEL or gpt-5. */
  model?: string;
  temperature?: number;
  maxCompletionTokens?: number;
  /** Request JSON object mode when the model supports it (assessment). */
  json?: boolean;
};

export type ChatCompletionResult = {
  text: string;
  model: string;
  provider: "openai";
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
};

export type SpeechToTextParams = {
  audio: Blob | ArrayBuffer | Buffer | Uint8Array;
  /** Filename hint for MIME/type detection (e.g. audio.wav). */
  filename?: string;
  /** BCP-47 / ISO-639-1 language hint (en, ar, …). */
  language?: string;
  /** Defaults to OPENAI_STT_MODEL or gpt-4o-transcribe. */
  model?: string;
  prompt?: string;
};

export type SpeechToTextResult = {
  transcript: string;
  model: string;
  provider: "openai";
  language?: string;
};

export type OpenAIHealthStatus = {
  ok: boolean;
  configured: boolean;
  provider: "openai";
  chatModel: string;
  sttModel: string;
  checkedAt: string;
  latencyMs?: number;
  error?: string;
  code?: string;
};

function chatModelId(override?: string) {
  return (
    override?.trim() ||
    process.env.OPENAI_CHAT_MODEL?.trim() ||
    DEFAULT_OPENAI_CHAT_MODEL
  );
}

function sttModelId(override?: string) {
  return (
    override?.trim() ||
    process.env.OPENAI_STT_MODEL?.trim() ||
    DEFAULT_OPENAI_STT_MODEL
  );
}

function languageHint(input?: string): string | undefined {
  if (!input) return undefined;
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return undefined;
  // OpenAI STT expects ISO-639-1 (e.g. en, ar).
  return trimmed.split(/[-_]/)[0];
}

async function audioToUploadable(
  audio: SpeechToTextParams["audio"],
  filename: string,
) {
  if (audio instanceof Blob) {
    const buffer = Buffer.from(await audio.arrayBuffer());
    return toFile(buffer, filename, {
      type: audio.type || undefined,
    });
  }
  if (audio instanceof ArrayBuffer) {
    return toFile(Buffer.from(audio), filename);
  }
  return toFile(audio, filename);
}

/**
 * Reusable OpenAI service — GPT-5 chat + speech-to-text, with retries
 * and normalized error handling. Reads OPENAI_API_KEY from the environment.
 */
export const openAIService = {
  isConfigured: hasOpenAIApiKey,

  /** GPT-5 (or configured) chat completion via the official SDK. */
  async chat(params: ChatCompletionParams): Promise<ChatCompletionResult> {
    return withOpenAIProtection(() =>
      withOpenAIRetry(async () => {
        try {
          const client = getOpenAIClient();
          const model = chatModelId(params.model);
          const reasoning = isReasoningModel(model);
          const request: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming =
            {
              model,
              messages: params.messages.map((m) => ({
                role: m.role,
                content: m.content,
              })),
              max_completion_tokens: params.maxCompletionTokens,
            };
          // Only standard models accept a custom temperature. Reasoning models
          // (gpt-5, o-series) 400 on any temperature != 1, so omit it and steer
          // them with reasoning_effort instead.
          if (reasoning) {
            request.reasoning_effort = reasoningEffort();
          } else if (params.temperature !== undefined) {
            request.temperature = params.temperature;
          }
          if (params.json) {
            request.response_format = { type: "json_object" };
          }
          const completion = await client.chat.completions.create(request);

          const text = completion.choices[0]?.message?.content?.trim() ?? "";
          return {
            text,
            model: completion.model || model,
            provider: "openai" as const,
            usage: completion.usage
              ? {
                  promptTokens: completion.usage.prompt_tokens,
                  completionTokens: completion.usage.completion_tokens,
                  totalTokens: completion.usage.total_tokens,
                }
              : undefined,
          };
        } catch (error) {
          throw toOpenAIServiceError(error);
        }
      }),
    );
  },

  /** Speech-to-text via OpenAI audio transcriptions. */
  async speechToText(
    params: SpeechToTextParams,
  ): Promise<SpeechToTextResult> {
    return withOpenAIProtection(() =>
      withOpenAIRetry(async () => {
        try {
          const client = getOpenAIClient();
          const model = sttModelId(params.model);
          const filename = params.filename || "audio.wav";
          const file = await audioToUploadable(params.audio, filename);
          const language = languageHint(params.language);

          const result = await client.audio.transcriptions.create({
            file,
            model,
            ...(language ? { language } : {}),
            ...(params.prompt ? { prompt: params.prompt } : {}),
          });

          const transcript = String(
            (result as { text?: string }).text ?? result ?? "",
          ).trim();

          return {
            transcript,
            model,
            provider: "openai" as const,
            language,
          };
        } catch (error) {
          throw toOpenAIServiceError(error);
        }
      }),
    );
  },

  /**
   * Lightweight health check — verifies key presence and a minimal models list call.
   * Does not change existing product APIs.
   */
  async healthCheck(): Promise<OpenAIHealthStatus> {
    const checkedAt = new Date().toISOString();
    const chatModel = chatModelId();
    const sttModel = sttModelId();

    if (!hasOpenAIApiKey()) {
      return {
        ok: false,
        configured: false,
        provider: "openai",
        chatModel,
        sttModel,
        checkedAt,
        error: "OPENAI_API_KEY is not configured",
        code: "OPENAI_CONFIG",
      };
    }

    const started = Date.now();
    try {
      await withOpenAIRetry(
        async () => {
          const client = getOpenAIClient();
          // Cheap authenticated probe (does not burn chat tokens).
          await client.models.list();
        },
        { attempts: 2, baseDelayMs: 150 },
      );

      return {
        ok: true,
        configured: true,
        provider: "openai",
        chatModel,
        sttModel,
        checkedAt,
        latencyMs: Date.now() - started,
      };
    } catch (error) {
      const mapped =
        error instanceof OpenAIConfigError
          ? toOpenAIServiceError(error)
          : toOpenAIServiceError(error);
      return {
        ok: false,
        configured: true,
        provider: "openai",
        chatModel,
        sttModel,
        checkedAt,
        latencyMs: Date.now() - started,
        error: mapped.message,
        code: mapped.code,
      };
    }
  },
};
