import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { clientSafeError } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** POST — dismiss first-run onboarding panel. */
export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `ppp-onboard:${auth.user.id}`,
    20,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const { error } = await auth.supabase
    .from("profiles")
    .update({ onboarding_dismissed_at: new Date().toISOString() })
    .eq("id", auth.user.id);

  if (error) {
    return NextResponse.json(
      { error: clientSafeError("Could not update onboarding", error) },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
