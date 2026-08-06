import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { clientSafeError } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ studyId: string }> };

/** POST — add calibration corpus item with expert scores. */
export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireApiAdmin(request, {
    action: "admin.cvp.calibration",
    resourceType: "cvp_calibration_items",
  });
  if (!auth.ok) return auth.response;

  const { studyId } = await ctx.params;
  const limited = await rateLimit(`cvp-cal:${auth.user.id}`, 40, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: {
    itemKey?: string;
    sessionId?: string;
    transcriptRef?: string;
    expertScores?: Record<string, unknown>;
    disorderSlug?: string;
    locale?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.itemKey?.trim() || !body.expertScores) {
    return NextResponse.json(
      { error: "itemKey and expertScores are required" },
      { status: 400 },
    );
  }

  const { data, error } = await auth.supabase
    .from("cvp_calibration_items")
    .upsert(
      {
        study_id: studyId,
        item_key: body.itemKey.trim(),
        session_id: body.sessionId || null,
        transcript_ref: body.transcriptRef || null,
        expert_scores: body.expertScores,
        disorder_slug: body.disorderSlug || null,
        locale: body.locale || null,
      },
      { onConflict: "study_id,item_key" },
    )
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { error: clientSafeError("Could not save calibration item", error) },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, id: data.id });
}
