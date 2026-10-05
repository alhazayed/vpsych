/**
 * Disorder options for practice scenarios and supervisor-designed skill tests.
 * Read-only views over the Case Engine builtin catalog: nothing here invents a
 * diagnosis or a comorbidity pairing the engine would not accept.
 */

import { BUILTIN_DISORDERS } from "@/lib/case-engine/catalog";
import { getComorbidityCompatibility } from "@/lib/case-engine/comorbidity-compat";
import type { CaseDifficulty, CaseSeverity, PersonaRow } from "@/lib/case-engine/types";
import {
  validateAgeDisorder,
  validateGenderDisorder,
} from "@/lib/case-engine/validation";

export const CASE_DIFFICULTIES: CaseDifficulty[] = [
  "beginner",
  "intermediate",
  "advanced",
  "expert",
];

export const CASE_SEVERITIES: CaseSeverity[] = [
  "subclinical",
  "mild",
  "moderate",
  "severe",
];

export const SKILL_TEST_LANGUAGES = ["en-US", "ar-JO"] as const;

export const MAX_SKILL_TEST_SESSIONS = 12;
export const MAX_SKILL_TEST_COMORBIDITIES = 2;

export type DisorderOption = {
  slug: string;
  name: string;
  category: string | null;
};

/** Active builtin disorders, in catalog order. */
export function listDisorderOptions(): DisorderOption[] {
  return BUILTIN_DISORDERS.filter((d) => d.is_active).map((d) => ({
    slug: d.slug,
    name: d.name,
    category: d.category,
  }));
}

export function isKnownDisorder(slug: string): boolean {
  return BUILTIN_DISORDERS.some((d) => d.slug === slug && d.is_active);
}

/** Comorbidities the Case Engine accepts with this primary diagnosis. */
export function listAllowedComorbidities(primarySlug: string): string[] {
  return listDisorderOptions()
    .map((d) => d.slug)
    .filter(
      (slug) =>
        slug !== primarySlug &&
        getComorbidityCompatibility(primarySlug, slug).previewAllowed,
    );
}

export type PatientIdentity = {
  age: number | null | undefined;
  gender: string | null | undefined;
};

/**
 * Whether a patient persona can present with this disorder (age and gender
 * limits from the disorder package), using the Case Engine's own validators.
 */
export function isPatientCompatible(
  disorderSlug: string,
  patient: PatientIdentity,
): boolean {
  const disorder = BUILTIN_DISORDERS.find(
    (d) => d.slug === disorderSlug && d.is_active,
  );
  if (!disorder) return false;
  const persona = {
    identity: {
      age: typeof patient.age === "number" ? patient.age : 30,
      gender: (patient.gender ?? "unspecified") as PersonaRow["identity"]["gender"],
    },
  } as PersonaRow;
  return (
    validateAgeDisorder(persona, disorder).length === 0 &&
    validateGenderDisorder(persona, disorder).length === 0
  );
}
