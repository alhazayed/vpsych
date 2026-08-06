import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { clientSafeError } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** GET — list CVP studies. POST — create study (admin). */
export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.cvp.studies.list",
    resourceType: "cvp_studies",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(`cvp-studies:${auth.user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const { data, error } = await auth.supabase
    .from("cvp_studies")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({
      studies: [],
      warning: error.message.includes("does not exist")
        ? "CVP migration not applied"
        : error.message,
    });
  }
  return NextResponse.json({ studies: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.cvp.studies.create",
    resourceType: "cvp_studies",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(`cvp-studies-w:${auth.user.id}`, 30, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: {
    slug?: string;
    title?: string;
    irbReference?: string;
    description?: string;
    consortRegistered?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = body.slug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const title = body.title?.trim();
  if (!slug || !title) {
    return NextResponse.json(
      { error: "slug and title are required" },
      { status: 400 },
    );
  }

  const { data, error } = await auth.supabase
    .from("cvp_studies")
    .insert({
      slug,
      title,
      irb_reference: body.irbReference?.trim() || null,
      description: body.description?.trim() || null,
      consort_registered: Boolean(body.consortRegistered),
      status: "draft",
      created_by: auth.user.id,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: clientSafeError("Could not create study", error) },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, study: data });
}
