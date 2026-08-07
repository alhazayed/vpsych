import { randomUUID } from "crypto";
import {
  findDifficulty,
  findTherapy,
  getBuiltinCatalog,
} from "@/lib/case-engine/catalog";
import { validateCaseGeneration } from "@/lib/case-engine/validation";
import type {
  CaseGenerationRequest,
  CaseInstanceSnapshot,
  CaseSeverity,
  DifficultyModifiers,
  RandomizedContext,
} from "@/lib/case-engine/types";
import { buildGenerationScientificMeta } from "@/lib/scientific/versions";
import {
  computeClinicalFidelityIndex,
  cfiInputFromSnapshot,
} from "@/lib/cfi";
import {
  formatSpeechBehaviorForPrompt,
  speechBehaviorForDisorder,
} from "@/lib/case-engine/speech-behavior";
import type { ClinicalCore, DisclosureRule } from "@/lib/types";
import { freezeHumanPersonalityForCase } from "@/lib/personality-engine";

/** Prefer richer notes when both package and persona share a disclosure topic. */
export function mergeDisclosureRules(
  primary?: DisclosureRule[] | null,
  secondary?: DisclosureRule[] | null,
): DisclosureRule[] {
  const map = new Map<string, DisclosureRule>();
  for (const rule of [...(secondary ?? []), ...(primary ?? [])]) {
    const key = rule.topic.trim().toLowerCase();
    const prev = map.get(key);
    if (!prev) {
      map.set(key, rule);
      continue;
    }
    const prevNotes = prev.notes?.length ?? 0;
    const nextNotes = rule.notes?.length ?? 0;
    map.set(key, nextNotes >= prevNotes ? rule : prev);
  }
  return [...map.values()];
}

/** Simple seeded PRNG (mulberry32). */
export function createRng(seed: string | number): () => number {
  let h =
    typeof seed === "number"
      ? seed >>> 0
      : Array.from(String(seed)).reduce(
          (acc, ch) => (Math.imul(31, acc) + ch.charCodeAt(0)) >>> 0,
          0,
        );
  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

const STRESSORS = [
  "recent job instability",
  "conflict with a close family member",
  "a health scare in someone close",
  "an unexpected bill",
  "disruption to daily routine",
  "a difficult anniversary approaching",
];

const FINANCES = [
  "tight but managing month to month",
  "recent income drop of about 30%",
  "stable salary with rising expenses",
  "relying on savings for the past quarter",
];

const RELATIONSHIPS = [
  "supportive but emotionally distant household contact",
  "a close friend who checks in weekly",
  "strained communication with a parent",
  "living with family with limited privacy",
];

const MINOR_EVENTS = [
  "missed a social invitation last weekend",
  "forgot an appointment and felt ashamed",
  "started and abandoned a small hobby project",
  "slept through an alarm twice this week",
];

const OCCUPATION_VARIANTS = [
  "freelance project work",
  "shift-based employment",
  "office-based role with remote days",
  "caregiving layered onto paid work",
];

export function randomizeContext(rng: () => number): RandomizedContext {
  return {
    recent_stressor: pick(rng, STRESSORS),
    financial_situation: pick(rng, FINANCES),
    relationship_detail: pick(rng, RELATIONSHIPS),
    minor_life_event: pick(rng, MINOR_EVENTS),
    timeline_offset_weeks: 2 + Math.floor(rng() * 10),
    occupation_variant: pick(rng, OCCUPATION_VARIANTS),
  };
}

function applyDifficultyToDisclosure(
  rules: DisclosureRule[],
  modifiers: DifficultyModifiers,
): DisclosureRule[] {
  const disclosure = modifiers.disclosure;
  return rules.map((rule) => {
    if (rule.condition === "never") return rule;
    if (disclosure === "high" || disclosure === "mixed") return rule;
    if (disclosure === "guarded" && rule.condition === "volunteered") {
      return {
        ...rule,
        condition: "on_direct_question",
        notes: [rule.notes, "Difficulty: volunteered topics require direct ask"]
          .filter(Boolean)
          .join(" | "),
      };
    }
    if (
      (disclosure === "minimal" || disclosure === "guarded") &&
      rule.condition === "on_direct_question"
    ) {
      return {
        ...rule,
        condition: "on_empathic_rapport",
        notes: [rule.notes, "Difficulty: needs rapport before disclosure"]
          .filter(Boolean)
          .join(" | "),
      };
    }
    return rule;
  });
}

function mergeClinicalCore(req: CaseGenerationRequest): ClinicalCore {
  const primary = req.primaryDisorder;
  const pkg = primary.package ?? {};
  const legacy = req.legacyClinicalCore;
  const comorbidities = req.comorbidities ?? [];

  const severity: CaseSeverity =
    req.severity ??
    pkg.severity_default ??
    legacy?.severity ??
    "moderate";

  const baseSymptoms =
    pkg.symptom_profile ??
    legacy?.symptom_profile ??
    [];
  const comorbidSymptoms = comorbidities.flatMap(
    (c) => c.package.symptom_profile ?? [],
  );
  // Deduplicate by id
  const symptomMap = new Map<string, ClinicalCore["symptom_profile"][number]>();
  for (const s of [...baseSymptoms, ...comorbidSymptoms]) {
    if (!symptomMap.has(s.id)) symptomMap.set(s.id, s);
  }

  // Union by topic: prefer longer notes; never discard rich persona rules
  // when the builtin package also has a shorter rule for the same topic.
  const disclosure = mergeDisclosureRules(
    pkg.disclosure_rules,
    legacy?.disclosure_rules,
  );

  const comorbidGoals = comorbidities.flatMap(
    (c) => c.package.session_goals ?? [],
  );

  const risk = {
    suicidal_ideation:
      pkg.risk_defaults?.suicidal_ideation ??
      legacy?.risk_profile?.suicidal_ideation ??
      "none",
    self_harm:
      pkg.risk_defaults?.self_harm ?? legacy?.risk_profile?.self_harm ?? false,
    harm_to_others:
      pkg.risk_defaults?.harm_to_others ??
      legacy?.risk_profile?.harm_to_others ??
      false,
    substance_use:
      pkg.risk_defaults?.substance_use ??
      legacy?.risk_profile?.substance_use ??
      false,
    escalation_rules:
      pkg.risk_defaults?.escalation_rules ??
      legacy?.risk_profile?.escalation_rules,
  } as ClinicalCore["risk_profile"];

  const comorbidityNote =
    comorbidities.length > 0
      ? ` Comorbid presentations active: ${comorbidities.map((c) => c.name).join("; ")}.`
      : "";

  return {
    disorder: primary.name,
    dsm5_code: primary.dsm5_code ?? legacy?.dsm5_code,
    icd11_code: primary.icd11_code ?? legacy?.icd11_code,
    age: req.persona.identity.age,
    gender: req.persona.identity.gender,
    severity,
    onset_duration: legacy?.onset_duration ?? "current episode (timeline set at generation)",
    symptom_profile: Array.from(symptomMap.values()),
    disclosure_rules: disclosure,
    session_goals: [
      ...(pkg.session_goals ?? legacy?.session_goals ?? []),
      ...comorbidGoals,
    ].slice(0, 10),
    ideal_approach:
      (pkg.ideal_approach ?? legacy?.ideal_approach ?? "Supportive collaborative interview.") +
      comorbidityNote,
    risk_profile: risk,
  };
}

export type GenerateCaseResult =
  | { ok: true; snapshot: CaseInstanceSnapshot }
  | {
      ok: false;
      issues: { code: string; message: string; path?: string }[];
    };

/**
 * Module 7 — Case Generator.
 * Produces an immutable CaseInstanceSnapshot. Does not write to the database.
 */
export function generateCaseInstance(
  req: CaseGenerationRequest,
): GenerateCaseResult {
  const catalog = getBuiltinCatalog();
  const validation = validateCaseGeneration(req, catalog);
  if (!validation.ok) return validation;

  const difficultyProfile =
    req.difficultyProfile ?? findDifficulty(req.difficulty, catalog)!;
  const therapyProfile =
    req.therapyProfile ?? findTherapy(req.therapyModality, catalog)!;

  const seed =
    req.seed ??
    `${req.persona.slug}:${req.primaryDisorder.slug}:${req.locale}:${Date.now()}`;
  const rng = createRng(seed);
  const randomized = randomizeContext(rng);

  let clinical_core = mergeClinicalCore(req);
  clinical_core = {
    ...clinical_core,
    disclosure_rules: applyDifficultyToDisclosure(
      clinical_core.disclosure_rules,
      difficultyProfile.modifiers,
    ),
    onset_duration: `current episode about ${randomized.timeline_offset_weeks + 8} weeks (randomized timeline; DSM criteria unchanged)`,
    ideal_approach: [
      clinical_core.ideal_approach,
      `Therapy modality: ${therapyProfile.label}.`,
      `Patient reaction cue: ${String(therapyProfile.patient_reaction_rules.alliance_cue ?? "")}`,
      `Difficulty (${difficultyProfile.label}): insight=${difficultyProfile.modifiers.insight}, resistance=${difficultyProfile.modifiers.resistance}, disclosure=${difficultyProfile.modifiers.disclosure}, masking=${difficultyProfile.modifiers.masking}.`,
      `Contextual colour (non-diagnostic): stressor=${randomized.recent_stressor}; finances=${randomized.financial_situation}; ${randomized.minor_life_event}.`,
    ]
      .filter(Boolean)
      .join(" "),
  };

  const assessment_id = `VPSY-ASM-${randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;

  const pkg = req.primaryDisorder.package ?? {};
  const clinical_teaching = {
    differentials: pkg.differentials ?? [],
    rule_outs: pkg.rule_outs ?? [],
    teaching_points: [
      ...(pkg.teaching_points ?? []),
      "Medication history: elicit prior psychotropics, adherence, side effects; do not invent impossible regimens.",
      "Family history: ask about mood/anxiety/psychosis/substance in first-degree relatives when relevant.",
      "Trauma: screen gently; do not force narrative disclosure.",
      "Culture/religion: respect cultural framing of distress; do not rewrite DSM/ICD codes.",
    ],
    common_mistakes: pkg.common_therapist_mistakes ?? [],
    insight_expectation: `Insight consistent with ${req.primaryDisorder.category ?? "psychiatric"} presentation; difficulty insight=${difficultyProfile.modifiers.insight}.`,
    judgment_expectation:
      req.difficulty === "expert" || req.difficulty === "advanced"
        ? "Judgment may be impaired relative to baseline; assess decision-making and safety."
        : "Judgment largely preserved; explore concrete recent decisions.",
    speech_behavior_cue: formatSpeechBehaviorForPrompt(
      speechBehaviorForDisorder(
        req.primaryDisorder.slug,
        req.primaryDisorder.category,
      ),
    ),
  };

  const snapshot: CaseInstanceSnapshot = {
    version: 2,
    assessment_id,
    persona: {
      id: req.persona.id,
      slug: req.persona.slug,
      display_name: req.persona.display_name,
      avatar_id: req.avatarId,
    },
    primary_diagnosis: {
      id: req.primaryDisorder.id,
      slug: req.primaryDisorder.slug,
      name: req.primaryDisorder.name,
      dsm5_code: req.primaryDisorder.dsm5_code,
      icd10_code: req.primaryDisorder.icd10_code,
      icd11_code: req.primaryDisorder.icd11_code,
    },
    comorbidities: (req.comorbidities ?? []).map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      dsm5_code: c.dsm5_code,
      icd11_code: c.icd11_code,
    })),
    difficulty: req.difficulty,
    difficulty_modifiers: difficultyProfile.modifiers,
    therapy_modality: req.therapyModality,
    therapy_reaction_rules: therapyProfile.patient_reaction_rules,
    locale: req.locale,
    severity: clinical_core.severity ?? "moderate",
    clinical_core,
    randomized_context: randomized,
    clinical_teaching,
    memory_scope: "case_instance",
    generated_at: new Date().toISOString(),
    scientific_meta: buildGenerationScientificMeta({
      disorder_package_version: "catalog-builtin-1",
    }),
    human_personality: freezeHumanPersonalityForCase({
      personaSlug: req.persona.slug,
      locale: req.locale,
      personaTraits: req.persona.traits,
      avatar: {
        id: req.avatarId,
        name: req.avatarName ?? req.persona.display_name,
        disorder: req.avatarDisorder ?? "unspecified",
        age: req.persona.identity?.age ?? null,
        gender: req.persona.identity?.gender ?? null,
        slug: req.avatarSlug ?? req.persona.slug,
        human_personality: req.avatarHumanPersonality ?? null,
      },
    }),
  };

  const cfi = computeClinicalFidelityIndex(
    cfiInputFromSnapshot(snapshot, req.primaryDisorder, {
      comorbiditiesCompatible: true,
    }),
  );
  snapshot.clinical_fidelity = {
    overall: cfi.overall,
    confidence_interval: cfi.confidence_interval,
    cfi_version: cfi.versions.cfi_version,
    recommendations: cfi.recommendations,
    clinical_reasoning: cfi.clinical_reasoning,
    evidence: cfi.evidence,
    versions: cfi.versions,
    weight_matrix_version: cfi.weight_matrix_version,
    subscores: cfi.subscores.map((s) => ({
      id: s.id,
      score: s.score,
      weight: s.weight,
      confidence: s.confidence,
    })),
  };

  return { ok: true, snapshot };
}
