/**
 * Build CFI input from a CaseInstanceSnapshot + DisorderRow.
 */

import type { CaseInstanceSnapshot, DisorderRow } from "@/lib/case-engine/types";
import type { CfiComputeInput } from "@/lib/cfi/types";
import { detectImpossibleTimeline } from "@/lib/cfi/engine";
import { evidenceForSlug } from "@/lib/scientific/evidence";
import {
  ASSESSMENT_SCHEMA_VERSION,
  PROMPT_ENGINE_VERSION,
} from "@/lib/scientific/versions";

const LEAKAGE =
  /SYSTEM PROMPT|ignore previous|<\/?(?:system|assistant)>/i;

export function cfiInputFromSnapshot(
  snapshot: CaseInstanceSnapshot,
  disorder?: DisorderRow | null,
  opts?: {
    comorbiditiesCompatible?: boolean;
    model_version?: string | null;
    has_voice_profile?: boolean;
  },
): CfiComputeInput {
  const pkg = disorder?.package ?? {};
  const teaching = snapshot.clinical_teaching;
  const core = snapshot.clinical_core;
  const meta = snapshot.scientific_meta ?? {};
  const ev = evidenceForSlug(snapshot.primary_diagnosis.slug);

  const symptom_domains = (core.symptom_profile ?? [])
    .map((s) => s.domain ?? "")
    .filter(Boolean) as string[];

  const teachingBlob = [
    core.ideal_approach,
    ...(teaching?.teaching_points ?? []),
    teaching?.speech_behavior_cue ?? "",
  ].join(" ");

  return {
    disorder_slug: snapshot.primary_diagnosis.slug,
    disorder_name: snapshot.primary_diagnosis.name,
    dsm5_code: snapshot.primary_diagnosis.dsm5_code,
    icd11_code: snapshot.primary_diagnosis.icd11_code,
    dsm5_optional: Boolean(pkg.dsm5_optional),
    severity: snapshot.severity ?? core.severity ?? null,
    onset_duration: core.onset_duration ?? null,
    symptom_count: core.symptom_profile?.length ?? 0,
    symptom_domains,
    risk: {
      suicidal_ideation: core.risk_profile?.suicidal_ideation,
      self_harm: core.risk_profile?.self_harm,
      harm_to_others: core.risk_profile?.harm_to_others,
      substance_use: core.risk_profile?.substance_use,
      escalation_rules: core.risk_profile?.escalation_rules ?? null,
    },
    differentials_count:
      teaching?.differentials?.length ?? pkg.differentials?.length ?? 0,
    rule_outs_count: teaching?.rule_outs?.length ?? pkg.rule_outs?.length ?? 0,
    teaching_points_count:
      teaching?.teaching_points?.length ?? pkg.teaching_points?.length ?? 0,
    disclosure_rules_count: core.disclosure_rules?.length ?? 0,
    comorbidities: (snapshot.comorbidities ?? []).map((c) => ({
      slug: c.slug,
      compatible: opts?.comorbiditiesCompatible,
    })),
    locale: snapshot.locale,
    memory_scope: snapshot.memory_scope,
    has_clinical_teaching: Boolean(teaching),
    has_insight_cue: Boolean(teaching?.insight_expectation),
    has_judgment_cue: Boolean(teaching?.judgment_expectation),
    has_speech_cue: Boolean(teaching?.speech_behavior_cue),
    has_medication_cue: Boolean(
      teaching?.teaching_points?.some((t) => /medication|psychotropic|adherence/i.test(t)),
    ),
    has_trauma_cue: Boolean(
      teaching?.teaching_points?.some((t) => /trauma/i.test(t)),
    ),
    has_culture_cue: Boolean(
      teaching?.teaching_points?.some((t) => /culture|religion/i.test(t)),
    ),
    has_voice_profile: Boolean(opts?.has_voice_profile),
    protective_factors_count: core.protective_factors?.length ?? 0,
    has_mse: Boolean(core.mse),
    has_formulation: Boolean(core.formulation),
    prompt_version:
      (meta.prompt_engine_version as string) ?? PROMPT_ENGINE_VERSION,
    model_version: opts?.model_version ?? null,
    persona_version: snapshot.persona?.slug ?? null,
    template_version: snapshot.template?.version ?? null,
    assessment_schema_version:
      (meta.assessment_schema_version as string) ?? ASSESSMENT_SCHEMA_VERSION,
    disorder_package_version:
      (meta.disorder_package_version as string) ?? "catalog-builtin-1",
    evidence_grade: ev?.evidence_grade ?? null,
    impossible_timeline: detectImpossibleTimeline(
      snapshot.primary_diagnosis.slug,
      core.onset_duration,
    ),
    prompt_leakage_detected: LEAKAGE.test(teachingBlob),
    culture_rewrites_codes: false,
  };
}
