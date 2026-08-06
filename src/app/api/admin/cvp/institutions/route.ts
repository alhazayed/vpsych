import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { clientSafeError } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** GET — list institutions for CVP site management. */
export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.cvp.institutions.list",
    resourceType: "institutions",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(`cvp-inst:${auth.user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const { data, error } = await auth.supabase
    .from("institutions")
    .select("id, slug, name, country_code, locale_default, is_active, created_at")
    .order("name");

  if (error) {
    return NextResponse.json(
      { error: clientSafeError("Could not list institutions", error) },
      { status: 500 },
    );
  }
  return NextResponse.json({ institutions: data ?? [] });
}

/** POST — create institution (admin). */
export async function POST(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.cvp.institutions.create",
    resourceType: "institutions",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(`cvp-inst-w:${auth.user.id}`, 30, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: {
    slug?: string;
    name?: string;
    countryCode?: string;
    localeDefault?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = body.slug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const name = body.name?.trim();
  if (!slug || !name) {
    return NextResponse.json(
      { error: "slug and name are required" },
      { status: 400 },
    );
  }

  const { data, error } = await auth.supabase
    .from("institutions")
    .insert({
      slug,
      name,
      country_code: body.countryCode?.trim() || "US",
      locale_default: body.localeDefault?.trim() || "en-US",
      is_active: true,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: clientSafeError("Could not create institution", error) },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, institution: data });
}
