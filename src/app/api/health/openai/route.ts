import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
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

  const status = await openAIService.healthCheck();
  return NextResponse.json(status, { status: status.ok ? 200 : 503 });
}
