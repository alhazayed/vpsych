import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import {
  findTemplateById,
  findTemplateBySlug,
} from "@/lib/scenario-templates/catalog";
import { generateFromTemplate } from "@/lib/scenario-templates/generate";
import type { PersonaRow } from "@/lib/case-engine/types";
import type { Avatar } from "@/lib/types";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const auth = await requireApiAdmin(request);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const limited = await rateLimit(`admin-tpl-preview:${auth.user.id}`, 30, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const body = (await request.json()) as {
    templateId?: string;
    templateSlug?: string;
    avatarId?: string;
    comorbiditySlugs?: string[];
    seed?: string;
  };

  const template =
    (body.templateId ? findTemplateById(body.templateId) : undefined) ??
    (body.templateSlug ? findTemplateBySlug(body.templateSlug) : undefined);

  // Prefer DB template when available; fall back to builtin metadata when
  // child rows (objectives/competencies) were never seeded.
  let resolved = template;
  if (body.templateId || body.templateSlug) {
    const q = supabase.from("clinical_templates").select("*");
    const { data: trow } = body.templateId
      ? await q.eq("id", body.templateId!).maybeSingle()
      : await q.eq("slug", body.templateSlug!).maybeSingle();
    if (trow) {
      const builtin =
        findTemplateBySlug(trow.slug) ??
        (body.templateSlug ? findTemplateBySlug(body.templateSlug) : undefined) ??
        (body.templateId ? findTemplateById(body.templateId) : undefined) ??
        template;
      const { data: primary } = await supabase
        .from("disorders")
        .select("slug")
        .eq("id", trow.primary_diagnosis_id)
        .maybeSingle();
      const { data: objectives } = await supabase
        .from("template_objectives")
        .select("category, statement, sort_order")
        .eq("template_id", trow.id);
      const { data: competencies } = await supabase
        .from("template_competencies")
        .select(
          "competency_id, label, weight, max_score, critical, auto_deduction, excellent_marker",
        )
        .eq("template_id", trow.id);
      const { data: comorb } = await supabase
        .from("template_comorbidities")
        .select("disorders(slug)")
        .eq("template_id", trow.id);

      const dbObjectives = (objectives ?? []) as never[];
      const dbCompetencies = (competencies ?? []).map((c) => ({
        competency_id: c.competency_id,
        label: c.label,
        weight: Number(c.weight),
        max_score: Number(c.max_score),
        critical: c.critical,
        auto_deduction: c.auto_deduction ? Number(c.auto_deduction) : 0,
        excellent_marker: c.excellent_marker ?? undefined,
      }));
      const dbComorbidities = (comorb ?? [])
        .map((c) => {
          const d = c.disorders as { slug?: string } | { slug?: string }[] | null;
          if (Array.isArray(d)) return d[0]?.slug;
          return d?.slug;
        })
        .filter(Boolean) as string[];

      resolved = {
        id: trow.id,
        slug: trow.slug,
        name: trow.name,
        description: trow.description,
        specialty: trow.specialty,
        target_learners: trow.target_learners ?? builtin?.target_learners ?? [],
        estimated_duration_minutes: trow.estimated_duration_minutes,
        difficulty: trow.difficulty,
        language: trow.language,
        culture: trow.culture,
        therapy_modality: trow.therapy_modality,
        primary_diagnosis_id: trow.primary_diagnosis_id,
        primary_diagnosis_slug:
          primary?.slug ?? builtin?.primary_diagnosis_slug ?? template?.primary_diagnosis_slug,
        allowed_comorbidity_slugs:
          dbComorbidities.length > 0
            ? dbComorbidities
            : (builtin?.allowed_comorbidity_slugs ?? []),
        excluded_diagnosis_slugs: builtin?.excluded_diagnosis_slugs ?? [],
        severity: trow.severity,
        risk_level: trow.risk_level,
        assessment_type: trow.assessment_type,
        randomization_level: trow.randomization_level,
        memory_mode: trow.memory_mode,
        grading_rubric: trow.grading_rubric ?? builtin?.grading_rubric,
        report_template: trow.report_template ?? builtin?.report_template ?? {},
        learning_objectives:
          dbObjectives.length > 0
            ? dbObjectives
            : (builtin?.learning_objectives ?? []),
        clinical_competencies:
          dbCompetencies.length > 0
            ? dbCompetencies
            : (builtin?.clinical_competencies ?? []),
        allow_medical_simulation: trow.allow_medical_simulation,
        enabled: trow.enabled,
        version: trow.version,
        default_persona_slug: builtin?.default_persona_slug ?? null,
      };
    }
  }

  if (!resolved) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  let avatarId = body.avatarId;
  if (!avatarId && resolved.default_persona_slug) {
    const { data: persona } = await supabase
      .from("personas")
      .select("avatar_id")
      .eq("slug", resolved.default_persona_slug)
      .maybeSingle();
    avatarId = persona?.avatar_id ?? undefined;
  }
  if (!avatarId) {
    const { data: anyAvatar } = await supabase
      .from("avatars")
      .select("id")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    avatarId = anyAvatar?.id;
  }
  if (!avatarId) {
    return NextResponse.json({ error: "No avatar available" }, { status: 400 });
  }

  const { data: avatar } = await supabase
    .from("avatars")
    .select("*")
    .eq("id", avatarId)
    .single();
  if (!avatar) {
    return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
  }
  const typed = avatar as Avatar;

  const persona: PersonaRow = {
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
    is_active: true,
  };

  const result = generateFromTemplate({
    template: resolved,
    persona,
    avatarId: typed.id,
    comorbiditySlugs: body.comorbiditySlugs,
    seed: body.seed,
    autoComorbidity: true,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.issues }, { status: 400 });
  }

  return NextResponse.json({
    patient: result.patient,
    exportJson: result.patient,
  });
}
