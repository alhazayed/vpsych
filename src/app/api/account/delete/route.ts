import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { logSecurityEvent } from "@/lib/security-audit";
import { rateLimit } from "@/lib/rate-limit";

/**
 * GDPR Art. 17 erasure — deletes the auth user (cascades profile/sessions).
 * POST /api/account/delete  body: { confirm: "DELETE" }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`dsar-delete:${user.id}`, 5, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    confirm?: string;
  };
  if (body.confirm !== "DELETE") {
    return NextResponse.json(
      { error: 'Confirmation required: send { "confirm": "DELETE" }' },
      { status: 400 },
    );
  }

  const admin = createServiceClient();
  if (!admin) {
    await logSecurityEvent({
      action: "compliance.dsar.delete",
      outcome: "failure",
      resourceType: "account",
      resourceId: user.id,
      metadata: { reason: "service_role_unset" },
      request,
    });
    return NextResponse.json(
      {
        error:
          "Account deletion is temporarily unavailable. Contact your administrator or privacy@vpsych.app.",
      },
      { status: 503 },
    );
  }

  await logSecurityEvent({
    action: "compliance.dsar.delete",
    outcome: "success",
    resourceType: "account",
    resourceId: user.id,
    metadata: { email: user.email ?? null },
    request,
  });

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("[account/delete]", error.message);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 },
    );
  }

  await supabase.auth.signOut();

  return NextResponse.json({ ok: true, deleted: true });
}
