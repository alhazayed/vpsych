import OpenAI from "openai";

let client: OpenAI | null = null;

/** True when OPENAI_API_KEY is present in the environment. */
export function hasOpenAIApiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/**
 * Shared official OpenAI SDK client.
 * Reads OPENAI_API_KEY from the environment.
 *
 * SDK retries default to 0: `withOpenAIRetry` is the single retry layer, so
 * attempts don't multiply (3 SDK retries × 2 app attempts × 60 s used to let
 * one call run ~8 minutes). Callers pass a per-request timeout from
 * `lib/ai/time-budget.ts`.
 */
export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new OpenAIConfigError(
      "OPENAI_API_KEY is not set. Add it to the environment to use the OpenAI SDK.",
    );
  }

  if (!client) {
    client = new OpenAI({
      apiKey,
      maxRetries: Number(process.env.OPENAI_MAX_RETRIES ?? 0),
      timeout: Number(process.env.OPENAI_TIMEOUT_MS ?? 60_000),
    });
  }

  return client;
}

/** Reset singleton (tests). */
export function resetOpenAIClient(): void {
  client = null;
}

export class OpenAIConfigError extends Error {
  readonly code = "OPENAI_CONFIG" as const;
  constructor(message: string) {
    super(message);
    this.name = "OpenAIConfigError";
  }
}
