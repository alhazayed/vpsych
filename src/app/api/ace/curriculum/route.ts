import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  generateCurriculum,
  generateLearningPlan,
  generateSupervisorFeedback,
} from "@/lib/ace";
import { ensureLearnerProfile } from "@/lib/ace/persist";
import { rateLimit } from "@/lib/rate-limit";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`ace-curriculum:${user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const profile = await ensureLearnerProfile(supabase, user.id);
  const curriculum = generateCurriculum(profile);
  const plan = generateLearningPlan(profile);

  const { data: feedback } = await supabase
    .from("coach_feedback")
    .select("*")
    .eq("learner_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(5);

  return NextResponse.json({
    curriculum,
    plan,
    recentCoachFeedback: feedback ?? [],
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`ace-curriculum:${user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const body = (await request.json()) as {
    action?: "curriculum" | "plan" | "coach";
    overallScore?: number;
  };

  const profile = await ensureLearnerProfile(supabase, user.id);

  if (body.action === "coach") {
    const coach = generateSupervisorFeedback(profile, {
      overallScore: body.overallScore ?? 60,
      competencyScores: {},
    });
    return NextResponse.json({ ok: true, coach });
  }

  if (body.action === "plan") {
    return NextResponse.json({
      ok: true,
      plan: generateLearningPlan(profile),
    });
  }

  const curriculum = generateCurriculum(profile);
  // Persist learning path when DB available
  const { data: pathRow, error } = await supabase
    .from("learning_paths")
    .insert({
      learner_id: profile.id,
      slug: curriculum.slug,
      name: curriculum.name,
      focus_competency_id: curriculum.focus_competency_id,
      status: "active",
      steps: curriculum.steps,
      current_step: curriculum.current_step,
      created_by: user.id,
    })
    .select("*")
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    curriculum: pathRow ?? curriculum,
    persisted: !error,
  });
}
