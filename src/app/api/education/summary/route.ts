import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureLearnerProfile } from "@/lib/ace/persist";
import {
  buildEducationAnalytics,
  buildTraineePortfolio,
  evaluateCertificationMilestone,
  generateEducationCurriculum,
  projectLongitudinalLearning,
} from "@/lib/education";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";

/**
 * GET /api/education/summary — trainee education façade over ACE profile.
 * Observational only. Never returns session_reports content.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`edu-summary:${user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  try {
    const profile = await ensureLearnerProfile(supabase, user.id);
    const milestone = evaluateCertificationMilestone(profile);
    const portfolio = buildTraineePortfolio({ profile });
    const analytics = buildEducationAnalytics({ profile });
    const longitudinal = projectLongitudinalLearning(profile, 100);
    const curriculum = generateEducationCurriculum(profile);

    return NextResponse.json({
      ok: true,
      milestone: milestone.milestone,
      milestoneRationale: milestone.rationale,
      portfolio,
      analytics,
      longitudinal: {
        current_milestone: longitudinal.current_milestone,
        velocity: longitudinal.velocity,
        plateau_detected: longitudinal.plateau_detected,
        regression_detected: longitudinal.regression_detected,
        mastery_count: longitudinal.mastery_count,
        points: longitudinal.points.filter(
          (p) =>
            p.sessions_completed === profile.completed_case_count ||
            [10, 25, 50, 100].includes(
              p.sessions_completed - profile.completed_case_count,
            ),
        ),
      },
      curriculum: {
        practice_focus: curriculum.practice_focus,
        micro_skills: curriculum.micro_skills,
        reading: curriculum.reading,
        cge_steps: curriculum.cge_steps.slice(0, 5),
        next_case: {
          difficulty: curriculum.next_case.difficulty,
          disorderSlug: curriculum.next_case.disorderSlug,
          focusCompetencies: curriculum.next_case.focusCompetencies,
          rationale: curriculum.next_case.rationale,
        },
        difficulty: curriculum.difficulty,
      },
    });
  } catch (e) {
    console.warn(
      "[education/summary]",
      e instanceof Error ? e.message : e,
    );
    return NextResponse.json(
      { error: clientSafeError("Education summary unavailable", e instanceof Error ? e : null) },
      { status: 500 },
    );
  }
}
