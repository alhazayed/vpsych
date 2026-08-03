import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { messageRpcClient } from "@/lib/supabase/admin";
import { normalizeAvatarLocale } from "@/lib/avatars/resolve";
import { createCaseForSession } from "@/lib/case-engine/persist";
import type {
  CaseDifficulty,
  TherapyModality,
} from "@/lib/case-engine/types";
import {
  findPresetById,
  findPresetBySlug,
} from "@/lib/instructor-presets";
import { MAX_SESSION_SECONDS, type Avatar } from "@/lib/types";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`start:${user.id}`, 60, 60 * 60 * 1000);
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
    /** Clinical Scenario Template Engine */
    templateId?: string;
    templateSlug?: string;
    /** Instructor Preset Engine — objectives drive case generation */
    presetId?: string;
    presetSlug?: string;
    /** Advanced Mode diagnosis pin (requires preset.advanced_mode) */
    disorderSlugOverride?: string;
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

  const builtinPreset =
    (body.presetId ? findPresetById(body.presetId) : undefined) ??
    (body.presetSlug ? findPresetBySlug(body.presetSlug) : undefined);

  // Explicit locale wins; else preset language; else profile/avatar defaults
  const sessionLanguage = normalizeAvatarLocale(
    body.locale ??
      body.language ??
      builtinPreset?.language ??
      profile?.preferred_language ??
      typedAvatar.default_locale ??
      typedAvatar.language,
  );
  const effectiveLocale = sessionLanguage;

  // Module 7 — generate immutable CaseInstance for this assessment
  const caseResult = await createCaseForSession(supabase, {
    avatar: typedAvatar,
    locale: effectiveLocale,
    therapistId: user.id,
    disorderSlug: body.disorderSlug ?? body.caseId,
    comorbiditySlugs: body.comorbiditySlugs,
    difficulty: body.difficulty,
    therapyModality: body.therapyModality,
    severity: body.severity,
    templateId: body.templateId,
    templateSlug: body.templateSlug,
    presetId: body.presetId,
    presetSlug: body.presetSlug,
    disorderSlugOverride: body.disorderSlugOverride,
  });

  if (!caseResult.ok) {
    return NextResponse.json(
      { error: caseResult.error },
      { status: caseResult.status },
    );
  }

  const maxDurationSec =
    caseResult.maxDurationSec ?? MAX_SESSION_SECONDS;

  const insertPayload: Record<string, unknown> = {
    therapist_id: user.id,
    avatar_id: body.avatarId,
    status: "active",
    max_duration_sec: maxDurationSec,
    language: caseResult.snapshot.locale || effectiveLocale,
    case_instance_id: caseResult.caseInstanceId.startsWith("VPSY-")
      ? null
      : caseResult.caseInstanceId,
    clinical_snapshot: caseResult.snapshot,
    difficulty: caseResult.difficulty,
    therapy_modality: caseResult.therapyModality,
    instructor_preset_id: caseResult.preset?.id ?? null,
  };

  let { data: session, error } = await supabase
    .from("sessions")
    .insert(insertPayload)
    .select("id")
    .single();

  // Backward compatible: if new columns are missing (migration not applied), retry legacy insert
  if (
    error &&
    /clinical_snapshot|case_instance_id|difficulty|therapy_modality|instructor_preset/i.test(
      error.message,
    )
  ) {
    const withoutPreset = { ...insertPayload };
    delete withoutPreset.instructor_preset_id;
    const retry = await supabase
      .from("sessions")
      .insert(withoutPreset)
      .select("id")
      .single();
    if (
      retry.error &&
      /clinical_snapshot|case_instance_id|difficulty|therapy_modality/i.test(
        retry.error.message,
      )
    ) {
      const legacy = await supabase
        .from("sessions")
        .insert({
          therapist_id: user.id,
          avatar_id: body.avatarId,
          status: "active",
          max_duration_sec: maxDurationSec,
          language: caseResult.snapshot.locale || effectiveLocale,
        })
        .select("id")
        .single();
      session = legacy.data;
      error = legacy.error;
    } else {
      session = retry.data;
      error = retry.error;
    }
  }

  if (error || !session) {
    console.error("[sessions] create failed", { error: error?.message });
    return NextResponse.json(
      { error: clientSafeError("Failed to create session", error) },
      { status: 500 },
    );
  }

  const writer = messageRpcClient(supabase);
  const { error: sysErr } = await writer.rpc("insert_system_message", {
    p_session_id: session.id,
    p_content: "Session started. Speak with the patient avatar.",
  });

  if (sysErr) {
    console.error("[sessions] system message failed", {
      sessionId: session.id,
      error: sysErr.message,
    });
    return NextResponse.json(
      { error: clientSafeError("Failed to start session", sysErr) },
      { status: 500 },
    );
  }

  return NextResponse.json({
    sessionId: session.id,
    language: caseResult.snapshot.locale || effectiveLocale,
    assessmentId: caseResult.snapshot.assessment_id,
    caseInstanceId: caseResult.caseInstanceId,
    diagnosis: caseResult.snapshot.primary_diagnosis.name,
    difficulty: caseResult.difficulty,
    therapyModality: caseResult.therapyModality,
    templateId: caseResult.snapshot.template?.id ?? null,
    templateSlug: caseResult.snapshot.template?.slug ?? null,
    presetId: caseResult.preset?.id ?? null,
    presetSlug: caseResult.preset?.slug ?? null,
    primaryObjective: caseResult.preset?.primary_objective ?? null,
    maxDurationSec,
  });
}
