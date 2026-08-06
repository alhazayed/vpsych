import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { clientSafeError } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ studyId: string }> };

/** POST — attach institution as a study site. */
export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireApiAdmin(request, {
    action: "admin.cvp.study_site",
    resourceType: "cvp_study_institutions",
  });
  if (!auth.ok) return auth.response;

  const { studyId } = await ctx.params;
  const limited = await rateLimit(`cvp-site:${auth.user.id}`, 40, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: { institutionId?: string; siteCode?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.institutionId || !body.siteCode?.trim()) {
    return NextResponse.json(
      { error: "institutionId and siteCode are required" },
      { status: 400 },
    );
  }

  const { data, error } = await auth.supabase
    .from("cvp_study_institutions")
    .upsert(
      {
        study_id: studyId,
        institution_id: body.institutionId,
        site_code: body.siteCode.trim().toUpperCase(),
        is_active: true,
      },
      { onConflict: "study_id,institution_id" },
    )
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: clientSafeError("Could not attach site", error) },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, site: data });
}
