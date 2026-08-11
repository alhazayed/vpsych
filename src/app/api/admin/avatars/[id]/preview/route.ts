import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { resolveAvatar } from "@/lib/avatars/resolve";
import { formatHumanPersonalityForPrompt } from "@/lib/personality-engine";
import { projectAvatarVoiceFields } from "@/lib/voice/registry";
import type { Avatar } from "@/lib/types";
import {
  findDisorderBySlug,
  getBuiltinCatalog,
} from "@/lib/case-engine/catalog";
import { generateCaseInstance } from "@/lib/case-engine/generator";
import type { PersonaRow } from "@/lib/case-engine/types";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/avatars/[id]/preview
 * Uses real resolveAvatar (+ optional case generation) — no duplicated prompt logic.
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const auth = await requireApiAdmin(request, {
    action: "admin.avatar.preview",
    resourceType: "avatar",
    resourceId: id,
  });
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await rateLimit(
    `admin-avatar-preview:${user.id}`,
    30,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    locale?: string;
    includeCase?: boolean;
  };

  const { data: avatar, error } = await supabase
    .from("avatars")
    .select("*, voice_profile:voice_profiles(*)")
    .eq("id", id)
    .maybeSingle();

  if (error || !avatar) {
    return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
  }

  const typed = avatar as Avatar;
  const locale = body.locale ?? typed.default_locale ?? "en-US";
  const resolved = resolveAvatar(typed, locale);
  const voice = projectAvatarVoiceFields(typed);

  let casePreview: unknown = null;
  if (body.includeCase) {
    const { data: persona } = await supabase
      .from("personas")
      .select("*")
      .eq("avatar_id", id)
      .maybeSingle();

    let disorderSlug: string | null = null;
    if (persona?.default_disorder_id) {
      const { data: d } = await supabase
        .from("disorders")
        .select("slug")
        .eq("id", persona.default_disorder_id)
        .maybeSingle();
      disorderSlug = d?.slug ?? null;
    }

    const catalog = getBuiltinCatalog();
    const primary = disorderSlug
      ? findDisorderBySlug(disorderSlug, catalog)
      : null;

    if (primary) {
      const personaRow: PersonaRow = (persona as PersonaRow | null) ?? {
        id: typed.id,
        avatar_id: typed.id,
        slug: typed.slug ?? typed.id,
        display_name: typed.name,
        identity: {
          age: typed.clinical_core?.age ?? typed.age ?? 30,
          gender:
            (typed.clinical_core?.gender as PersonaRow["identity"]["gender"]) ??
            "unspecified",
        },
        traits: {},
        baseline_history: {},
        default_disorder_id: null,
        is_active: typed.is_active,
      };

      const generated = generateCaseInstance({
        persona: personaRow,
        avatarId: typed.id,
        primaryDisorder: primary,
        comorbidities: [],
        difficulty: "intermediate",
        therapyModality: "supportive",
        locale,
        legacyClinicalCore: typed.clinical_core,
      });
      if (generated.ok) {
        casePreview = {
          assessment_id: generated.snapshot.assessment_id,
          primary_diagnosis: generated.snapshot.primary_diagnosis,
          severity: generated.snapshot.severity,
          clinical_core: {
            disorder: generated.snapshot.clinical_core.disorder,
            age: generated.snapshot.clinical_core.age,
            gender: generated.snapshot.clinical_core.gender,
            severity: generated.snapshot.clinical_core.severity,
            risk_profile: generated.snapshot.clinical_core.risk_profile,
          },
        };
      }
    }
  }

  return NextResponse.json({
    locale,
    resolved: {
      id: resolved.id,
      name: resolved.name,
      disorder: resolved.disorder,
      age: resolved.age,
      gender: resolved.gender,
      language: resolved.language,
      direction: resolved.direction,
      dialect: resolved.dialect,
      locale: resolved.locale,
      voice_profile_id: resolved.voice_profile_id,
      voice_id: resolved.voice_id,
      stt_lang: resolved.stt_lang,
      tts_lang: resolved.tts_lang,
      persona_prompt_excerpt: resolved.persona_prompt.slice(0, 400),
      system_prompt_excerpt: resolved.system_prompt.slice(0, 600),
      human_personality_prompt: resolved.human_personality
        ? formatHumanPersonalityForPrompt(resolved.human_personality)
        : null,
      fallback_replies: resolved.fallback_replies?.slice(0, 3) ?? [],
    },
    voice,
    casePreview,
    note: "Preview uses resolveAvatar. Persistent test conversations are Phase 3C.",
  });
}
