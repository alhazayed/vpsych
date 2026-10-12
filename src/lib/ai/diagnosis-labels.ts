/**
 * Diagnosis labels a skill-test patient must never say.
 *
 * A skill test is an exam: the trainee has to work the case out. The patient
 * model is still told its diagnosis (it needs it to act the symptoms), so the
 * reply gate rejects a test reply that names the diagnosis or a comorbidity,
 * and the model redrafts without it.
 *
 * Only formal labels and their abbreviations are listed, in English and
 * Arabic. Symptom words ("depressed", "anxious", "panic attack", "مكتئب") stay
 * allowed: the patient has to be able to describe what they live with.
 * Practice sessions never get a label list, so they are unaffected.
 */

import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";

/** Formal labels per catalogue slug (see messages/*.json skillTests.disorders). */
const LABELS_BY_SLUG: Record<string, readonly string[]> = {
  "mdd-recurrent-moderate": [
    "major depressive disorder",
    "major depression",
    "depressive disorder",
    "clinical depression",
    "MDD",
    "اضطراب الاكتئاب",
    "الاكتئاب الجسيم",
    "اكتئاب جسيم",
    "اكتئاب سريري",
  ],
  "gad-with-panic": [
    "generalized anxiety disorder",
    "generalised anxiety disorder",
    "anxiety disorder",
    "GAD",
    "اضطراب القلق",
    "القلق العام",
    "قلق عام",
  ],
  ptsd: [
    "post-traumatic stress",
    "posttraumatic stress",
    "PTSD",
    "ما بعد الصدمة",
  ],
  "complex-ptsd": [
    "complex PTSD",
    "post-traumatic stress",
    "posttraumatic stress",
    "PTSD",
    "CPTSD",
    "ما بعد الصدمة",
  ],
  "adult-adhd": [
    "attention deficit",
    "ADHD",
    "ADD",
    "نقص الانتباه",
    "فرط الحركة",
    "تشتت الانتباه",
  ],
  "alcohol-use-disorder": [
    "alcohol use disorder",
    "alcohol dependence",
    "alcoholism",
    "AUD",
    "تعاطي الكحول",
    "ادمان الكحول",
    "إدمان الكحول",
  ],
  "panic-disorder": ["panic disorder", "اضطراب الهلع"],
  bpd: [
    "borderline personality",
    "personality disorder",
    "BPD",
    "الشخصية الحدية",
    "اضطراب الشخصية",
  ],
  schizophrenia: ["schizophrenia", "schizophrenic", "schizoaffective", "فصام"],
  "bipolar-mania": [
    "bipolar",
    "manic depression",
    "manic-depressive",
    "manic depressive",
    "ثنائي القطب",
    "الهوس الاكتئابي",
  ],
  delirium: ["delirium", "هذيان"],
};

const ARABIC_LETTER = /\p{Script=Arabic}/u;
/** All capitals (optionally with a hyphen): matched case-sensitively, so "ADD" never trips "add". */
const ACRONYM = /^[A-Z][A-Z-]*[A-Z]$/;

/** Fold Arabic spelling variants (diacritics, alef/ya/ta marbuta forms). */
function foldArabic(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[ً-ْٰـ]/gu, "")
    .replace(/[أإآٱ]/gu, "ا")
    .replace(/ة/gu, "ه")
    .replace(/ى/gu, "ي")
    .replace(/ؤ/gu, "و")
    .replace(/ئ/gu, "ي");
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The labels a test patient must not say: the curated list for each sealed
 * diagnosis and comorbidity, plus the case's own diagnosis names.
 */
export function sealedDiagnosisLabels(
  snapshot: Pick<CaseInstanceSnapshot, "primary_diagnosis" | "comorbidities">
    | null
    | undefined,
): string[] {
  if (!snapshot?.primary_diagnosis) return [];
  const diagnoses = [snapshot.primary_diagnosis, ...(snapshot.comorbidities ?? [])];
  const labels = new Set<string>();
  for (const dx of diagnoses) {
    for (const label of LABELS_BY_SLUG[dx.slug] ?? []) labels.add(label);
    const name = dx.name?.trim();
    if (name) labels.add(name);
  }
  return [...labels];
}

function labelMatches(label: string, text: string, folded: string): boolean {
  if (ARABIC_LETTER.test(label)) {
    return folded.includes(foldArabic(label));
  }
  const body = escapeRegExp(label.trim()).replace(/[\s-]+/g, "[\\s-]+");
  const flags = ACRONYM.test(label) ? "u" : "iu";
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, flags).test(text);
}

/** True when `text` says any of `labels`. */
export function namesSealedDiagnosis(
  text: string,
  labels: readonly string[] | null | undefined,
): boolean {
  if (!text || !labels?.length) return false;
  const folded = foldArabic(text);
  return labels.some((label) => labelMatches(label, text, folded));
}
