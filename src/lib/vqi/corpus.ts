/**
 * Offline VQI corpus — compose peer metric corpora into hierarchical VQI.
 */

import { BUILTIN_DISORDERS } from "@/lib/case-engine/catalog";
import { generateCaseInstance } from "@/lib/case-engine/generator";
import type { PersonaRow } from "@/lib/case-engine/types";
import { DISORDER_IDS } from "@/lib/case-engine/catalog";
import {
  computeClinicalFidelityIndex,
  cfiInputFromSnapshot,
  CFI_VERSION,
} from "@/lib/cfi";
import { buildEriOfflineCorpus, ERI_VERSION } from "@/lib/eri";
import { buildAviOfflineCorpus, AVI_VERSION } from "@/lib/avi";
import { buildAleOfflineCorpus, ALE_VERSION } from "@/lib/ale";
import { buildRrsOfflineCorpus, RRS_VERSION } from "@/lib/rrs";
import { computeVPsychQualityIndex } from "@/lib/vqi/engine";
import { createDefaultWeightSet } from "@/lib/vqi/weights";
import type { StoredVqiRecord } from "@/lib/vqi/aggregate";
import type { VqiMetricObservation } from "@/lib/vqi/types";
import {
  ACE_ENGINE_VERSION,
  ASSESSMENT_SCHEMA_VERSION,
  CGE_ENGINE_VERSION,
  PROMPT_ENGINE_VERSION,
} from "@/lib/scientific/versions";

const demoPersona: PersonaRow = {
  id: "persona-vqi",
  avatar_id: "avatar-vqi",
  slug: "maya-chen",
  display_name: "Maya Chen",
  identity: { age: 28, gender: "female" },
  traits: {},
  baseline_history: {},
  default_disorder_id: DISORDER_IDS.mdd,
  is_active: true,
};

function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function observationsFromMeans(means: {
  CFI: number;
  ERI: number;
  AVI: number;
  ALE: number;
  RRS: number;
}): VqiMetricObservation[] {
  return [
    { metric_id: "CFI", score: means.CFI, confidence: 82, version: CFI_VERSION },
    { metric_id: "ERI", score: means.ERI, confidence: 80, version: ERI_VERSION },
    { metric_id: "AVI", score: means.AVI, confidence: 78, version: AVI_VERSION },
    { metric_id: "ALE", score: means.ALE, confidence: 80, version: ALE_VERSION },
    { metric_id: "RRS", score: means.RRS, confidence: 75, version: RRS_VERSION },
  ];
}

/**
 * Build hierarchical VQI offline corpus across entity levels.
 */
export function buildVqiOfflineCorpus(
  weightSet = createDefaultWeightSet(),
): StoredVqiRecord[] {
  // CFI from builtins × locales
  const cfiScores: number[] = [];
  const cfiByDisorder = new Map<string, number[]>();
  const cfiByLang = new Map<string, number[]>();
  for (const disorder of BUILTIN_DISORDERS) {
    for (const locale of ["en-US", "ar-JO"] as const) {
      const age = Math.min(
        disorder.max_age ?? 40,
        Math.max(disorder.min_age ?? 18, 28),
      );
      const gen = generateCaseInstance({
        persona: {
          ...demoPersona,
          identity: {
            age,
            gender: (disorder.allowed_genders[0] as "female") || "female",
          },
        },
        avatarId: "avatar-vqi",
        primaryDisorder: disorder,
        difficulty: "intermediate",
        therapyModality: "cbt",
        locale,
        seed: `vqi-${disorder.slug}-${locale}`,
      });
      if (!gen.ok) continue;
      const cfi =
        (gen.snapshot.clinical_fidelity as { overall?: number } | undefined)
          ?.overall ??
        computeClinicalFidelityIndex(
          cfiInputFromSnapshot(gen.snapshot, disorder),
        ).overall;
      cfiScores.push(cfi);
      const d = cfiByDisorder.get(disorder.slug) ?? [];
      d.push(cfi);
      cfiByDisorder.set(disorder.slug, d);
      const lang = locale.split("-")[0]!;
      const l = cfiByLang.get(lang) ?? [];
      l.push(cfi);
      cfiByLang.set(lang, l);
    }
  }

  const eri = buildEriOfflineCorpus();
  const avi = buildAviOfflineCorpus();
  const ale = buildAleOfflineCorpus();
  const rrs = buildRrsOfflineCorpus().filter(
    (r) => r.dataset_id === "vpsych-platform",
  );

  const platformMeans = {
    CFI: mean(cfiScores),
    ERI: mean(eri.map((r) => r.overall)),
    AVI: mean(avi.map((r) => r.overall)),
    ALE: mean(ale.map((r) => r.overall)),
    RRS: mean(rrs.map((r) => r.overall)),
  };

  const records: StoredVqiRecord[] = [];
  const now = new Date().toISOString();

  const push = (
    entity_type: StoredVqiRecord["entity_type"],
    entity_id: string,
    means: typeof platformMeans,
    extra?: Partial<Parameters<typeof computeVPsychQualityIndex>[0]>,
  ) => {
    const vqi = computeVPsychQualityIndex({
      entity_type,
      entity_id,
      metrics: observationsFromMeans(means),
      weight_set: weightSet,
      prompt_version: PROMPT_ENGINE_VERSION,
      assessment_schema_version: ASSESSMENT_SCHEMA_VERSION,
      competency_graph_version: CGE_ENGINE_VERSION,
      adaptive_curriculum_version: ACE_ENGINE_VERSION,
      platform_release_version: "vpsych-0.1.0",
      persona_version: "maya-chen",
      ...extra,
    });
    records.push({
      overall: vqi.overall,
      entity_type,
      entity_id,
      computed_at: now,
      vqi,
    });
  };

  push("platform", "vpsych", platformMeans);

  // Assessment-level samples
  push("assessment", "asm-platform-mean", platformMeans, {
    model_version: "gpt-research",
  });

  // Learner archetypes from ALE
  for (const a of ale) {
    push(
      "learner",
      a.learner_archetype,
      { ...platformMeans, ALE: a.overall },
    );
  }

  // Disorder-level from CFI
  for (const [slug, xs] of cfiByDisorder) {
    push("disorder", slug, { ...platformMeans, CFI: mean(xs) });
  }

  // Language-level
  for (const [lang, xs] of cfiByLang) {
    push("language", lang, { ...platformMeans, CFI: mean(xs) });
  }

  // Persona
  push("persona", "maya-chen", platformMeans, {
    persona_version: "maya-chen",
  });

  // Instructor / institution / template / release / model
  push("instructor", "default-instructor", platformMeans);
  push("institution", "default-institution", platformMeans);
  push("clinical_template", "builtin-templates", platformMeans, {
    clinical_template_version: 1,
  });
  push("release", "vpsych-0.1.0", platformMeans, {
    platform_release_version: "vpsych-0.1.0",
  });
  push("ai_model", "gpt-research", platformMeans, {
    model_version: "gpt-research",
  });

  return records;
}
