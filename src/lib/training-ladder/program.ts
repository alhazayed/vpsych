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
  /**
   * True while the patient is a stand-in for testing the ladder flow, before
   * the program's own patients are authored.
   */
  provisional?: boolean;
};

/**
 * Maya (MDD) is the provisional first patient. Her authored case file rules
 * out four of the five comorbidities the catalogue allows with MDD (GAD,
 * PTSD, alcohol use, borderline personality) and states no self-harm ever;
 * her passive ideation is authored. Panic disorder is not ruled out but is
 * not part of her authored picture either, so her stand-in ladder adds no
 * comorbidity and no self-harm history.
 */
export const LADDER_PATIENTS: readonly LadderPatient[] = [
  {
    key: "maya",
    slot: 1,
    avatarSlug: "maya-chen",
    primaryDisorderSlug: "mdd-recurrent-moderate",
    comorbiditiesByLevel: [[], [], [], [], []],
    risk: { selfHarmHistory: false },
    provisional: true,
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
