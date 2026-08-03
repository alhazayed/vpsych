import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  calculateMastery,
  getBuiltinGraph,
  getLearnerGraph,
  statesFromAceCompetencies,
  updateCompetencyScore,
} from "@/lib/cge";
import { ensureLearnerProfile } from "@/lib/ace/persist";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeDbError } from "@/lib/safe-client-error";

/** Calculate mastery stages for the authenticated learner (or admin target). */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`cge-mastery:${user.id}`, 40, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const url = new URL(request.url);
  const targetUserId = url.searchParams.get("userId");
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const userId =
    targetUserId && me?.role === "admin" ? targetUserId : user.id;
  const profile = await ensureLearnerProfile(supabase, userId);
  const graph = getBuiltinGraph();
  const states = statesFromAceCompetencies(profile.competencies, graph);
  const learner = getLearnerGraph(profile.id, states, graph);

  return NextResponse.json({
    ok: true,
    learner_id: profile.id,
    mastery: learner.nodes.map((s) => ({
      competency_id: s.competency_id,
      score: s.score,
      samples: s.samples,
      stage: s.stage,
      confidence: s.confidence,
      locked: s.locked,
      instructor_approved: s.instructor_approved,
    })),
    blocked: learner.blocked,
    mastered: learner.mastered,
    at_risk_of_decay: learner.at_risk_of_decay,
  });
}

/** Update a competency score, persist evidence, return propagated graph state. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`cge-mastery:${user.id}`, 40, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const body = (await request.json()) as {
    competencyId?: string;
    score?: number;
  };
  if (!body.competencyId || typeof body.score !== "number") {
    return NextResponse.json(
      { error: "competencyId and score required" },
      { status: 400 },
    );
  }
  if (body.score < 0 || body.score > 100) {
    return NextResponse.json({ error: "score must be 0–100" }, { status: 400 });
  }

  const profile = await ensureLearnerProfile(supabase, user.id);
  const graph = getBuiltinGraph();
  const states = statesFromAceCompetencies(profile.competencies, graph);
  const prior = states.find((s) => s.competency_id === body.competencyId);
  if (prior?.locked) {
    return NextResponse.json(
      { error: "Competency is locked by instructor" },
      { status: 423 },
    );
  }

  const next = updateCompetencyScore(
    states,
    body.competencyId,
    body.score,
    graph,
  );
  const target = next.find((s) => s.competency_id === body.competencyId);
  const byId = new Map(next.map((s) => [s.competency_id, s]));
  const stage = target
    ? calculateMastery(target, graph, byId)
    : "not_attempted";

  // Persist under service role when available (learner UPDATE RLS is locked).
  const writer = createServiceClient() ?? supabase;
  if (target) {
    const { error: upErr } = await writer.from("learner_competencies").upsert(
      {
        learner_id: profile.id,
        competency_id: body.competencyId,
        score: target.score,
        samples: target.samples,
        trend: target.trend,
        confidence: target.confidence,
        mastery_stage: stage,
        last_assessed_at: target.last_practiced_at ?? new Date().toISOString(),
        locked: target.locked,
        instructor_approved: target.instructor_approved,
      },
      { onConflict: "learner_id,competency_id" },
    );
    if (upErr) {
      console.warn("[cge-mastery] upsert:", upErr.message);
      return NextResponse.json(
        { error: sanitizeDbError(upErr.message) },
        { status: 500 },
      );
    }
    await writer.from("cge_attempts").insert({
      learner_id: profile.id,
      competency_id: body.competencyId,
      score: body.score,
      evidence: { source: "cge_mastery_api" },
    });
    if (prior && prior.stage !== stage) {
      await writer.from("cge_mastery_history").insert({
        learner_id: profile.id,
        competency_id: body.competencyId,
        from_stage: prior.stage,
        to_stage: stage,
        reason: "score_update",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    competency_id: body.competencyId,
    stage,
    states: next,
    persisted: true,
  });
}
