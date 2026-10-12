import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  analyzeRootCause,
  generateLearningPathFromGraph,
  recommendNextCases,
  statesFromAceCompetencies,
  buildSupervisorReport,
} from "@/lib/cge";
import { ensureLearnerProfile } from "@/lib/ace/persist";
import { rateLimit } from "@/lib/rate-limit";

const RCA_ACTIONS = ["rca", "remediation", "next", "supervisor", "mastery"] as const;
type RcaAction = (typeof RCA_ACTIONS)[number];

function isRcaAction(value: unknown): value is RcaAction {
  return (RCA_ACTIONS as readonly unknown[]).includes(value);
}

/** Graph node ids are snake_case slugs (`diagnostic_interview`). */
function isCompetencyNodeId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9_]{0,63}$/.test(value);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`cge-rca:${user.id}`, 40, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    observedFailure?: unknown;
    action?: unknown;
  } | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (
    body.observedFailure !== undefined &&
    !isCompetencyNodeId(body.observedFailure)
  ) {
    return NextResponse.json({ error: "Invalid competency" }, { status: 400 });
  }
  if (body.action !== undefined && !isRcaAction(body.action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const profile = await ensureLearnerProfile(supabase, user.id);
  const states = statesFromAceCompetencies(profile.competencies);
  const observed =
    body.observedFailure ??
    [...states]
      .filter((s) => s.samples > 0)
      .sort((a, b) => a.score - b.score)[0]?.competency_id ??
    "diagnostic_interview";

  if (body.action === "next") {
    return NextResponse.json({
      ok: true,
      next: recommendNextCases(profile.id, states, observed),
    });
  }

  if (body.action === "remediation") {
    const plan = generateLearningPathFromGraph(profile.id, states, observed);
    await supabase.from("cge_remediation_plans").insert({
      learner_id: profile.id,
      observed_failure: plan.observed_failure,
      root_cause_id: plan.root_cause_id,
      pathway: plan.pathway,
      recommended_cases: plan.recommended_cases,
      status: "active",
    });
    return NextResponse.json({ ok: true, plan });
  }

  if (body.action === "supervisor") {
    return NextResponse.json({
      ok: true,
      report: buildSupervisorReport(profile.id, states, observed),
    });
  }

  const rca = analyzeRootCause(observed, states);
  return NextResponse.json({ ok: true, rca });
}
