import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { openAIService } from "@/lib/ai/openai";
import { rateLimit } from "@/lib/rate-limit";

/**
 * OpenAI SDK health check — admin only.
 * Avoids leaking provider configuration to all authenticated users.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limited = await rateLimit(`health-openai:${user.id}`, 30, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const status = await openAIService.healthCheck();
  return NextResponse.json(
    {
      ok: status.ok,
      configured: status.configured,
      // Do not return raw provider error bodies to the client.
      ...(status.ok ? {} : { error: "OpenAI health check failed" }),
    },
    { status: status.ok ? 200 : 503 },
  );
}
