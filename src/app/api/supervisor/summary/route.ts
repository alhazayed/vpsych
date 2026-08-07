import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureLearnerProfile } from "@/lib/ace/persist";
import {
  buildSupervisorDashboard,
  listSupervisorBundlesForUser,
  runSupervisorEngine,
} from "@/lib/supervisor";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";

/**
 * GET /api/supervisor/summary — trainee supervisor façade.
 * Observational only. Never returns session_reports narrative/scores body.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`sup-summary:${user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  try {
    const stored = listSupervisorBundlesForUser(user.id);
    let bundle = stored[stored.length - 1] ?? null;

    if (!bundle) {
      // Synthesize a lightweight portfolio view from ACE profile alone.
      const profile = await ensureLearnerProfile(supabase, user.id);
      bundle = runSupervisorEngine({
        sessionId: `profile-view:${user.id}`,
        userId: user.id,
        overall: 50,
        items: [],
        messages: [],
        learnerProfile: profile,
      });
    }

    const dashboard = buildSupervisorDashboard({
      bundle,
      historyOveralls: stored.map(
        (b) => b.progress.overall_ema,
      ),
    });

    return NextResponse.json({
      ok: true,
      dashboard,
      heatmap: dashboard.competency_heatmap,
      certification: dashboard.certification_tracker,
      portfolio: {
        case_log: dashboard.portfolio.case_log.slice(-10),
        milestones: dashboard.portfolio.milestones,
        strength_evolution: dashboard.portfolio.strength_evolution.slice(0, 8),
        weakness_evolution: dashboard.portfolio.weakness_evolution.slice(0, 8),
      },
      reflective: bundle.reflective,
      feedback: {
        band: bundle.feedback.primary.band,
        summary: bundle.feedback.primary.summary,
        strengths: bundle.feedback.primary.strengths,
        growth_areas: bundle.feedback.primary.growth_areas,
        next_actions: bundle.feedback.primary.next_actions,
      },
      recommendations: bundle.recommendations.slice(0, 8),
      quality_gate_notes: dashboard.quality_gate_notes,
    });
  } catch (e) {
    console.warn(
      "[supervisor/summary]",
      e instanceof Error ? e.message : e,
    );
    return NextResponse.json(
      {
        error: clientSafeError(
          "Supervisor summary unavailable",
          e instanceof Error ? e : null,
        ),
      },
      { status: 500 },
    );
  }
}
