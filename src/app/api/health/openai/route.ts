import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { openAIService } from "@/lib/ai/openai";

/**
 * OpenAI SDK health check.
 *
 * Security: the full check issues an authenticated `models.list()` call to
 * OpenAI using the server key, so it must not be reachable anonymously
 * (unauthenticated cost/rate-limit amplification + config disclosure).
 *   - Unauthenticated → 401.
 *   - Authenticated non-admin → minimal liveness `{ ok, configured }` only.
 *   - Admin → full diagnostic detail (models, latency, upstream error).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`health:${user.id}`, 20, 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin = profile?.role === "admin";

  const status = await openAIService.healthCheck();

  if (!isAdmin) {
    // Non-admins get liveness only — never leak model ids or upstream errors.
    return NextResponse.json(
      { ok: status.ok, configured: status.configured },
      { status: status.ok ? 200 : 503 },
    );
  }

  return NextResponse.json(status, { status: status.ok ? 200 : 503 });
}
