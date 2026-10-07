/**
 * The training program: which patients have a ladder, their primary disorder,
 * and the authored comorbidities each level adds.
 *
 * Rules (enforced by `program.test.ts`):
 * - A patient keeps one identity and one primary disorder on every level.
 * - Comorbidities come only from the Case Engine's authored compatibility
 *   matrix (`BUILTIN_COMORBIDITY_RULES`); nothing here makes a pair
 *   compatible.
 * - A comorbidity is only added when the patient's own authored case file
 *   does not rule it out.
 *
 * The database mirror (`training_ladder_patients`) binds each key to its
 * avatar so the server can check a session belongs to the right patient.
 */
import type { LadderLevel } from "@/lib/training-ladder/levels";

export type LadderRiskProfile = {
  /** Authored lifetime self-harm. Never added where the case file denies it. */
  selfHarmHistory: boolean;
};

export type LadderPatient = {
  key: string;
  /** Display order, 1-based ("Patient 01"). */
  slot: number;
  avatarSlug: string;
  primaryDisorderSlug: string;
  /** Authored comorbidity slugs per level, index 0 = Easy. */
  comorbiditiesByLevel: readonly [
    readonly string[],
    readonly string[],
    readonly string[],
    readonly string[],
    readonly string[],
  ];
  risk: LadderRiskProfile;
};

/**
 * The ten program patients (five female, five male), one primary disorder
 * each. Their identities are authored natively in English and Arabic in
 * `personas/ladder/<avatarSlug>.json`; `patient-files.test.ts` checks every
 * file against the publish gate and mints each level's case from it.
 *
 * Panic disorder, complex PTSD and bipolar mania have no authored
 * comorbidity in the catalogue, so their levels get harder through
 * difficulty and risk assessment only. Delirium is the one catalogue
 * disorder left out (a medical emergency, not a therapy ladder).
 *
 * Maya Chen was the provisional patient while these were written; she stays
 * in the Patient Library and her ladder row is retired in the database.
 */
export const LADDER_PATIENTS: readonly LadderPatient[] = [
  {
    key: "ethan",
    slot: 1,
    avatarSlug: "ethan-cole",
    primaryDisorderSlug: "mdd-recurrent-moderate",
    comorbiditiesByLevel: [
      [],
      [],
      ["gad-with-panic"],
      ["ptsd"],
      ["ptsd", "alcohol-use-disorder"],
    ],
    risk: { selfHarmHistory: false },
  },
  {
    key: "rachel",
    slot: 2,
    avatarSlug: "rachel-kim",
    primaryDisorderSlug: "gad-with-panic",
    comorbiditiesByLevel: [
      [],
      [],
      ["mdd-recurrent-moderate"],
      ["alcohol-use-disorder"],
      ["mdd-recurrent-moderate", "alcohol-use-disorder"],
    ],
    risk: { selfHarmHistory: false },
  },
  {
    key: "laura",
    slot: 3,
    avatarSlug: "laura-bennett",
    primaryDisorderSlug: "ptsd",
    comorbiditiesByLevel: [
      [],
      [],
      ["mdd-recurrent-moderate"],
      ["alcohol-use-disorder"],
      ["mdd-recurrent-moderate", "alcohol-use-disorder"],
    ],
    risk: { selfHarmHistory: true },
  },
  {
    key: "tyler",
    slot: 4,
    avatarSlug: "tyler-grant",
    primaryDisorderSlug: "adult-adhd",
    comorbiditiesByLevel: [
      [],
      [],
      ["gad-with-panic"],
      ["gad-with-panic"],
      ["gad-with-panic"],
    ],
    risk: { selfHarmHistory: false },
  },
  {
    key: "karen",
    slot: 5,
    avatarSlug: "karen-doyle",
    primaryDisorderSlug: "alcohol-use-disorder",
    comorbiditiesByLevel: [
      [],
      [],
      ["gad-with-panic"],
      ["gad-with-panic"],
      ["gad-with-panic"],
    ],
    risk: { selfHarmHistory: false },
  },
  {
    key: "emily",
    slot: 6,
    avatarSlug: "emily-shaw",
    primaryDisorderSlug: "panic-disorder",
    comorbiditiesByLevel: [[], [], [], [], []],
    risk: { selfHarmHistory: false },
  },
  {
    key: "jake",
    slot: 7,
    avatarSlug: "jake-moreno",
    primaryDisorderSlug: "bpd",
    comorbiditiesByLevel: [
      [],
      [],
      ["mdd-recurrent-moderate"],
      ["mdd-recurrent-moderate"],
      ["mdd-recurrent-moderate"],
    ],
    risk: { selfHarmHistory: true },
  },
  {
    key: "nadia",
    slot: 8,
    avatarSlug: "nadia-price",
    primaryDisorderSlug: "complex-ptsd",
    comorbiditiesByLevel: [[], [], [], [], []],
    risk: { selfHarmHistory: true },
  },
  {
    key: "marcus",
    slot: 9,
    avatarSlug: "marcus-hill",
    primaryDisorderSlug: "schizophrenia",
    comorbiditiesByLevel: [
      [],
      [],
      ["gad-with-panic"],
      ["gad-with-panic"],
      ["gad-with-panic"],
    ],
    risk: { selfHarmHistory: false },
  },
  {
    key: "chris",
    slot: 10,
    avatarSlug: "chris-walsh",
    primaryDisorderSlug: "bipolar-mania",
    comorbiditiesByLevel: [[], [], [], [], []],
    risk: { selfHarmHistory: false },
  },
];

export function findLadderPatient(key: unknown): LadderPatient | null {
  if (typeof key !== "string") return null;
  return LADDER_PATIENTS.find((p) => p.key === key) ?? null;
}

export function ladderComorbidities(
  patient: LadderPatient,
  level: LadderLevel,
): string[] {
  return [...patient.comorbiditiesByLevel[level - 1]!];
}
