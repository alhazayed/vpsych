import OpenAI from "openai";

let client: OpenAI | null = null;

/** True when OPENAI_API_KEY is present in the environment. */
export function hasOpenAIApiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/**
 * Shared official OpenAI SDK client.
 * Reads OPENAI_API_KEY from the environment. Built-in SDK retries enabled.
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
      maxRetries: Number(process.env.OPENAI_MAX_RETRIES ?? 3),
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
