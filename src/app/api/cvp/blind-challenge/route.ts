import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { clientSafeError } from "@/lib/api-errors";
import { parseBlindCondition, parseLikert } from "@/lib/ppp";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** POST — Blind Psychiatrist Challenge score (enrolled blind_scorer or admin). */
export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(`cvp-blind:${auth.user.id}`, 40, 60 * 60 * 1000);
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

  const studyId = typeof body.studyId === "string" ? body.studyId : null;
  const overall = parseLikert(body.overallRealism);
  if (!studyId || !overall) {
    return NextResponse.json(
      { error: "studyId and overallRealism (1–5) required" },
      { status: 400 },
    );
  }

  if (auth.profile.role !== "admin") {
    const { data: enr } = await auth.supabase
      .from("cvp_enrollments")
      .select("id, role_in_study")
      .eq("study_id", studyId)
      .eq("profile_id", auth.user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!enr || !["blind_scorer", "supervisor", "reviewer"].includes(enr.role_in_study)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Scorers submit without seeing condition; store claimed/unknown until reveal
  const condition =
    auth.profile.role === "admin"
      ? (parseBlindCondition(body.blindCondition) ?? "ai_patient")
      : "unknown";

  const { data, error } = await auth.supabase
    .from("cvp_blind_challenges")
    .insert({
      study_id: studyId,
      assignment_id:
        typeof body.assignmentId === "string" ? body.assignmentId : null,
      session_id: typeof body.sessionId === "string" ? body.sessionId : null,
      scorer_id: auth.user.id,
      condition_code: condition,
      revealed: false,
      overall_realism: overall,
      would_use_in_training:
        typeof body.wouldUseInTraining === "boolean"
          ? body.wouldUseInTraining
          : null,
      free_text:
        typeof body.freeText === "string"
          ? body.freeText.trim().slice(0, 4000)
          : null,
      protocol_version: "1.0",
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
