import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { clientSafeError } from "@/lib/api-errors";
import { PPP_AGREEMENT_VERSION } from "@/lib/ppp";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** POST — enroll authenticated user as a Professional Preview reviewer. */
export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(`ppp-enroll:${auth.user.id}`, 10, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: {
    credentials?: string;
    specialty?: string;
    institution?: string;
    acceptAgreement?: boolean;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.acceptAgreement) {
    return NextResponse.json(
      { error: "Agreement acceptance is required" },
      { status: 400 },
    );
  }

  const { data, error } = await auth.supabase
    .from("ppp_reviewers")
    .upsert(
      {
        profile_id: auth.user.id,
        credentials: body.credentials?.trim()?.slice(0, 200) || null,
        specialty: body.specialty?.trim()?.slice(0, 120) || null,
        institution: body.institution?.trim()?.slice(0, 200) || null,
        agreement_version: PPP_AGREEMENT_VERSION,
        agreement_accepted_at: new Date().toISOString(),
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "profile_id" },
    )
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: clientSafeError("Could not enroll as reviewer", error) },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    reviewer: data,
    agreement_version: PPP_AGREEMENT_VERSION,
  });
}

/** GET — current enrollment status. */
export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  const { data } = await auth.supabase
    .from("ppp_reviewers")
    .select("*")
    .eq("profile_id", auth.user.id)
    .maybeSingle();

  return NextResponse.json({
    enrolled: Boolean(data?.is_active),
    reviewer: data ?? null,
    agreement_version: PPP_AGREEMENT_VERSION,
  });
}
