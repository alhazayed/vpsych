import { toOpenAIServiceError, type OpenAIServiceError } from "@/lib/ai/openai/errors";

export type RetryOptions = {
  /** Extra application-level attempts beyond the SDK's own retries. Default 2. */
  attempts?: number;
  /** Base delay in ms for exponential backoff. Default 250. */
  baseDelayMs?: number;
  /** Optional predicate; default retries OpenAIServiceError.retryable. */
  shouldRetry?: (error: OpenAIServiceError) => boolean;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Application-level retry with exponential backoff + jitter.
 * Complements the official SDK's built-in `maxRetries`.
 */
export async function withOpenAIRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 2);
  const baseDelayMs = options.baseDelayMs ?? 250;
  const shouldRetry =
    options.shouldRetry ?? ((err: OpenAIServiceError) => err.retryable);

  let lastError: OpenAIServiceError | undefined;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const mapped = toOpenAIServiceError(error);
      lastError = mapped;
      if (attempt >= attempts || !shouldRetry(mapped)) {
        throw mapped;
      }
      const delay =
        baseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * 100);
      await sleep(delay);
    }
  }

  throw lastError ?? toOpenAIServiceError(new Error("Retry exhausted"));
}
