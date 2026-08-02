import { NextResponse } from "next/server";
import { generateText } from "ai";
import { openAIService, hasOpenAIApiKey } from "@/lib/ai/openai";

// TEMPORARY DIAGNOSTIC (throwaway branch, never merged): determines why the
// session assessment falls back to the heuristic — which AI path assessSession
// selects and whether each path actually works in production.

function hasGatewayKey(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY?.trim());
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export async function GET() {
  const out: Record<string, unknown> = {
    hasOpenAIApiKey: hasOpenAIApiKey(),
    hasGatewayKey: hasGatewayKey(),
    AI_MODEL: process.env.AI_MODEL ?? null,
    OPENAI_CHAT_PROVIDER: process.env.OPENAI_CHAT_PROVIDER ?? null,
    // assessSession's default preferOpenAiSdk(): hasOpenAIApiKey() && !hasGatewayKey()
    assessmentPrefersOpenAiSdk: hasOpenAIApiKey() && !hasGatewayKey(),
  };

  try {
    const r = await openAIService.chat({
      messages: [
        { role: "system", content: "Return a single JSON object only." },
        { role: "user", content: 'Return {"ok":true}' },
      ],
      temperature: 0.3,
      maxCompletionTokens: 1200,
    });
    out.openaiSdkPath = { ok: true, text: r.text.slice(0, 200) };
  } catch (e) {
    out.openaiSdkPath = { ok: false, error: msg(e) };
  }

  const gwModel = process.env.AI_MODEL || "openai/gpt-4o-mini";
  try {
    const { text } = await generateText({
      model: gwModel,
      system: "Return a single JSON object only.",
      prompt: 'Return {"ok":true}',
      temperature: 0.3,
    });
    out.gatewayPath = { ok: true, model: gwModel, text: text.slice(0, 200) };
  } catch (e) {
    out.gatewayPath = { ok: false, model: gwModel, error: msg(e) };
  }

  return NextResponse.json(out);
}
