import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { clientSafeError } from "@/lib/api-errors";
import {
  invitationExpiresAt,
  mintInvitationToken,
} from "@/lib/cvp";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ studyId: string }> };

/** POST — create invitation for a study. Returns plaintext token once. */
export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireApiAdmin(request, {
    action: "admin.cvp.invite",
    resourceType: "cvp_invitations",
  });
  if (!auth.ok) return auth.response;

  const { studyId } = await ctx.params;
  const limited = await rateLimit(`cvp-invite:${auth.user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: {
    email?: string;
    institutionId?: string;
    roleInStudy?: string;
    expiresInDays?: number;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const { token, tokenHash } = mintInvitationToken();
  const { data, error } = await auth.supabase
    .from("cvp_invitations")
    .insert({
      study_id: studyId,
      institution_id: body.institutionId || null,
      email,
      token_hash: tokenHash,
      role_in_study: body.roleInStudy || "reviewer",
      invited_by: auth.user.id,
      expires_at: invitationExpiresAt(body.expiresInDays ?? 21),
      status: "pending",
    })
    .select("id, email, role_in_study, expires_at, status")
    .single();

  if (error) {
    return NextResponse.json(
      { error: clientSafeError("Could not create invitation", error) },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    invitation: data,
    /** Plaintext token — show once; store hash only. */
    token,
    acceptPath: `/validation/accept?token=${token}`,
  });
}

/** GET — list invitations for a study. */
export async function GET(request: Request, ctx: Ctx) {
  const auth = await requireApiAdmin(request, {
    action: "admin.cvp.invite.list",
    resourceType: "cvp_invitations",
  });
  if (!auth.ok) return auth.response;

  const { studyId } = await ctx.params;
  const { data, error } = await auth.supabase
    .from("cvp_invitations")
    .select(
      "id, email, role_in_study, status, expires_at, accepted_at, institution_id, created_at",
    )
    .eq("study_id", studyId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: clientSafeError("Could not list invitations", error) },
      { status: 500 },
    );
  }
  return NextResponse.json({ invitations: data ?? [] });
}
