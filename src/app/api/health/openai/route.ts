import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { openAIService } from "@/lib/ai/openai";

/**
 * OpenAI SDK health check — admin only.
 * Exposes provider/config readiness; must not be anonymously reachable.
 */
export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "health.openai",
    resourceType: "health",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(`health-openai:${auth.user.id}`, 30, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const status = await openAIService.healthCheck();
  // Never return raw provider error strings to the client.
  const safe = {
    ok: status.ok,
    configured: status.configured,
    provider: status.provider,
    chatModel: status.chatModel,
    sttModel: status.sttModel,
    checkedAt: status.checkedAt,
    latencyMs: status.latencyMs,
    code: status.code ?? null,
    error: status.ok
      ? null
      : status.configured
        ? "OpenAI health probe failed"
        : "OpenAI is not configured",
  };
  if (!status.ok && status.error) {
    console.warn("[health/openai]", status.code, status.error);
  }
  return NextResponse.json(safe, { status: status.ok ? 200 : 503 });
}
