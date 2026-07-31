import { generateText } from "ai";
import type { ResolvedAvatar, SessionMessage } from "@/lib/types";

const DEFAULT_FALLBACK_REPLIES = [
  "I'm not sure how to answer that… could you say a bit more?",
  "Yeah… I've been feeling that way a lot lately.",
  "Hmm. I guess I haven't thought about it like that.",
  "Sorry, I zoned out for a second. What were you asking?",
  "It's hard to put into words, but I'll try.",
];

function hasAiKey() {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY,
  );
}

function modelId() {
  return process.env.AI_MODEL || "openai/gpt-4o-mini";
}

export async function generatePatientReply(params: {
  avatar: Pick<
    ResolvedAvatar,
    "name" | "disorder" | "system_prompt" | "fallback_replies" | "per_turn_reinforcement"
  >;
  history: Pick<SessionMessage, "role" | "content">[];
  userMessage: string;
}): Promise<string> {
  const { avatar, history, userMessage } = params;
  const fallbacks =
    avatar.fallback_replies?.length > 0
      ? avatar.fallback_replies
      : DEFAULT_FALLBACK_REPLIES;

  if (!hasAiKey()) {
    const idx =
      Math.abs(
        userMessage.split("").reduce((a, c) => a + c.charCodeAt(0), 0),
      ) % fallbacks.length;
    return fallbacks[idx]!;
  }

  const messages = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-20)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  messages.push({ role: "user", content: userMessage });

  const reinforcement = avatar.per_turn_reinforcement
    ? `\n${avatar.per_turn_reinforcement}`
    : "";

  const { text } = await generateText({
    model: modelId(),
    system: `${avatar.system_prompt}

Additional constraints for this voice therapy simulation:
- Reply as the patient only. Never narrate stage directions.
- Keep replies under 80 words so they can be spoken aloud.
- Disorder context: ${avatar.disorder}.${reinforcement}`,
    messages,
    temperature: 0.85,
    maxOutputTokens: 220,
  });

  return text.trim() || fallbacks[0]!;
}
