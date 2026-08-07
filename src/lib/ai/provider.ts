import { hasOpenAIApiKey } from "@/lib/ai/openai";

/**
 * Reply / assessment provenance returned to clients (never hide fallback).
 * `cbe_direct` = Conversation Behaviour Engine short-circuit (silence /
 * interruption stall) — not a model completion.
 */
export type AiSource = "gpt" | "gateway" | "persona_fallback" | "cbe_direct";

export function hasGatewayKey() {
  return Boolean(process.env.AI_GATEWAY_API_KEY?.trim());
}

export function hasAnyAiKey() {
  return hasGatewayKey() || hasOpenAIApiKey();
}

export function gatewayModelId() {
  return process.env.AI_MODEL || "openai/gpt-4o-mini";
}

/**
 * Prefer the official OpenAI SDK (GPT-5) when OPENAI_API_KEY is set.
 * Set OPENAI_CHAT_PROVIDER=gateway to force the Vercel AI Gateway path.
 * Shared by patient chat and session assessment so both use one pipeline.
 */
export function preferOpenAiSdk(): boolean {
  if (process.env.OPENAI_CHAT_PROVIDER?.trim().toLowerCase() === "gateway") {
    return false;
  }
  if (process.env.OPENAI_CHAT_PROVIDER?.trim().toLowerCase() === "openai") {
    return hasOpenAIApiKey();
  }
  return hasOpenAIApiKey();
}

export function openAiFallbackChatModel() {
  return process.env.OPENAI_FALLBACK_CHAT_MODEL?.trim() || "gpt-4o-mini";
}
