import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { clientSafeError } from "@/lib/api-errors";
import {
  CVP_AGREEMENT_VERSION,
  CVP_CONSENT_VERSION,
  hashInvitationToken,
} from "@/lib/cvp";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** POST — accept invitation token and enroll as reviewer. */
export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(`cvp-accept:${auth.user.id}`, 20, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: {
    token?: string;
    credentials?: string;
    specialty?: string;
    acceptConsent?: boolean;
    acceptAgreement?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.token || !body.acceptConsent || !body.acceptAgreement) {
    return NextResponse.json(
      { error: "token, acceptConsent, and acceptAgreement are required" },
      { status: 400 },
    );
  }

  const tokenHash = hashInvitationToken(body.token);

  const { data, error } = await auth.supabase.rpc("accept_cvp_invitation", {
    p_token_hash: tokenHash,
    p_credentials: body.credentials?.trim() || null,
    p_specialty: body.specialty?.trim() || null,
    p_consent_version: CVP_CONSENT_VERSION,
    p_agreement_version: CVP_AGREEMENT_VERSION,
  });

  if (error) {
    const msg = error.message ?? "";
    const status = /not found|expired|not pending/i.test(msg) ? 400 : 500;
    return NextResponse.json(
      { error: clientSafeError("Could not accept invitation", error) },
      { status },
    );
  }

  // Best-effort PPP reviewer mirror for shared analytics
  await auth.supabase.from("ppp_reviewers").upsert(
    {
      profile_id: auth.user.id,
      credentials: body.credentials?.trim()?.slice(0, 200) || null,
      specialty: body.specialty?.trim()?.slice(0, 120) || null,
      agreement_version: CVP_AGREEMENT_VERSION,
      agreement_accepted_at: new Date().toISOString(),
      is_active: true,
      updated_at: new Date().toISOString(),
      cohort: "cvp",
    },
    { onConflict: "profile_id" },
  );

  return NextResponse.json({
    ok: true,
    result: data,
    consent_version: CVP_CONSENT_VERSION,
    agreement_version: CVP_AGREEMENT_VERSION,
  });
}
