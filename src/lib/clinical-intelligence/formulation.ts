/**
 * Patient formulation builder — Case Engine teaching package.
 */

import type { PatientFormulation } from "@/lib/clinical-intelligence/types";
import { FORMULATION_VERSION } from "@/lib/clinical-intelligence/types";
import {
  buildFormulationFromSeed,
  findFormulationSeed,
} from "@/lib/clinical-intelligence/package-seeds";
import { validatePatientFormulation } from "@/lib/clinical-intelligence/validation";

export function promotePatientFormulation(input: {
  disorderSlug?: string | null;
  personaValues?: string[] | null;
  authored?: PatientFormulation | null;
}): PatientFormulation {
  if (input.authored) {
    const check = validatePatientFormulation(input.authored);
    if (check.ok) return structuredClone(input.authored);
  }

  const seed = findFormulationSeed(input.disorderSlug);
  const formulation = buildFormulationFromSeed(seed);

  if (input.personaValues?.length) {
    const existing = new Set(formulation.values.map((v) => v.label.toLowerCase()));
    for (const label of input.personaValues) {
      if (existing.has(label.toLowerCase())) continue;
      formulation.values.push({
        id: `v-persona-${label.toLowerCase().replace(/\W+/g, "-").slice(0, 40)}`,
        label,
        weight: 55,
      });
    }
  }

  formulation.version = FORMULATION_VERSION;
  return formulation;
}

/**
 * Soften belief strength deterministically (statements never rewrite).
 * Used by longitudinal / therapy-effect paths.
 */
export function applyBeliefStrengthOverride(
  formulation: PatientFormulation,
  overrides: Record<string, number>,
): PatientFormulation {
  if (!Object.keys(overrides).length) return formulation;
  return {
    ...formulation,
    belief_system: {
      ...formulation.belief_system,
      core_beliefs: formulation.belief_system.core_beliefs.map((b) =>
        overrides[b.id] !== undefined
          ? { ...b, strength: Math.max(0, Math.min(100, overrides[b.id]!)) }
          : b,
      ),
    },
  };
}
