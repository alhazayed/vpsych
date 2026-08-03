import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApiAdmin } from "@/lib/api-auth";
import { sanitizeDbError } from "@/lib/safe-client-error";
import {
  buildCohortAnalytics,
  cohortToCsv,
  cohortToExcelCsv,
  cohortToPdf,
  cohortToResearchDataset,
  type LearnerRow,
} from "@/lib/learning-analytics";

async function loadLearnerRows(
  supabase: SupabaseClient,
): Promise<LearnerRow[]> {
  const { data: learners, error } = await supabase
    .from("learner_profiles")
    .select(
      "id, user_id, profession, training_level, institution, completed_case_count, confidence_score, learning_velocity, certification_status, metadata",
    )
    .order("updated_at", { ascending: false })
    .limit(500);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (learners ?? []) as Array<Record<string, unknown>>;
  const ids = rows.map((r) => String(r.id));
  let comps: Array<{
    learner_id: string;
    competency_id: string;
    score: number;
    samples: number;
  }> = [];
  if (ids.length) {
    const { data } = await supabase
      .from("learner_competencies")
      .select("learner_id, competency_id, score, samples")
      .in("learner_id", ids);
    comps = (data as typeof comps) ?? [];
  }

  const byLearner = new Map<string, typeof comps>();
  for (const c of comps) {
    const list = byLearner.get(c.learner_id) ?? [];
    list.push(c);
    byLearner.set(c.learner_id, list);
  }

  return rows.map((r) => {
    const meta = (r.metadata as Record<string, unknown>) ?? {};
    return {
      id: String(r.id),
      user_id: String(r.user_id),
      profession: String(r.profession ?? "unknown"),
      training_level: String(r.training_level ?? "unknown"),
      institution: (r.institution as string) ?? null,
      completed_case_count: Number(r.completed_case_count ?? 0),
      confidence_score: Number(r.confidence_score ?? 0),
      learning_velocity: Number(r.learning_velocity ?? 0),
      certification_status: String(r.certification_status ?? "not_started"),
      competencies: (byLearner.get(String(r.id)) ?? []).map((c) => ({
        competency_id: c.competency_id,
        score: Number(c.score),
        samples: Number(c.samples),
      })),
      metadata: meta,
      instructor_id: (meta.instructor_id as string) ?? null,
    };
  });
}

export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.analytics.cohort",
    resourceType: "learning_analytics",
  });
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const url = new URL(request.url);
  const format = (url.searchParams.get("format") ?? "json").toLowerCase();
  const view = (url.searchParams.get("view") ?? "executive").toLowerCase();

  try {
    const rows = await loadLearnerRows(supabase);
    const cohort = buildCohortAnalytics(rows);

    if (format === "csv") {
      return new NextResponse(cohortToCsv(cohort), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="vpsych-learning-analytics.csv"',
        },
      });
    }
    if (format === "excel" || format === "xlsx") {
      return new NextResponse(cohortToExcelCsv(cohort), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="vpsych-learning-analytics-excel.csv"',
        },
      });
    }
    if (format === "pdf") {
      const pdf = cohortToPdf(cohort);
      return new NextResponse(Buffer.from(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition":
            'attachment; filename="vpsych-learning-analytics.pdf"',
        },
      });
    }
    if (format === "research") {
      return NextResponse.json(cohortToResearchDataset(cohort));
    }

    return NextResponse.json({
      view,
      cohort,
      dashboards: {
        executive: {
          learner_count: cohort.learner_count,
          mean_confidence: cohort.mean_confidence,
          mean_velocity: cohort.mean_velocity,
          mastery_ready_count: cohort.mastery_ready_count,
          at_risk_count: cohort.risk_learners.length,
        },
        institution: cohort.institutions,
        instructor: cohort.instructors,
        research: {
          competency_benchmarks: cohort.competency_benchmarks,
          longitudinal: cohort.longitudinal,
          schema: "vpsych-learning-analytics-1.0",
        },
        risk_learners: cohort.risk_learners,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "analytics failed";
    console.warn("[admin/analytics]", msg);
    return NextResponse.json({ error: sanitizeDbError(msg) }, { status: 500 });
  }
}
