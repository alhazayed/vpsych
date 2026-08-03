import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { sanitizeDbError } from "@/lib/safe-client-error";
import { getBuiltinGraph } from "@/lib/cge";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.cge.list",
    resourceType: "cge",
  });
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await rateLimit(`admin-cge:${user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const { data: learners } = await supabase
    .from("learner_profiles")
    .select(
      "id, user_id, profession, training_level, institution, completed_case_count, confidence_score, certification_status",
    )
    .order("updated_at", { ascending: false })
    .limit(100);

  const { data: plans } = await supabase
    .from("cge_remediation_plans")
    .select("id, learner_id, observed_failure, root_cause_id, status, created_at")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({
    learners: learners ?? [],
    activePlans: plans ?? [],
    graphMeta: {
      nodes: getBuiltinGraph().nodes.length,
      edges: getBuiltinGraph().edges.length,
      version: getBuiltinGraph().version,
    },
  });
}

export async function PATCH(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.cge.patch",
    resourceType: "cge",
  });
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await rateLimit(`admin-cge:${user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: {
    action?:
      | "lock"
      | "unlock"
      | "approve_mastery"
      | "require_reassessment"
      | "assign_remediation";
    learnerId?: string;
    competencyId?: string;
    observedFailure?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.learnerId || !body.competencyId) {
    return NextResponse.json(
      { error: "learnerId and competencyId required" },
      { status: 400 },
    );
  }
  if (body.competencyId.length > 128) {
    return NextResponse.json({ error: "competencyId too long" }, { status: 400 });
  }

  if (body.action === "lock" || body.action === "unlock") {
    const { error } = await supabase.from("learner_competencies").upsert(
      {
        learner_id: body.learnerId,
        competency_id: body.competencyId,
        locked: body.action === "lock",
        score: 70,
        samples: 0,
      },
      { onConflict: "learner_id,competency_id" },
    );
    if (error) {
      console.warn("[api]", error.message);
      return NextResponse.json({ error: sanitizeDbError(error.message) }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "approve_mastery") {
    const { error } = await supabase.from("learner_competencies").upsert(
      {
        learner_id: body.learnerId,
        competency_id: body.competencyId,
        instructor_approved: true,
        mastery_stage: "competent",
        score: 80,
        samples: 3,
      },
      { onConflict: "learner_id,competency_id" },
    );
    if (error) {
      console.warn("[api]", error.message);
      return NextResponse.json({ error: sanitizeDbError(error.message) }, { status: 500 });
    }
    await supabase.from("cge_mastery_history").insert({
      learner_id: body.learnerId,
      competency_id: body.competencyId,
      from_stage: "developing",
      to_stage: "competent",
      reason: "instructor_approved",
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "require_reassessment") {
    const { error } = await supabase
      .from("learner_competencies")
      .update({
        instructor_approved: false,
        mastery_stage: "developing",
      })
      .eq("learner_id", body.learnerId)
      .eq("competency_id", body.competencyId);
    if (error) {
      console.warn("[api]", error.message);
      return NextResponse.json({ error: sanitizeDbError(error.message) }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "assign_remediation") {
    const observed =
      typeof body.observedFailure === "string" && body.observedFailure.trim()
        ? body.observedFailure.trim().slice(0, 500)
        : body.competencyId;
    const { data: plan, error } = await supabase
      .from("cge_remediation_plans")
      .insert({
        learner_id: body.learnerId,
        observed_failure: observed,
        root_cause_id: body.competencyId,
        pathway: [body.competencyId],
        recommended_cases: [],
        status: "active",
      })
      .select("id")
      .single();
    if (error) {
      console.warn("[admin/cge] assign_remediation:", error.message);
      return NextResponse.json(
        { error: sanitizeDbError(error.message) },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, planId: plan?.id });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
