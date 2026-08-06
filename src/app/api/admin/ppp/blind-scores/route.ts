import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { clientSafeError } from "@/lib/api-errors";
import {
  parseBlindCondition,
  parseBoundedText,
  parseLikert,
} from "@/lib/ppp";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** POST — record a blind psychiatrist protocol score (admin/scorer). */
export async function POST(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.ppp.blind_score",
    resourceType: "ppp_blind_scores",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-ppp-blind:${auth.user.id}`,
    40,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const overall = parseLikert(body.overallRealism);
  const condition = parseBlindCondition(body.blindCondition) ?? "ai_patient";
  if (!overall) {
    return NextResponse.json(
      { error: "overallRealism (1–5) is required" },
      { status: 400 },
    );
  }

  const freeText = parseBoundedText(body.freeText ?? "n/a", 1, 4000);
  const sessionId =
    typeof body.sessionId === "string" && body.sessionId.length > 0
      ? body.sessionId
      : null;

  const { data, error } = await auth.supabase
    .from("ppp_blind_scores")
    .insert({
      session_id: sessionId,
      scorer_id: auth.user.id,
      protocol_version: "1.0",
      blind_condition: condition,
      overall_realism: overall,
      would_use_in_training:
        typeof body.wouldUseInTraining === "boolean"
          ? body.wouldUseInTraining
          : null,
      free_text: freeText === "n/a" ? null : freeText,
      metadata:
        body.metadata && typeof body.metadata === "object"
          ? body.metadata
          : {},
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { error: clientSafeError("Could not save blind score", error) },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, id: data.id });
}
