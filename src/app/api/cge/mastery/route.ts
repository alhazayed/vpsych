import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  calculateMastery,
  getBuiltinGraph,
  statesFromAceCompetencies,
  updateCompetencyScore,
} from "@/lib/cge";
import { ensureLearnerProfile } from "@/lib/ace/persist";
import { rateLimit } from "@/lib/rate-limit";

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
  const byId = new Map(states.map((s) => [s.competency_id, s]));

  const mastery = states.map((s) => ({
    competency_id: s.competency_id,
    score: s.score,
    samples: s.samples,
    stage: calculateMastery(s, graph, byId),
    confidence: s.confidence,
  }));

  return NextResponse.json({ ok: true, learner_id: profile.id, mastery });
}

/**
 * Preview mastery propagation for a hypothetical score update.
 * Learner writes are locked by RLS — persistence happens via session assessment
 * (ACE) or admin CGE routes. This endpoint never mutates the database.
 */
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

  let body: { competencyId?: string; score?: number };
  try {
    body = (await request.json()) as {
      competencyId?: string;
      score?: number;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (
    !body.competencyId ||
    typeof body.competencyId !== "string" ||
    body.competencyId.length > 128 ||
    typeof body.score !== "number" ||
    !Number.isFinite(body.score)
  ) {
    return NextResponse.json(
      { error: "competencyId and numeric score required" },
      { status: 400 },
    );
  }
  if (body.score < 0 || body.score > 100) {
    return NextResponse.json(
      { error: "score must be between 0 and 100" },
      { status: 400 },
    );
  }

  const profile = await ensureLearnerProfile(supabase, user.id);
  const graph = getBuiltinGraph();
  const states = statesFromAceCompetencies(profile.competencies, graph);
  const next = updateCompetencyScore(
    states,
    body.competencyId,
    body.score,
    graph,
  );
  const target = next.find((s) => s.competency_id === body.competencyId);
  const byId = new Map(next.map((s) => [s.competency_id, s]));

  return NextResponse.json({
    ok: true,
    preview: true,
    persisted: false,
    competency_id: body.competencyId,
    stage: target
      ? calculateMastery(target, graph, byId)
      : "not_attempted",
    states: next,
  });
}
