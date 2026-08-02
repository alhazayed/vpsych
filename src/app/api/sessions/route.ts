import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeAvatarLocale } from "@/lib/avatars/resolve";
import { createCaseForSession } from "@/lib/case-engine/persist";
import type {
  CaseDifficulty,
  TherapyModality,
} from "@/lib/case-engine/types";
import { MAX_SESSION_SECONDS, type Avatar } from "@/lib/types";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`start:${user.id}`, 30, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const body = (await request.json()) as {
    avatarId?: string;
    /** Optional; falls back to profile preferred_language then avatar default. */
    locale?: string;
    language?: string;
    /** Case Engine — optional diagnosis override (slug). */
    disorderSlug?: string;
    comorbiditySlugs?: string[];
    difficulty?: CaseDifficulty;
    therapyModality?: TherapyModality;
    severity?: "subclinical" | "mild" | "moderate" | "severe";
    /** @deprecated alias for disorderSlug */
    caseId?: string;
  };
  if (!body.avatarId) {
    return NextResponse.json({ error: "avatarId required" }, { status: 400 });
  }

  const { data: avatar, error: avatarError } = await supabase
    .from("avatars")
    .select(
      "id, name, disorder, age, gender, is_active, language, default_locale, slug, schema_version, clinical_core, personalities, voice_id, voice_id_ar, voice_profile_id, persona_prompt, ideal_guidelines, rubric",
    )
    .eq("id", body.avatarId)
    .single();

  if (avatarError || !avatar?.is_active) {
    return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
  }

  const typedAvatar = avatar as Avatar;

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_language")
    .eq("id", user.id)
    .maybeSingle();

  const sessionLanguage = normalizeAvatarLocale(
    body.locale ??
      body.language ??
      profile?.preferred_language ??
      typedAvatar.default_locale ??
      typedAvatar.language,
  );

  // Module 7 — generate immutable CaseInstance for this assessment
  const caseResult = await createCaseForSession(supabase, {
    avatar: typedAvatar,
    locale: sessionLanguage,
    therapistId: user.id,
    disorderSlug: body.disorderSlug ?? body.caseId,
    comorbiditySlugs: body.comorbiditySlugs,
    difficulty: body.difficulty,
    therapyModality: body.therapyModality,
    severity: body.severity,
  });

  if (!caseResult.ok) {
    return NextResponse.json(
      { error: caseResult.error },
      { status: caseResult.status },
    );
  }

  const insertPayload: Record<string, unknown> = {
    therapist_id: user.id,
    avatar_id: body.avatarId,
    status: "active",
    max_duration_sec: MAX_SESSION_SECONDS,
    language: sessionLanguage,
    case_instance_id: caseResult.caseInstanceId.startsWith("VPSY-")
      ? null
      : caseResult.caseInstanceId,
    clinical_snapshot: caseResult.snapshot,
    difficulty: caseResult.difficulty,
    therapy_modality: caseResult.therapyModality,
  };

  let { data: session, error } = await supabase
    .from("sessions")
    .insert(insertPayload)
    .select("id")
    .single();

  // Backward compatible: if new columns are missing (migration not applied), retry legacy insert
  if (error && /clinical_snapshot|case_instance_id|difficulty|therapy_modality/i.test(error.message)) {
    const legacy = await supabase
      .from("sessions")
      .insert({
        therapist_id: user.id,
        avatar_id: body.avatarId,
        status: "active",
        max_duration_sec: MAX_SESSION_SECONDS,
        language: sessionLanguage,
      })
      .select("id")
      .single();
    session = legacy.data;
    error = legacy.error;
  }

  if (error || !session) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create session" },
      { status: 500 },
    );
  }

  const { error: sysErr } = await supabase.rpc("insert_system_message", {
    p_session_id: session.id,
    p_content: "Session started. Speak with the patient avatar.",
  });

  if (sysErr) {
    return NextResponse.json({ error: sysErr.message }, { status: 500 });
  }

  return NextResponse.json({
    sessionId: session.id,
    language: sessionLanguage,
    assessmentId: caseResult.snapshot.assessment_id,
    caseInstanceId: caseResult.caseInstanceId,
    diagnosis: caseResult.snapshot.primary_diagnosis.name,
    difficulty: caseResult.difficulty,
    therapyModality: caseResult.therapyModality,
  });
}
