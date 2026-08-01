import {
  APIConnectionError,
  APIError,
  AuthenticationError,
  OpenAIError,
  RateLimitError,
} from "openai";
import { OpenAIConfigError } from "@/lib/ai/openai/client";

export type OpenAIErrorCode =
  | "OPENAI_CONFIG"
  | "OPENAI_AUTH"
  | "OPENAI_RATE_LIMIT"
  | "OPENAI_CONNECTION"
  | "OPENAI_API"
  | "OPENAI_UNKNOWN";

export class OpenAIServiceError extends Error {
  readonly code: OpenAIErrorCode;
  readonly status?: number;
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(
    message: string,
    options: {
      code: OpenAIErrorCode;
      status?: number;
      retryable?: boolean;
      cause?: unknown;
    },
  ) {
    super(message);
    this.name = "OpenAIServiceError";
    this.code = options.code;
    this.status = options.status;
    this.retryable = options.retryable ?? false;
    this.cause = options.cause;
  }
}

export function toOpenAIServiceError(error: unknown): OpenAIServiceError {
  if (error instanceof OpenAIServiceError) return error;

  if (error instanceof OpenAIConfigError) {
    return new OpenAIServiceError(error.message, {
      code: "OPENAI_CONFIG",
      status: 501,
      retryable: false,
      cause: error,
    });
  }

  if (error instanceof AuthenticationError) {
    return new OpenAIServiceError(
      "OpenAI authentication failed. Check OPENAI_API_KEY.",
      {
        code: "OPENAI_AUTH",
        status: error.status,
        retryable: false,
        cause: error,
      },
    );
  }

  if (error instanceof RateLimitError) {
    // Do not retry 429s at the app layer — retries deepen the rate-limit hole.
    // Callers (patient-agent) fall through to gpt-4o-mini / gateway / persona.
    return new OpenAIServiceError("OpenAI rate limit exceeded.", {
      code: "OPENAI_RATE_LIMIT",
      status: error.status,
      retryable: false,
      cause: error,
    });
  }

  if (error instanceof APIConnectionError) {
    return new OpenAIServiceError("OpenAI connection failed.", {
      code: "OPENAI_CONNECTION",
      status: 502,
      retryable: true,
      cause: error,
    });
  }

  if (error instanceof APIError) {
    const retryable = error.status === 408 || error.status === 409 || (error.status ?? 0) >= 500;
    return new OpenAIServiceError(error.message || "OpenAI API error.", {
      code: "OPENAI_API",
      status: error.status,
      retryable,
      cause: error,
    });
  }

  if (error instanceof OpenAIError) {
    return new OpenAIServiceError(error.message || "OpenAI error.", {
      code: "OPENAI_UNKNOWN",
      retryable: false,
      cause: error,
    });
  }

  const message =
    error instanceof Error ? error.message : "Unexpected OpenAI service failure.";
  return new OpenAIServiceError(message, {
    code: "OPENAI_UNKNOWN",
    retryable: false,
    cause: error,
  });
}
