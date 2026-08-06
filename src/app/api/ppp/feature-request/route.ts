import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { clientSafeError } from "@/lib/api-errors";
import { parseBoundedText, parseTheme } from "@/lib/ppp";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** POST — submit a feature request for preview aggregation. */
export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(`ppp-fr:${auth.user.id}`, 30, 60 * 60 * 1000);
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

  const title = parseBoundedText(body.title, 3, 200);
  const description = parseBoundedText(body.description, 10, 4000);
  const theme = parseTheme(body.theme) ?? "general";

  if (!title || !description) {
    return NextResponse.json(
      { error: "title (3–200) and description (10–4000) are required" },
      { status: 400 },
    );
  }

  const { data, error } = await auth.supabase
    .from("ppp_feature_requests")
    .insert({
      reporter_id: auth.user.id,
      title,
      description,
      theme,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { error: clientSafeError("Could not submit feature request", error) },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, id: data.id });
}
