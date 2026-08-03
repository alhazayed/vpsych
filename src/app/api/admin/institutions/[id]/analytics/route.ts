import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { buildInstitutionAnalytics } from "@/lib/enterprise/analytics";
import { getBuiltinInstitutionTree } from "@/lib/enterprise/catalog";
import type { AssignmentCompletion } from "@/lib/enterprise/types";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * Institution analytics for faculty/program directors (platform admin path).
 */
export async function GET(request: Request, ctx: RouteCtx) {
  const auth = await requireApiAdmin(request, {
    action: "admin.institutions.analytics",
    resourceType: "institutions",
  });
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const tree = getBuiltinInstitutionTree();

  const { data: assignments, error: aErr } = await auth.supabase
    .from("learning_assignments")
    .select("*")
    .eq("institution_id", id)
    .limit(500);

  const { data: completions, error: cErr } = await auth.supabase
    .from("assignment_completions")
    .select("*")
    .limit(2000);

  if (aErr || cErr) {
    // Offline / pre-migration fallback using builtin demo data
    const analytics = buildInstitutionAnalytics({
      institution_id: id || tree.institution.id,
      assignments: tree.assignments,
      completions: [] as AssignmentCompletion[],
      learners: [],
    });
    return NextResponse.json({
      analytics,
      source: "builtin",
      warning: aErr?.message ?? cErr?.message,
    });
  }

  const institutionCompletions = (completions ?? []).filter((c) =>
    (assignments ?? []).some((a) => a.id === c.assignment_id),
  );

  const userIds = [...new Set(institutionCompletions.map((c) => c.user_id))];
  const learners = userIds.map((user_id) => {
    const scores = institutionCompletions
      .filter((c) => c.user_id === user_id && c.score != null)
      .map((c) => Number(c.score));
    const required = (assignments ?? []).filter((a) => a.is_required);
    const completed_required = required.filter((a) =>
      institutionCompletions.some(
        (c) =>
          c.user_id === user_id &&
          c.assignment_id === a.id &&
          ["submitted", "passed", "failed"].includes(c.status),
      ),
    ).length;
    return {
      user_id,
      scores,
      completed_required,
      total_required: required.length,
    };
  });

  const analytics = buildInstitutionAnalytics({
    institution_id: id,
    assignments: (assignments ?? []) as never,
    completions: institutionCompletions as never,
    learners,
  });

  return NextResponse.json({ analytics, source: "database" });
}
