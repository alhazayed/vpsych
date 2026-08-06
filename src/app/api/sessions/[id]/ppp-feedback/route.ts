import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { clientSafeError } from "@/lib/api-errors";
import { parseLikert, parseOptionalLikert } from "@/lib/ppp";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** POST — submit Professional Preview session ratings (1–5 Likert). */
export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  const { id: sessionId } = await ctx.params;

  const limited = await rateLimit(
    `ppp-rate:${auth.user.id}`,
    40,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const { data: session, error: sessionError } = await auth.supabase
    .from("sessions")
    .select("id, therapist_id, status, language")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (
    session.therapist_id !== auth.user.id &&
    auth.profile.role !== "admin"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (session.status !== "completed" && session.status !== "expired") {
    return NextResponse.json(
      { error: "Session must be completed before rating" },
      { status: 400 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const clinical_realism = parseLikert(body.clinicalRealism);
  const educational_value = parseLikert(body.educationalValue);
  const conversation_naturalness = parseLikert(body.conversationNaturalness);
  const therapeutic_alliance = parseLikert(body.therapeuticAlliance);
  const patient_believability = parseLikert(body.patientBelievability);
  const learning_impact = parseLikert(body.learningImpact);

  if (
    !clinical_realism ||
    !educational_value ||
    !conversation_naturalness ||
    !therapeutic_alliance ||
    !patient_believability ||
    !learning_impact
  ) {
    return NextResponse.json(
      { error: "All six core ratings (1–5) are required" },
      { status: 400 },
    );
  }

  const voiceParsed = parseOptionalLikert(body.voiceRealism);
  if (voiceParsed === undefined) {
    return NextResponse.json(
      { error: "voiceRealism must be 1–5 or null" },
      { status: 400 },
    );
  }
  const arabicParsed = parseOptionalLikert(body.arabicQuality);
  if (arabicParsed === undefined) {
    return NextResponse.json(
      { error: "arabicQuality must be 1–5 or null" },
      { status: 400 },
    );
  }
  const englishParsed = parseOptionalLikert(body.englishQuality);
  if (englishParsed === undefined) {
    return NextResponse.json(
      { error: "englishQuality must be 1–5 or null" },
      { status: 400 },
    );
  }

  const freeText =
    typeof body.freeText === "string"
      ? body.freeText.trim().slice(0, 4000) || null
      : null;

  const { data, error } = await auth.supabase
    .from("ppp_session_ratings")
    .upsert(
      {
        session_id: sessionId,
        reviewer_id: auth.user.id,
        clinical_realism,
        educational_value,
        conversation_naturalness,
        therapeutic_alliance,
        patient_believability,
        learning_impact,
        voice_realism: voiceParsed,
        arabic_quality: arabicParsed,
        english_quality: englishParsed,
        used_voice: Boolean(body.usedVoice),
        session_language:
          typeof body.sessionLanguage === "string"
            ? body.sessionLanguage
            : (session.language as string | null) ?? null,
        free_text: freeText,
      },
      { onConflict: "session_id,reviewer_id" },
    )
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { error: clientSafeError("Could not save ratings", error) },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, id: data.id });
}

/** GET — existing rating for this session by current user. */
export async function GET(request: Request, ctx: Ctx) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  const { id: sessionId } = await ctx.params;
  const { data } = await auth.supabase
    .from("ppp_session_ratings")
    .select("*")
    .eq("session_id", sessionId)
    .eq("reviewer_id", auth.user.id)
    .maybeSingle();

  return NextResponse.json({ rating: data ?? null });
}
