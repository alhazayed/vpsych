import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import {
  assertNoPiiKeys,
  buildAnonymousResearchExport,
  type IdentifiedSessionInput,
} from "@/lib/enterprise/research-export";

export const dynamic = "force-dynamic";

/**
 * Anonymous research export (platform admin / research-permissioned).
 * Strips user identifiers; hashes subject ids with institution salt.
 */
export async function POST(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.research.export",
    resourceType: "research_export",
  });
  if (!auth.ok) return auth.response;

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

  const salt = body.salt?.trim();
  if (!salt || salt.length < 8) {
    return NextResponse.json(
      { error: "salt is required (min 8 chars) for irreversible subject hashing" },
      { status: 400 },
    );
  }

  let rows = body.rows ?? [];
  if (!rows.length && body.institution_id) {
    // Pull recent session reports joined lightly — best-effort; empty OK.
    const { data: sessions } = await auth.supabase
      .from("sessions")
      .select("id, therapist_id, started_at, ended_at, locale, difficulty")
      .order("started_at", { ascending: false })
      .limit(200);

    rows = (sessions ?? []).map((s) => ({
      user_id: s.therapist_id as string,
      session_id: s.id as string,
      locale: (s as { locale?: string }).locale ?? null,
      difficulty: (s as { difficulty?: string }).difficulty ?? null,
      started_at: s.started_at as string,
      ended_at: (s.ended_at as string) ?? null,
    }));
  }

  const payload = buildAnonymousResearchExport(rows, {
    salt,
    version_lock:
      body.version_lock ?? "case-engine:v2+cge:v3+templates:v1+enterprise:m18",
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

  return NextResponse.json(payload);
}
