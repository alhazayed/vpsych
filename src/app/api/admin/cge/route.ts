import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBuiltinGraph } from "@/lib/cge";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { supabase, user };
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase } = auth as { supabase: Awaited<ReturnType<typeof createClient>> };

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
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;
  const { supabase } = auth as { supabase: Awaited<ReturnType<typeof createClient>> };

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
      return NextResponse.json({ error: error.message }, { status: 500 });
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
      return NextResponse.json({ error: error.message }, { status: 500 });
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
