import type { SupabaseClient } from "@supabase/supabase-js";
import {
  findDifficulty,
  findDisorderBySlug,
  findTherapy,
  getBuiltinCatalog,
} from "@/lib/case-engine/catalog";
import { generateCaseInstance } from "@/lib/case-engine/generator";
import type {
  CaseDifficulty,
  CaseInstanceSnapshot,
  CaseSeverity,
  DisorderRow,
  PersonaRow,
  TherapyModality,
} from "@/lib/case-engine/types";
import {
  findTemplateById,
  findTemplateBySlug,
} from "@/lib/scenario-templates/catalog";
import { generateFromTemplate } from "@/lib/scenario-templates/generate";
import type { ClinicalScenarioTemplate } from "@/lib/scenario-templates/types";
import type { Avatar, ClinicalCore } from "@/lib/types";

export type StartCaseOptions = {
  avatar: Avatar;
  locale: string;
  therapistId: string;
  disorderSlug?: string;
  comorbiditySlugs?: string[];
  difficulty?: CaseDifficulty;
  therapyModality?: TherapyModality;
  severity?: CaseSeverity;
  seed?: string | number;
  /** Clinical Scenario Template Engine */
  templateId?: string;
  templateSlug?: string;
};

function personaFromAvatar(avatar: Avatar, dbPersona?: PersonaRow | null): PersonaRow {
  if (dbPersona) return dbPersona;
  const age =
    avatar.clinical_core?.age ??
    (typeof avatar.age === "number" ? avatar.age : 30);
  const gender =
    (avatar.clinical_core?.gender as PersonaRow["identity"]["gender"]) ??
    (avatar.gender as PersonaRow["identity"]["gender"]) ??
    "unspecified";
  return {
    id: avatar.id,
    avatar_id: avatar.id,
    slug: avatar.slug ?? avatar.id,
    display_name: avatar.name,
    identity: { age, gender, source: "avatar_fallback" },
    traits: {},
    baseline_history: {},
    default_disorder_id: null,
    is_active: avatar.is_active,
  };
}

function mapDbDisorder(row: Record<string, unknown>): DisorderRow {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    dsm5_code: (row.dsm5_code as string) ?? null,
    icd10_code: (row.icd10_code as string) ?? null,
    icd11_code: (row.icd11_code as string) ?? null,
    category: (row.category as string) ?? null,
    min_age: (row.min_age as number) ?? null,
    max_age: (row.max_age as number) ?? null,
    allowed_genders: (row.allowed_genders as string[]) ?? [
      "female",
      "male",
      "non-binary",
      "unspecified",
    ],
    package: (row.package as DisorderRow["package"]) ?? {},
    is_active: Boolean(row.is_active),
  };
}

/**
 * Load catalog pieces from DB when available; fall back to builtins.
 * Generate + persist CaseInstance + empty case_memory.
 */
export async function createCaseForSession(
  supabase: SupabaseClient,
  opts: StartCaseOptions,
): Promise<
  | {
      ok: true;
      caseInstanceId: string;
      snapshot: CaseInstanceSnapshot;
      difficulty: CaseDifficulty;
      therapyModality: TherapyModality;
    }
  | { ok: false; error: string; status: number }
> {
  const catalog = getBuiltinCatalog();

  const { data: dbPersona } = await supabase
    .from("personas")
    .select("*")
    .eq("avatar_id", opts.avatar.id)
    .maybeSingle();

  const persona = personaFromAvatar(opts.avatar, dbPersona as PersonaRow | null);

  // -------------------------------------------------------------------------
  // Template path — instructor templates drive generation
  // -------------------------------------------------------------------------
  let resolvedTemplate: ClinicalScenarioTemplate | null = null;
  if (opts.templateId || opts.templateSlug) {
    const { data: trow } = opts.templateId
      ? await supabase
          .from("clinical_templates")
          .select("*")
          .eq("id", opts.templateId)
          .maybeSingle()
      : await supabase
          .from("clinical_templates")
          .select("*")
          .eq("slug", opts.templateSlug!)
          .maybeSingle();

    if (trow) {
      const { data: objectives } = await supabase
        .from("template_objectives")
        .select("category, statement, sort_order")
        .eq("template_id", trow.id)
        .order("sort_order");
      const { data: competencies } = await supabase
        .from("template_competencies")
        .select(
          "competency_id, label, weight, max_score, critical, auto_deduction, excellent_marker, sort_order",
        )
        .eq("template_id", trow.id)
        .order("sort_order");
      const { data: comorbidities } = await supabase
        .from("template_comorbidities")
        .select("disorder_id, tier, disorders(slug)")
        .eq("template_id", trow.id);
      const { data: primaryDisorder } = await supabase
        .from("disorders")
        .select("slug")
        .eq("id", trow.primary_diagnosis_id)
        .maybeSingle();

      resolvedTemplate = {
        id: trow.id,
        slug: trow.slug,
        name: trow.name,
        description: trow.description,
        specialty: trow.specialty,
        target_learners: trow.target_learners ?? [],
        estimated_duration_minutes: trow.estimated_duration_minutes,
        difficulty: trow.difficulty,
        language: opts.locale || trow.language,
        culture: trow.culture,
        therapy_modality: trow.therapy_modality,
        primary_diagnosis_id: trow.primary_diagnosis_id,
        primary_diagnosis_slug: primaryDisorder?.slug,
        allowed_comorbidity_slugs: (comorbidities ?? [])
          .map((c) => {
            const d = c.disorders as { slug?: string } | { slug?: string }[] | null;
            if (Array.isArray(d)) return d[0]?.slug;
            return d?.slug;
          })
          .filter(Boolean) as string[],
        excluded_diagnosis_slugs: [],
        severity: trow.severity,
        risk_level: trow.risk_level,
        assessment_type: trow.assessment_type,
        voice_profile_id: trow.voice_profile_id,
        default_persona_id: trow.default_persona_id,
        randomization_level: trow.randomization_level,
        memory_mode: trow.memory_mode,
        grading_rubric: trow.grading_rubric ?? {
          pass_threshold: 60,
          outstanding_threshold: 85,
        },
        report_template: trow.report_template ?? {},
        learning_objectives: (objectives ?? []).map((o) => ({
          category: o.category,
          statement: o.statement,
          sort_order: o.sort_order,
        })),
        clinical_competencies: (competencies ?? []).map((c) => ({
          competency_id: c.competency_id,
          label: c.label,
          weight: Number(c.weight),
          max_score: Number(c.max_score),
          critical: c.critical,
          auto_deduction: c.auto_deduction ? Number(c.auto_deduction) : 0,
          excellent_marker: c.excellent_marker ?? undefined,
          sort_order: c.sort_order,
        })),
        allow_medical_simulation: trow.allow_medical_simulation,
        enabled: trow.enabled,
        version: trow.version,
      } as ClinicalScenarioTemplate;
    } else {
      resolvedTemplate =
        (opts.templateId ? findTemplateById(opts.templateId) : undefined) ??
        (opts.templateSlug ? findTemplateBySlug(opts.templateSlug) : undefined) ??
        null;
      if (resolvedTemplate) {
        resolvedTemplate = {
          ...resolvedTemplate,
          language: opts.locale || resolvedTemplate.language,
        };
      }
    }

    if (!resolvedTemplate) {
      return { ok: false, error: "Clinical template not found", status: 404 };
    }

    const fromTemplate = generateFromTemplate({
      template: resolvedTemplate,
      persona,
      avatarId: opts.avatar.id,
      comorbiditySlugs: opts.comorbiditySlugs,
      seed: opts.seed,
      autoComorbidity: !opts.comorbiditySlugs?.length,
    });
    if (!fromTemplate.ok) {
      return {
        ok: false,
        error: fromTemplate.issues.map((i) => i.message).join("; "),
        status: 400,
      };
    }

    const snapshot = {
      ...fromTemplate.patient.snapshot,
      template: fromTemplate.patient.template,
    };
    const difficulty = resolvedTemplate.difficulty;
    const therapyModality = resolvedTemplate.therapy_modality as TherapyModality;

    const { data: inserted, error: insertErr } = await supabase
      .from("case_instances")
      .insert({
        assessment_id: snapshot.assessment_id,
        persona_id: dbPersona?.id ?? null,
        avatar_id: opts.avatar.id,
        primary_disorder_id: resolvedTemplate.primary_diagnosis_id,
        comorbidity_disorder_ids: snapshot.comorbidities.map((c) => c.id),
        difficulty,
        therapy_modality: therapyModality,
        locale: snapshot.locale,
        severity: snapshot.severity,
        clinical_snapshot: snapshot,
        randomized_context: snapshot.randomized_context,
        voice_profile_id:
          resolvedTemplate.voice_profile_id ??
          opts.avatar.voice_profile_id ??
          null,
        template_id: resolvedTemplate.id,
        template_version: resolvedTemplate.version,
        created_by: opts.therapistId,
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      if (
        insertErr?.message?.includes("does not exist") ||
        insertErr?.code === "42P01" ||
        insertErr?.message?.includes("template_id")
      ) {
        return {
          ok: true,
          caseInstanceId: snapshot.assessment_id,
          snapshot,
          difficulty,
          therapyModality,
        };
      }
      return {
        ok: false,
        error: insertErr?.message ?? "Failed to persist case instance",
        status: 500,
      };
    }

    snapshot.case_instance_id = inserted.id;
    await supabase.from("case_memory").insert({
      case_instance_id: inserted.id,
      memory: {
        turns: [],
        notes: [],
        scope: "case_instance",
        template_id: resolvedTemplate.id,
      },
    });
    await supabase
      .from("case_instances")
      .update({ clinical_snapshot: snapshot })
      .eq("id", inserted.id);

    return {
      ok: true,
      caseInstanceId: inserted.id,
      snapshot,
      difficulty,
      therapyModality,
    };
  }

  let primary: DisorderRow | undefined;
  const disorderSlug =
    opts.disorderSlug ??
    (dbPersona?.default_disorder_id
      ? undefined
      : opts.avatar.slug === "maya-chen"
        ? "mdd-recurrent-moderate"
        : opts.avatar.slug === "jordan-hale"
          ? "gad-with-panic"
          : undefined);

  if (opts.disorderSlug || disorderSlug) {
    const slug = opts.disorderSlug ?? disorderSlug!;
    const { data: drow } = await supabase
      .from("disorders")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    primary = drow ? mapDbDisorder(drow) : findDisorderBySlug(slug, catalog);
  } else if (dbPersona?.default_disorder_id) {
    const { data: drow } = await supabase
      .from("disorders")
      .select("*")
      .eq("id", dbPersona.default_disorder_id)
      .maybeSingle();
    primary = drow
      ? mapDbDisorder(drow)
      : catalog.disorders.find((d) => d.id === dbPersona.default_disorder_id);
  }

  if (!primary) {
    // Ultimate legacy fallback: synthesize disorder from avatar clinical_core
    const core = opts.avatar.clinical_core;
    primary = {
      id: "legacy-" + opts.avatar.id,
      slug: "legacy-" + (opts.avatar.slug ?? "avatar"),
      name: core?.disorder ?? opts.avatar.disorder,
      dsm5_code: core?.dsm5_code ?? null,
      icd10_code: null,
      icd11_code: core?.icd11_code ?? null,
      category: "legacy",
      min_age: 1,
      max_age: 120,
      allowed_genders: ["female", "male", "non-binary", "unspecified"],
      package: {
        severity_default: core?.severity ?? "moderate",
        symptom_profile: core?.symptom_profile,
        disclosure_rules: core?.disclosure_rules,
        session_goals: core?.session_goals,
        ideal_approach: core?.ideal_approach,
        risk_defaults: core?.risk_profile,
      },
      is_active: true,
    };
  }

  const comorbidities: DisorderRow[] = [];
  for (const slug of opts.comorbiditySlugs ?? []) {
    const { data: drow } = await supabase
      .from("disorders")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    const d = drow ? mapDbDisorder(drow) : findDisorderBySlug(slug, catalog);
    if (!d) {
      return { ok: false, error: `Unknown comorbidity: ${slug}`, status: 400 };
    }
    comorbidities.push(d);
  }

  const difficulty: CaseDifficulty = opts.difficulty ?? "intermediate";
  const therapyModality: TherapyModality =
    opts.therapyModality ?? "supportive";

  const generated = generateCaseInstance({
    persona,
    avatarId: opts.avatar.id,
    primaryDisorder: primary,
    comorbidities,
    difficulty,
    therapyModality,
    locale: opts.locale,
    severity: opts.severity,
    seed: opts.seed,
    difficultyProfile: findDifficulty(difficulty, catalog),
    therapyProfile: findTherapy(therapyModality, catalog),
    legacyClinicalCore: opts.avatar.clinical_core as ClinicalCore | null,
    voiceProfileId: opts.avatar.voice_profile_id,
    createdBy: opts.therapistId,
  });

  if (!generated.ok) {
    return {
      ok: false,
      error: generated.issues.map((i) => i.message).join("; "),
      status: 400,
    };
  }

  const snapshot = generated.snapshot;

  // Persist case_instance — if table missing (migration not applied), soft-fail to snapshot-only
  const { data: inserted, error: insertErr } = await supabase
    .from("case_instances")
    .insert({
      assessment_id: snapshot.assessment_id,
      persona_id: dbPersona?.id ?? null,
      avatar_id: opts.avatar.id,
      primary_disorder_id: primary.id.startsWith("legacy-")
        ? (dbPersona?.default_disorder_id ??
          catalog.disorders[0]!.id)
        : primary.id,
      comorbidity_disorder_ids: comorbidities.map((c) => c.id),
      difficulty,
      therapy_modality: therapyModality,
      locale: opts.locale,
      severity: snapshot.severity,
      clinical_snapshot: snapshot,
      randomized_context: snapshot.randomized_context,
      voice_profile_id: opts.avatar.voice_profile_id ?? null,
      created_by: opts.therapistId,
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    // Migration not applied yet — still return snapshot for session.clinical_snapshot
    if (
      insertErr?.message?.includes("does not exist") ||
      insertErr?.code === "42P01"
    ) {
      return {
        ok: true,
        caseInstanceId: snapshot.assessment_id,
        snapshot,
        difficulty,
        therapyModality,
      };
    }
    // If FK failed because legacy synthetic id — retry with default disorder
    if (primary.id.startsWith("legacy-")) {
      return {
        ok: true,
        caseInstanceId: snapshot.assessment_id,
        snapshot,
        difficulty,
        therapyModality,
      };
    }
    return {
      ok: false,
      error: insertErr?.message ?? "Failed to persist case instance",
      status: 500,
    };
  }

  snapshot.case_instance_id = inserted.id;

  const { error: memErr } = await supabase.from("case_memory").insert({
    case_instance_id: inserted.id,
    memory: { turns: [], notes: [], scope: "case_instance" },
  });
  if (memErr) {
    console.warn("[case-engine] case_memory insert failed:", memErr.message);
  }

  // Update snapshot on row with case_instance_id filled
  await supabase
    .from("case_instances")
    .update({ clinical_snapshot: snapshot })
    .eq("id", inserted.id);

  return {
    ok: true,
    caseInstanceId: inserted.id,
    snapshot,
    difficulty,
    therapyModality,
  };
}

export function isCaseSnapshot(value: unknown): value is CaseInstanceSnapshot {
  if (!value || typeof value !== "object") return false;
  const v = value as CaseInstanceSnapshot;
  return v.version === 2 && Boolean(v.clinical_core?.disorder) && Boolean(v.assessment_id);
}
