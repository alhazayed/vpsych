import { generateText } from "ai";
import { openAIService, hasOpenAIApiKey } from "@/lib/ai/openai";
import type { ResolvedAvatar, SessionMessage } from "@/lib/types";

const DEFAULT_FALLBACK_REPLIES = [
  "I'm not sure how to answer that… could you say a bit more?",
  "Yeah… I've been feeling that way a lot lately.",
  "Hmm. I guess I haven't thought about it like that.",
  "Sorry, I zoned out for a second. What were you asking?",
  "It's hard to put into words, but I'll try.",
];

function hasGatewayKey() {
  return Boolean(process.env.AI_GATEWAY_API_KEY?.trim());
}

function hasAnyAiKey() {
  return hasGatewayKey() || hasOpenAIApiKey();
}

function gatewayModelId() {
  return process.env.AI_MODEL || "openai/gpt-4o-mini";
}

/**
 * Prefer the official OpenAI SDK (GPT-5) for the multilingual conversation
 * pipeline when OPENAI_API_KEY is set. Set OPENAI_CHAT_PROVIDER=gateway to
 * force the legacy Vercel AI Gateway path.
 */
function preferOpenAiSdk(): boolean {
  if (process.env.OPENAI_CHAT_PROVIDER?.trim().toLowerCase() === "gateway") {
    return false;
  }
  if (process.env.OPENAI_CHAT_PROVIDER?.trim().toLowerCase() === "openai") {
    return hasOpenAIApiKey();
  }
  return hasOpenAIApiKey();
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

  const pickFallback = () => {
    const idx =
      Math.abs(
        userMessage.split("").reduce((a, c) => a + c.charCodeAt(0), 0),
      ) % fallbacks.length;
    return fallbacks[idx]!;
  };

  if (!hasAnyAiKey()) {
    return pickFallback();
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

  // Degrade gracefully: if the model call fails (rate limit, quota, outage),
  // return a persona fallback instead of hard-failing the whole turn. This
  // mirrors assessSession's behavior and keeps the session usable.
  try {
    if (preferOpenAiSdk()) {
      const result = await openAIService.chat({
        messages: [
          { role: "system", content: avatar.system_prompt },
          ...prior,
          { role: "user", content: reinforced },
        ],
        temperature: 0.85,
        // Headroom so reasoning-model overhead doesn't starve the visible reply.
        maxCompletionTokens: 512,
      });
      return result.text.trim() || pickFallback();
    }

    const messages = [...prior, { role: "user" as const, content: reinforced }];

    const { text } = await generateText({
      model: gatewayModelId(),
      system: avatar.system_prompt,
      messages,
      temperature: 0.85,
      maxOutputTokens: 220,
    });

    return text.trim() || pickFallback();
  } catch (err) {
    console.warn(
      "[patient-agent] AI reply failed; using persona fallback:",
      err instanceof Error ? err.message : String(err),
    );
    return pickFallback();
  }
}
