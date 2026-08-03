import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { sanitizeDbError } from "@/lib/safe-client-error";
import { getBuiltinGraph } from "@/lib/cge";

export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.cge.list",
    resourceType: "cge",
  });
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

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

  const learnerIds = (learners ?? []).map((l) => l.id);
  let competencyRows: Array<{
    learner_id: string;
    competency_id: string;
    score: number;
    samples: number;
    mastery_stage: string | null;
  }> = [];
  if (learnerIds.length) {
    const { data } = await supabase
      .from("learner_competencies")
      .select("learner_id, competency_id, score, samples, mastery_stage")
      .in("learner_id", learnerIds)
      .gt("samples", 0);
    competencyRows = (data as typeof competencyRows) ?? [];
  }

  const mastered = competencyRows.filter(
    (r) =>
      r.mastery_stage === "competent" ||
      r.mastery_stage === "proficient" ||
      r.mastery_stage === "expert" ||
      (r.samples >= 3 && Number(r.score) >= 70),
  ).length;

  return NextResponse.json({
    learners: learners ?? [],
    activePlans: plans ?? [],
    institution: {
      learner_count: learners?.length ?? 0,
      institutions: [
        ...new Set(
          (learners ?? [])
            .map((l) => l.institution)
            .filter((x): x is string => Boolean(x)),
        ),
      ],
      assessed_competency_rows: competencyRows.length,
      mastered_competency_rows: mastered,
      active_remediation_plans: plans?.length ?? 0,
      mean_confidence:
        learners && learners.length
          ? Math.round(
              learners.reduce((a, l) => a + Number(l.confidence_score ?? 0), 0) /
                learners.length,
            )
          : 0,
    },
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
  const { supabase } = auth;

  const body = (await request.json()) as {
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

  if (!body.learnerId || !body.competencyId) {
    return NextResponse.json(
      { error: "learnerId and competencyId required" },
      { status: 400 },
    );
  }

  const { data: existing } = await supabase
    .from("learner_competencies")
    .select(
      "score, samples, mastery_stage, locked, instructor_approved, confidence",
    )
    .eq("learner_id", body.learnerId)
    .eq("competency_id", body.competencyId)
    .maybeSingle();

  if (body.action === "lock" || body.action === "unlock") {
    const { error } = await supabase.from("learner_competencies").upsert(
      {
        learner_id: body.learnerId,
        competency_id: body.competencyId,
        locked: body.action === "lock",
        // Preserve evidence — never reset on lock/unlock
        score: existing?.score ?? 70,
        samples: existing?.samples ?? 0,
        mastery_stage: existing?.mastery_stage ?? "not_attempted",
        confidence: existing?.confidence ?? 50,
        instructor_approved: existing?.instructor_approved ?? false,
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
    const fromStage = existing?.mastery_stage ?? "not_attempted";
    const { error } = await supabase.from("learner_competencies").upsert(
      {
        learner_id: body.learnerId,
        competency_id: body.competencyId,
        instructor_approved: true,
        mastery_stage: "competent",
        // Preserve real scores/samples; do not fabricate evidence
        score: existing?.score ?? 70,
        samples: existing?.samples ?? 0,
        confidence: existing?.confidence ?? 50,
        locked: existing?.locked ?? false,
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
      from_stage: fromStage,
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

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
