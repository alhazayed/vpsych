/**
 * Layer A — Canonical clinical facts for Module 1.
 *
 * Authored `case_file.consistency_rules` lived in personas/*.case.json but were
 * dropped before the patient prompt (mergeClinicalCore rebuilds ClinicalCore
 * without case_file). This module:
 *   1. extracts / formats consistency rules when case_file is present
 *   2. supplies condensed authored facts for the two certified SPs when the
 *      slim DB clinical_core has no case_file yet
 *   3. adds an instruction-level medication contradiction rule (no structured
 *      med field exists — this is NOT deterministic enforcement)
 *
 * Keep condensed. Never dump the full case file into the prompt.
 */

import type { ClinicalCore } from "@/lib/types";

export type ClinicalCaseFile = {
  consistency_rules?: {
    principle?: string;
    canonical_facts_immutable?: string[];
    numerical_consistency?: string;
    [key: string]: unknown;
  };
  psychiatric_history?: {
    previous_medications?: unknown[];
    medication_response_summary?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type CanonicalFactsInput = {
  clinical_core: ClinicalCore;
  /** Avatar slug — used for authored fallback when case_file is absent. */
  avatarSlug?: string | null;
  /** Session locale (en* / ar*). */
  locale?: string | null;
};

/** Condensed facts for jordan-hale when DB clinical_core lacks case_file. */
const JORDAN_HALE_FACTS: ClinicalCaseFile = {
  consistency_rules: {
    principle:
      "This patient is one continuous person. Facts do not drift. If a therapist misquotes a clinical quantity, correct it immediately and precisely.",
    canonical_facts_immutable: [
      "Age 34 (not 35). Born 1991.",
      "Current episode began about 14 months ago; worry-prone since about age 12.",
      "Two full panic attacks in 14 months (ED visit 9 months ago; parking garage 4 months ago). Limited-symptom attacks about monthly. That count does not change.",
      "SSRI at a starting dose for exactly 12 days in January 2026 — then stopped unilaterally. Never titrated. Never followed up. You do NOT currently take an SSRI.",
      "You are NOT on sertraline. Your younger sibling has treated panic disorder and takes sertraline — that medication belongs to them, never to you.",
      "Beta-blocker as required since ~5 months ago (use creeping to most meetings).",
      "Non-prescribed alprazolam 0.5 mg on exactly two occasions (Feb and May 2026). Never a third.",
      "Sleep-onset latency 60–90 minutes; total sleep 5–6 hours.",
      "NO suicidal ideation, ever. No self-harm, ever.",
    ],
    numerical_consistency:
      "Clinical quantities are identical in every session, in every language, to every therapist — age, panic-attack count, days on the SSRI, sleep hours, benzo occasions. If a therapist misquotes one, correct it immediately and precisely.",
  },
  psychiatric_history: {
    medication_response_summary:
      "No adequate SSRI trial has ever occurred (12 days at a starting dose, stopped during early activation). You currently take a beta-blocker PRN and abandoned hydroxyzine. You do not take sertraline.",
  },
};

const MAYA_CHEN_FACTS: ClinicalCaseFile = {
  consistency_rules: {
    principle:
      "This patient is one continuous person. Facts do not drift. If a therapist misquotes a clinical quantity, correct it immediately and precisely.",
    canonical_facts_immutable: [
      "Age 28.",
      "Recurrent major depressive episode with anxious distress — quantities and timelines from the authored case do not drift.",
      "NO active suicidal plan. Passive ideation only as authored disclosure rules allow.",
    ],
    numerical_consistency:
      "Clinical quantities are identical in every session, in every language, to every therapist. If a therapist misquotes one, correct it immediately and precisely.",
  },
};

const AUTHORED_BY_SLUG: Record<string, ClinicalCaseFile> = {
  "jordan-hale": JORDAN_HALE_FACTS,
  "maya-chen": MAYA_CHEN_FACTS,
};

export function authoredCaseFileForSlug(
  slug?: string | null,
): ClinicalCaseFile | null {
  if (!slug) return null;
  return AUTHORED_BY_SLUG[slug] ?? null;
}

/** Prefer snapshot/avatar case_file; fall back to condensed authored facts. */
export function resolveCaseFile(
  clinical_core: ClinicalCore,
  avatarSlug?: string | null,
): ClinicalCaseFile | null {
  const fromCore = (clinical_core as ClinicalCore & {
    case_file?: ClinicalCaseFile | null;
  }).case_file;
  if (fromCore && typeof fromCore === "object") return fromCore;
  return authoredCaseFileForSlug(avatarSlug);
}

/**
 * Attach authored case_file onto a clinical_core when missing.
 * Pure — does not mutate the input object.
 */
export function withPreservedCaseFile(
  clinical_core: ClinicalCore,
  avatarSlug?: string | null,
): ClinicalCore {
  const existing = (clinical_core as ClinicalCore & {
    case_file?: ClinicalCaseFile | null;
  }).case_file;
  if (existing && typeof existing === "object") return clinical_core;
  const authored = authoredCaseFileForSlug(avatarSlug);
  if (!authored) return clinical_core;
  return { ...clinical_core, case_file: authored };
}

function isArabicLocale(locale?: string | null): boolean {
  return Boolean(locale && locale.toLowerCase().startsWith("ar"));
}

/**
 * Instruction-level medication contradiction rule.
 * NOT deterministic — no structured medication field exists on ClinicalCore.
 */
function medicationInstructionBlock(locale?: string | null): string {
  if (isArabicLocale(locale)) {
    return [
      "أدوية — قاعدة إلزامية (طبقة تعليمات فقط، مو قاعدة بيانات):",
      "- ما بتنسب لحالك أي دواء أو جرعة أو مدة ما انذكرت بملفك السريري.",
      "- إذا المعالج قال إنك بتاخذ دواء مو إلك (مثل سيرترالين/Zoloft) أو غيّر الجرعة أو المدّة: صحّح فوراً وبدقة. لا تتبنى الغلط.",
      "- أدوية أفراد العيلة تبقى إلهم: أختك/أخوك على سيرترالين إن وُجد — مش إنت.",
      "- الدواء اللي وقفّيته بعد ١٢ يوم (جرعة بداية) وقفانه إلّك؛ ما بتعود تاخده هسّه.",
    ].join("\n");
  }
  return [
    "Medications — mandatory rule (instruction-level only; no structured med field):",
    "- Do NOT adopt any medication, dose, or duration the therapist attributes to you unless it is already in your clinical facts.",
    "- If the therapist says you take a drug that is not yours (e.g. sertraline/Zoloft) or changes dose/duration: correct immediately and precisely. Never silently accept the error.",
    "- Family members' medications stay theirs (e.g. a sibling on sertraline is NOT you).",
    "- An SSRI you stopped after 12 days at a starting dose remains stopped — you are not currently on it.",
  ].join("\n");
}

function genderAgreementBlock(
  gender: ClinicalCore["gender"],
  locale?: string | null,
): string {
  if (!isArabicLocale(locale)) return "";
  if (gender === "male") {
    return [
      "اتفاق الجنس (عربي) — إلزامي:",
      "- إنت ذكر. استخدم صيغ المذكر فقط (آسف، مش آسفة؛ حجزت، مش حجزتِ؛ بحس، مش بحسّي).",
      "- لا تستخدم تاء التأنيث على نفسك أبداً.",
    ].join("\n");
  }
  if (gender === "female") {
    return [
      "اتفاق الجنس (عربي) — إلزامي:",
      "- إنتي أنثى. استخدمي صيغ المؤنث المتسقة مع شخصيتك.",
    ].join("\n");
  }
  return [
    "اتفاق الجنس (عربي) — إلزامي:",
    "- حافظ على اتفاق الجنس المطابق لهويتك المؤلفة؛ لا تبدّل فجأة بين المذكّر والمؤنث.",
  ].join("\n");
}

/**
 * Format Module 1 canonical-facts block. Empty string when nothing to inject.
 */
export function formatCanonicalFactsForPrompt(
  input: CanonicalFactsInput,
): string {
  const caseFile = resolveCaseFile(input.clinical_core, input.avatarSlug);
  const rules = caseFile?.consistency_rules;
  const age = input.clinical_core.age;
  const lines: string[] = [];

  lines.push("CANONICAL CLINICAL FACTS (immutable this session — Module 1):");
  lines.push(
    `- Authored age: ${age}. If the therapist says a different age, correct immediately to ${age}.`,
  );

  if (rules?.canonical_facts_immutable?.length) {
    lines.push("Immutable facts (do not invent, drop, or swap):");
    for (const fact of rules.canonical_facts_immutable) {
      lines.push(`- ${fact}`);
    }
  }

  if (rules?.numerical_consistency?.trim()) {
    lines.push(`Numerical consistency: ${rules.numerical_consistency.trim()}`);
  } else {
    lines.push(
      "Numerical consistency: clinical quantities are identical every session; if the therapist misquotes one, correct it immediately and precisely.",
    );
  }

  if (caseFile?.psychiatric_history?.medication_response_summary?.trim()) {
    lines.push(
      `Medication summary: ${caseFile.psychiatric_history.medication_response_summary.trim()}`,
    );
  }

  lines.push(medicationInstructionBlock(input.locale));

  // Arabic male SP: identity gender may still be non-binary on the English
  // avatar row; jordan-hale Arabic personality is male (رامي). Prefer locale
  // male agreement when Arabic + jordan-hale.
  const genderForAgreement =
    isArabicLocale(input.locale) && input.avatarSlug === "jordan-hale"
      ? "male"
      : input.clinical_core.gender;
  const genderBlock = genderAgreementBlock(genderForAgreement, input.locale);
  if (genderBlock) lines.push(genderBlock);

  return lines.join("\n");
}
