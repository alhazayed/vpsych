import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  AuthenticationError,
  BadRequestError,
  OpenAIError,
  RateLimitError,
  UnprocessableEntityError,
} from "openai";
import { OpenAIConfigError } from "@/lib/ai/openai/client";

export type OpenAIErrorCode =
  | "OPENAI_CONFIG"
  | "OPENAI_AUTH"
  | "OPENAI_RATE_LIMIT"
  | "OPENAI_INSUFFICIENT_QUOTA"
  | "OPENAI_TIMEOUT"
  | "OPENAI_INVALID_REQUEST"
  | "OPENAI_CONNECTION"
  | "OPENAI_API"
  | "OPENAI_UNKNOWN";

/** Stable runtime kinds for logging / failover decisions. */
export type OpenAIErrorKind =
  | "insufficient_quota"
  | "rate_limit"
  | "timeout"
  | "authentication"
  | "invalid_request"
  | "connection"
  | "config"
  | "api"
  | "unknown";

export class OpenAIServiceError extends Error {
  readonly code: OpenAIErrorCode;
  readonly kind: OpenAIErrorKind;
  readonly status?: number;
  readonly retryable: boolean;
  /** Provider `error.code` when present (e.g. insufficient_quota). */
  readonly providerCode?: string | null;
  readonly cause?: unknown;

  constructor(
    message: string,
    options: {
      code: OpenAIErrorCode;
      kind: OpenAIErrorKind;
      status?: number;
      retryable?: boolean;
      providerCode?: string | null;
      cause?: unknown;
    },
  ) {
    super(message);
    this.name = "OpenAIServiceError";
    this.code = options.code;
    this.kind = options.kind;
    this.status = options.status;
    this.retryable = options.retryable ?? false;
    this.providerCode = options.providerCode;
    this.cause = options.cause;
  }
}

/** Duck-type check — survives Vitest module reloads / duplicate class copies. */
export function isOpenAIServiceError(
  error: unknown,
): error is OpenAIServiceError {
  if (error instanceof OpenAIServiceError) return true;
  if (typeof error !== "object" || error === null) return false;
  const e = error as {
    name?: string;
    kind?: unknown;
    code?: unknown;
  };
  return (
    e.name === "OpenAIServiceError" &&
    typeof e.kind === "string" &&
    typeof e.code === "string"
  );
}

export function openaiErrorKind(error: unknown): OpenAIErrorKind {
  if (isOpenAIServiceError(error)) return error.kind;
  return toOpenAIServiceError(error).kind;
}

function providerErrorCode(error: { code?: string | null }): string | null {
  return typeof error.code === "string" ? error.code : (error.code ?? null);
}

function isInsufficientQuota(error: {
  code?: string | null;
  message?: string;
}): boolean {
  const code = (error.code ?? "").toLowerCase();
  if (code === "insufficient_quota") return true;
  const msg = (error.message ?? "").toLowerCase();
  return (
    msg.includes("insufficient_quota") ||
    msg.includes("exceeded your current quota") ||
    msg.includes("insufficient quota")
  );
}

export function toOpenAIServiceError(error: unknown): OpenAIServiceError {
  if (error instanceof OpenAIServiceError) return error;
  // Re-wrap duck-typed copies so callers always get a real instance.
  if (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: string }).name === "OpenAIServiceError" &&
    typeof (error as { kind?: unknown }).kind === "string" &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    const duck = error as OpenAIServiceError;
    return new OpenAIServiceError(duck.message, {
      code: duck.code,
      kind: duck.kind,
      status: duck.status,
      retryable: duck.retryable,
      providerCode: duck.providerCode,
      cause: duck.cause,
    });
  }

  if (error instanceof OpenAIConfigError) {
    return new OpenAIServiceError(error.message, {
      code: "OPENAI_CONFIG",
      kind: "config",
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
        kind: "authentication",
        status: error.status,
        retryable: false,
        providerCode: providerErrorCode(error),
        cause: error,
      },
    );
  }

  // Timeout before generic connection (Timeout extends Connection).
  if (error instanceof APIConnectionTimeoutError) {
    return new OpenAIServiceError("OpenAI request timed out.", {
      code: "OPENAI_TIMEOUT",
      kind: "timeout",
      status: 408,
      retryable: true,
      cause: error,
    });
  }

  if (
    error instanceof BadRequestError ||
    error instanceof UnprocessableEntityError
  ) {
    return new OpenAIServiceError(
      error.message || "OpenAI invalid request.",
      {
        code: "OPENAI_INVALID_REQUEST",
        kind: "invalid_request",
        status: error.status,
        retryable: false,
        providerCode: providerErrorCode(error),
        cause: error,
      },
    );
  }

  if (error instanceof RateLimitError) {
    // Never retry 429 at the app layer — retries deepen the rate-limit hole.
    if (isInsufficientQuota(error)) {
      return new OpenAIServiceError("OpenAI insufficient quota.", {
        code: "OPENAI_INSUFFICIENT_QUOTA",
        kind: "insufficient_quota",
        status: error.status,
        retryable: false,
        providerCode: providerErrorCode(error) ?? "insufficient_quota",
        cause: error,
      });
    }
    return new OpenAIServiceError("OpenAI rate limit exceeded.", {
      code: "OPENAI_RATE_LIMIT",
      kind: "rate_limit",
      status: error.status,
      retryable: false,
      providerCode: providerErrorCode(error),
      cause: error,
    });
  }

  if (error instanceof APIConnectionError) {
    return new OpenAIServiceError("OpenAI connection failed.", {
      code: "OPENAI_CONNECTION",
      kind: "connection",
      status: 502,
      retryable: true,
      cause: error,
    });
  }

  if (error instanceof APIError) {
    if (error.status === 408) {
      return new OpenAIServiceError(error.message || "OpenAI request timed out.", {
        code: "OPENAI_TIMEOUT",
        kind: "timeout",
        status: 408,
        retryable: true,
        providerCode: providerErrorCode(error),
        cause: error,
      });
    }
    if (error.status === 400 || error.status === 422) {
      return new OpenAIServiceError(
        error.message || "OpenAI invalid request.",
        {
          code: "OPENAI_INVALID_REQUEST",
          kind: "invalid_request",
          status: error.status,
          retryable: false,
          providerCode: providerErrorCode(error),
          cause: error,
        },
      );
    }
    if (error.status === 429) {
      if (isInsufficientQuota(error)) {
        return new OpenAIServiceError(
          error.message || "OpenAI insufficient quota.",
          {
            code: "OPENAI_INSUFFICIENT_QUOTA",
            kind: "insufficient_quota",
            status: 429,
            retryable: false,
            providerCode: providerErrorCode(error) ?? "insufficient_quota",
            cause: error,
          },
        );
      }
      return new OpenAIServiceError(
        error.message || "OpenAI rate limit exceeded.",
        {
          code: "OPENAI_RATE_LIMIT",
          kind: "rate_limit",
          status: 429,
          retryable: false,
          providerCode: providerErrorCode(error),
          cause: error,
        },
      );
    }
    if (error.status === 401) {
      return new OpenAIServiceError(
        error.message || "OpenAI authentication failed.",
        {
          code: "OPENAI_AUTH",
          kind: "authentication",
          status: 401,
          retryable: false,
          providerCode: providerErrorCode(error),
          cause: error,
        },
      );
    }

    const retryable =
      error.status === 409 || (error.status ?? 0) >= 500;
    return new OpenAIServiceError(error.message || "OpenAI API error.", {
      code: "OPENAI_API",
      kind: "api",
      status: error.status,
      retryable,
      providerCode: providerErrorCode(error),
      cause: error,
    });
  }

  if (error instanceof OpenAIError) {
    return new OpenAIServiceError(error.message || "OpenAI error.", {
      code: "OPENAI_UNKNOWN",
      kind: "unknown",
      retryable: false,
      cause: error,
    });
  }

  const message =
    error instanceof Error ? error.message : "Unexpected OpenAI service failure.";
  return new OpenAIServiceError(message, {
    code: "OPENAI_UNKNOWN",
    kind: "unknown",
    retryable: false,
    cause: error,
  });
}
