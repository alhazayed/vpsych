import { NextResponse } from "next/server";
import { requireInstitutionPermission } from "@/lib/api-auth";
import {
  assertNoPiiKeys,
  buildAnonymousResearchExport,
  type IdentifiedSessionInput,
} from "@/lib/enterprise/research-export";
import { logSecurityEvent } from "@/lib/security-audit";

export const dynamic = "force-dynamic";

/**
 * Institution-scoped anonymous research export.
 * Never dumps global sessions — filters by sessions.institution_id and/or
 * memberships for the institution.
 */
export async function POST(request: Request) {
  let body: {
    salt?: string;
    version_lock?: string;
    include_competency_scores?: boolean;
    include_timestamps?: boolean;
    rows?: IdentifiedSessionInput[];
    institution_id?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const institutionId = String(body.institution_id ?? "").trim();
  const auth = await requireInstitutionPermission(request, {
    permission: "research.export",
    institutionId,
    action: "faculty.research.export",
    resourceType: "research_export",
  });
  if (!auth.ok) return auth.response;

  const salt = body.salt?.trim();
  if (!salt || salt.length < 8) {
    return NextResponse.json(
      {
        error:
          "salt is required (min 8 chars) for irreversible subject hashing",
      },
      { status: 400 },
    );
  }

  const { data: memberIds } = await auth.supabase
    .from("institution_memberships")
    .select("user_id")
    .eq("institution_id", institutionId)
    .eq("is_active", true);
  const userIds = [
    ...new Set((memberIds ?? []).map((m) => m.user_id as string)),
  ];
  const allowed = new Set(userIds);

  let rows = body.rows ?? [];
  if (rows.length) {
    rows = rows.filter((r) => allowed.has(r.user_id));
  } else {
    const { data: byTenant } = await auth.supabase
      .from("sessions")
      .select("id, therapist_id, started_at, ended_at, language")
      .eq("institution_id", institutionId)
      .order("started_at", { ascending: false })
      .limit(500);

    let sessions = byTenant ?? [];
    if (!sessions.length && userIds.length) {
      const { data: byMembers } = await auth.supabase
        .from("sessions")
        .select("id, therapist_id, started_at, ended_at, language")
        .in("therapist_id", userIds)
        .order("started_at", { ascending: false })
        .limit(500);
      sessions = byMembers ?? [];
    }

    rows = sessions.map((s) => ({
      user_id: s.therapist_id as string,
      session_id: s.id as string,
      locale: (s as { language?: string }).language ?? null,
      difficulty: null,
      started_at: s.started_at as string,
      ended_at: (s.ended_at as string) ?? null,
    }));
  }

  const payload = buildAnonymousResearchExport(rows, {
    salt,
    version_lock:
      body.version_lock ??
      "case-engine:v2+cge:v3+templates:v1+enterprise:m23",
    include_competency_scores: body.include_competency_scores ?? true,
    include_timestamps: body.include_timestamps ?? false,
  });

  const pii = assertNoPiiKeys(payload);
  if (pii.length) {
    return NextResponse.json(
      { error: "PII keys detected in export", keys: pii },
      { status: 500 },
    );
  }

  await logSecurityEvent({
    action: "faculty.research.export",
    outcome: "success",
    resourceType: "institution",
    resourceId: institutionId,
    metadata: { row_count: payload.row_count },
    request,
  });

  return NextResponse.json({
    ...payload,
    institution_id: institutionId,
  });
}
