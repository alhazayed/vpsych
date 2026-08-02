import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getBuiltinGraph,
  getLearnerGraph,
  statesFromAceCompetencies,
  topologicalOrder,
} from "@/lib/cge";
import { ensureLearnerProfile } from "@/lib/ace/persist";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const learnerMode = url.searchParams.get("learner") !== "0";
  const targetUserId = url.searchParams.get("userId");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const graph = getBuiltinGraph();

  // Prefer DB nodes/edges when available
  const { data: dbNodes } = await supabase.from("cge_nodes").select("*");
  const { data: dbEdges } = await supabase
    .from("cge_edges")
    .select("from_competency_id, to_competency_id, edge_kind, weight, notes");

  const resolved =
    dbNodes && dbNodes.length
      ? {
          version: graph.version,
          nodes: dbNodes.map((n) => ({
            id: n.id,
            name: n.name,
            description: n.description ?? n.name,
            domain: n.domain,
            difficulty: n.difficulty,
            clinical_importance: Number(n.clinical_importance),
            learning_objectives: (n.learning_objectives as string[]) ?? [],
            assessment_methods: (n.assessment_methods as string[]) ?? [],
            mastery_threshold: Number(n.mastery_threshold),
            mastery_min_samples: Number(n.mastery_min_samples),
            recommended_resources: (n.recommended_resources as string[]) ?? [],
            estimated_training_hours: Number(n.estimated_training_hours),
            version: Number(n.version),
            enabled: Boolean(n.enabled),
            sort_order: Number(n.sort_order),
          })),
          edges: (dbEdges ?? []).map((e) => ({
            from: e.from_competency_id,
            to: e.to_competency_id,
            kind: e.edge_kind,
            weight: Number(e.weight),
            notes: e.notes ?? undefined,
          })),
        }
      : graph;

  if (!learnerMode) {
    return NextResponse.json({
      graph: resolved,
      topo: topologicalOrder(resolved),
      source: dbNodes?.length ? "database" : "builtin",
    });
  }

  const userId =
    targetUserId && me?.role === "admin" ? targetUserId : user.id;
  const profile = await ensureLearnerProfile(supabase, userId);
  const states = statesFromAceCompetencies(profile.competencies, resolved);
  const learnerGraph = getLearnerGraph(profile.id, states, resolved);

  return NextResponse.json({
    graph: resolved,
    learner: learnerGraph,
    topo: topologicalOrder(resolved),
    source: dbNodes?.length ? "database" : "builtin",
  });
}
