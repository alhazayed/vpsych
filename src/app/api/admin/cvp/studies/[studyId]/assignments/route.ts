import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { clientSafeError } from "@/lib/api-errors";
import { planRandomizedAllocations } from "@/lib/cvp";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ studyId: string }> };

/**
 * POST — create randomized avatar assignments for an enrollment.
 * Does not start a session; reviewer starts from assignment later.
 */
export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireApiAdmin(request, {
    action: "admin.cvp.assign",
    resourceType: "cvp_assignments",
  });
  if (!auth.ok) return auth.response;

  const { studyId } = await ctx.params;
  const limited = await rateLimit(`cvp-assign:${auth.user.id}`, 40, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: {
    enrollmentId?: string;
    count?: number;
    localePrefer?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.enrollmentId) {
    return NextResponse.json(
      { error: "enrollmentId is required" },
      { status: 400 },
    );
  }

  const { data: enrollment } = await auth.supabase
    .from("cvp_enrollments")
    .select("id, study_id")
    .eq("id", body.enrollmentId)
    .eq("study_id", studyId)
    .maybeSingle();

  if (!enrollment) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }

  const { data: avatars } = await auth.supabase
    .from("avatars")
    .select("id, disorder, available_locales")
    .eq("is_active", true);

  const plan = planRandomizedAllocations({
    studyId,
    enrollmentId: body.enrollmentId,
    avatars: avatars ?? [],
    count: Math.min(Math.max(body.count ?? 3, 1), 8),
    localePrefer: body.localePrefer,
  });

  if (plan.length === 0) {
    return NextResponse.json(
      { error: "No active avatars available for allocation" },
      { status: 400 },
    );
  }

  const rows = plan.map((p) => ({
    study_id: studyId,
    enrollment_id: body.enrollmentId!,
    avatar_id: p.avatar_id,
    allocation_arm: p.allocation_arm,
    allocation_seed: p.allocation_seed,
    sequence_index: p.sequence_index,
    status: "pending",
  }));

  const { data, error } = await auth.supabase
    .from("cvp_assignments")
    .insert(rows)
    .select("*");

  if (error) {
    return NextResponse.json(
      { error: clientSafeError("Could not create assignments", error) },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, assignments: data, plan });
}
