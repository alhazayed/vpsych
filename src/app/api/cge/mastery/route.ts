import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  calculateMastery,
  getBuiltinGraph,
  statesFromAceCompetencies,
  updateCompetencyScore,
} from "@/lib/cge";
import { ensureLearnerProfile } from "@/lib/ace/persist";

/** Calculate mastery stages for the authenticated learner (or admin target). */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

/** Update a competency score and return propagated graph state. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    competency_id: body.competencyId,
    stage: target
      ? calculateMastery(target, graph, byId)
      : "not_attempted",
    states: next,
  });
}
