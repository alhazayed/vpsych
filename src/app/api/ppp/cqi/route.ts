import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { clientSafeError } from "@/lib/api-errors";
import {
  parseBoundedText,
  parseCategory,
  parseSeverity,
} from "@/lib/ppp";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** POST — submit a CQI (Continuous Quality Improvement) issue report. */
export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(`ppp-cqi:${auth.user.id}`, 40, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const severity = parseSeverity(body.severity);
  const category = parseCategory(body.category);
  const title = parseBoundedText(body.title, 3, 200);
  const description = parseBoundedText(body.description, 10, 4000);
  const sessionId =
    typeof body.sessionId === "string" && body.sessionId.length > 0
      ? body.sessionId
      : null;

  if (!severity || !category || !title || !description) {
    return NextResponse.json(
      {
        error:
          "severity, category, title (3–200), and description (10–4000) are required",
      },
      { status: 400 },
    );
  }

  const { data, error } = await auth.supabase
    .from("ppp_cqi_reports")
    .insert({
      reporter_id: auth.user.id,
      session_id: sessionId,
      severity,
      category,
      title,
      description,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { error: clientSafeError("Could not submit CQI report", error) },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, id: data.id });
}
