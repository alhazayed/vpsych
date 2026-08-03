import { toOpenAIServiceError, type OpenAIServiceError } from "@/lib/ai/openai/errors";

export type RetryOptions = {
  /** Total attempts including the first try. Default 2 (1 retry). */
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
 * Prefer low SDK maxRetries (≤1) so total attempts stay bounded under load.
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
