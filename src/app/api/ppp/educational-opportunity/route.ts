import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { clientSafeError } from "@/lib/api-errors";
import { parseBoundedText, parseEoiType } from "@/lib/ppp";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** POST — submit Educational Opportunity feedback. */
export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(`ppp-eoi:${auth.user.id}`, 40, 60 * 60 * 1000);
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

  const opportunityType = parseEoiType(body.opportunityType);
  const title = parseBoundedText(body.title, 3, 200);
  const description = parseBoundedText(body.description, 10, 4000);
  const sessionId =
    typeof body.sessionId === "string" && body.sessionId.length > 0
      ? body.sessionId
      : null;
  const competencyArea =
    typeof body.competencyArea === "string"
      ? body.competencyArea.trim().slice(0, 120) || null
      : null;

  if (!opportunityType || !title || !description) {
    return NextResponse.json(
      {
        error:
          "opportunityType, title (3–200), and description (10–4000) are required",
      },
      { status: 400 },
    );
  }

  const { data, error } = await auth.supabase
    .from("ppp_educational_opportunities")
    .insert({
      reporter_id: auth.user.id,
      session_id: sessionId,
      opportunity_type: opportunityType,
      competency_area: competencyArea,
      title,
      description,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      {
        error: clientSafeError(
          "Could not submit educational opportunity",
          error,
        ),
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, id: data.id });
}
