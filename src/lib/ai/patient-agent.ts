import { generateText } from "ai";
import { openAIService, hasOpenAIApiKey } from "@/lib/ai/openai";
import { isConfiguredSecret } from "@/lib/env";
import type { ResolvedAvatar, SessionMessage } from "@/lib/types";

const DEFAULT_FALLBACK_REPLIES = [
  "I'm not sure how to answer that… could you say a bit more?",
  "Yeah… I've been feeling that way a lot lately.",
  "Hmm. I guess I haven't thought about it like that.",
  "Sorry, I zoned out for a second. What were you asking?",
  "It's hard to put into words, but I'll try.",
];

function hasGatewayKey() {
  return isConfiguredSecret(process.env.AI_GATEWAY_API_KEY);
}

function hasAnyAiKey() {
  return hasGatewayKey() || hasOpenAIApiKey();
}

function gatewayModelId() {
  return process.env.AI_MODEL || "openai/gpt-4o-mini";
}

/**
 * Prefer AI Gateway when configured (matches assessment routing).
 * Set OPENAI_CHAT_PROVIDER=openai to force the OpenAI SDK, or
 * OPENAI_CHAT_PROVIDER=gateway to force the gateway.
 */
function preferOpenAiSdk(): boolean {
  if (process.env.OPENAI_CHAT_PROVIDER?.trim().toLowerCase() === "openai") {
    return hasOpenAIApiKey();
  }
  if (process.env.OPENAI_CHAT_PROVIDER?.trim().toLowerCase() === "gateway") {
    return false;
  }
  return hasOpenAIApiKey() && !hasGatewayKey();
}

/**
 * Generate a patient reply using the multilingual prompt engine output.
 * Call sites pass a ResolvedAvatar (from resolveAvatar + session.language).
 * HTTP API request/response shapes are unchanged.
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
  const { avatar, history, userMessage } = params;
  const fallbacks =
    avatar.fallback_replies?.length > 0
      ? avatar.fallback_replies
      : DEFAULT_FALLBACK_REPLIES;

  if (!hasAnyAiKey()) {
    const idx =
      Math.abs(
        userMessage.split("").reduce((a, c) => a + c.charCodeAt(0), 0),
      ) % fallbacks.length;
    return fallbacks[idx]!;
  }

  const prior = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-20)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  // Per-turn reinforcement is appended to the therapist turn (not stored).
  const reinforced = avatar.per_turn_reinforcement
    ? `${userMessage}\n\n${avatar.per_turn_reinforcement}`
    : userMessage;

  try {
    if (preferOpenAiSdk()) {
      const result = await openAIService.chat({
        messages: [
          { role: "system", content: avatar.system_prompt },
          ...prior,
          { role: "user", content: reinforced },
        ],
        temperature: 0.85,
        maxCompletionTokens: 220,
      });
      return result.text.trim() || fallbacks[0]!;
    }

    const messages = [...prior, { role: "user" as const, content: reinforced }];

    const { text } = await generateText({
      model: gatewayModelId(),
      system: avatar.system_prompt,
      messages,
      temperature: 0.85,
      maxOutputTokens: 220,
    });

    return text.trim() || fallbacks[0]!;
  } catch {
    // Provider misconfiguration / outage must not hard-fail the session turn.
    const idx =
      Math.abs(
        userMessage.split("").reduce((a, c) => a + c.charCodeAt(0), 0),
      ) % fallbacks.length;
    return fallbacks[idx]!;
  }
}
