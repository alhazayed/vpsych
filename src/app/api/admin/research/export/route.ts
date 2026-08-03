import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  requireApiAdmin,
  requireInstitutionPermission,
} from "@/lib/api-auth";
import {
  assertNoPiiKeys,
  buildAnonymousResearchExport,
  type IdentifiedSessionInput,
} from "@/lib/enterprise/research-export";

export const dynamic = "force-dynamic";

type ExportBody = {
  salt?: string;
  version_lock?: string;
  include_competency_scores?: boolean;
  include_timestamps?: boolean;
  rows?: IdentifiedSessionInput[];
  institution_id?: string;
};

/**
 * Anonymous research export.
 * When institution_id is set, sessions are tenant-filtered (Mission 23).
 * Platform admin without institution_id must supply rows — never dumps all sessions.
 */
export async function POST(request: Request) {
  let body: ExportBody;
  try {
    body = (await request.json()) as ExportBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const institutionId = body.institution_id?.trim();

  if (institutionId) {
    const scoped = await requireInstitutionPermission(request, {
      permission: "research.export",
      institutionId,
      action: "admin.research.export",
      resourceType: "research_export",
    });
    if (!scoped.ok) return scoped.response;
    return runExport(scoped.supabase, body, institutionId);
  }

  const auth = await requireApiAdmin(request, {
    action: "admin.research.export",
    resourceType: "research_export",
  });
  if (!auth.ok) return auth.response;

  if (!body.rows?.length) {
    return NextResponse.json(
      {
        error:
          "institution_id or rows required — refusing unscoped global session dump",
      },
      { status: 400 },
    );
  }

  return runExport(auth.supabase, body, null);
}

async function runExport(
  supabase: SupabaseClient,
  body: ExportBody,
  institutionId: string | null,
) {
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

  let rows = body.rows ?? [];
  if (!rows.length && institutionId) {
    const { data: memberIds } = await supabase
      .from("institution_memberships")
      .select("user_id")
      .eq("institution_id", institutionId)
      .eq("is_active", true);
    const userIds = [
      ...new Set(
        ((memberIds ?? []) as Array<{ user_id: string }>).map((m) => m.user_id),
      ),
    ];

    const { data: byTenant } = await supabase
      .from("sessions")
      .select("id, therapist_id, started_at, ended_at, language, institution_id")
      .eq("institution_id", institutionId)
      .order("started_at", { ascending: false })
      .limit(500);

    type SessionRow = {
      id: string;
      therapist_id: string;
      started_at: string;
      ended_at?: string | null;
      language?: string;
    };

    let sessions = (byTenant ?? []) as SessionRow[];
    if (!sessions.length && userIds.length) {
      const { data: byMembers } = await supabase
        .from("sessions")
        .select(
          "id, therapist_id, started_at, ended_at, language, institution_id",
        )
        .in("therapist_id", userIds)
        .order("started_at", { ascending: false })
        .limit(500);
      sessions = (byMembers ?? []) as SessionRow[];
    }

    rows = sessions.map((s) => ({
      user_id: s.therapist_id,
      session_id: s.id,
      locale: s.language ?? null,
      difficulty: null,
      started_at: s.started_at,
      ended_at: s.ended_at ?? null,
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

  return NextResponse.json({
    ...payload,
    institution_id: institutionId,
  });
}
