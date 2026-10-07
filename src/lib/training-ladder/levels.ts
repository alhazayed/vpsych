/**
 * Patient training ladder: five levels per patient, Easy to Expert.
 *
 * Each level maps onto an existing Case Engine difficulty profile; Basic and
 * Intermediate share the "intermediate" profile and differ by the authored
 * comorbidity the patient's ladder adds at Intermediate. No new difficulty
 * profile or clinical rule is introduced here.
 */
import type { CaseDifficulty } from "@/lib/case-engine/types";

export type LadderLevel = 1 | 2 | 3 | 4 | 5;

export type LadderLevelKey =
  | "easy"
  | "basic"
  | "intermediate"
  | "advanced"
  | "expert";

export type LadderLevelDef = {
  level: LadderLevel;
  key: LadderLevelKey;
  /** Case Engine difficulty profile used for the encounter. */
  difficulty: CaseDifficulty;
};

export const LADDER_LEVELS: readonly LadderLevelDef[] = [
  { level: 1, key: "easy", difficulty: "beginner" },
  { level: 2, key: "basic", difficulty: "intermediate" },
  { level: 3, key: "intermediate", difficulty: "intermediate" },
  { level: 4, key: "advanced", difficulty: "advanced" },
  { level: 5, key: "expert", difficulty: "expert" },
];

export const LADDER_LEVEL_COUNT = LADDER_LEVELS.length;

export function isLadderLevel(value: unknown): value is LadderLevel {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= LADDER_LEVEL_COUNT
  );
}

export function ladderLevelDef(level: LadderLevel): LadderLevelDef {
  return LADDER_LEVELS[level - 1]!;
}

/**
 * Pass mark: the session's overall score from the existing report must be
 * strictly greater than 55. 55 fails, 55.01 passes. The same rule lives in
 * the database trigger that grades attempts
 * (`training_ladder_grade_attempt`); a test keeps the two in step.
 */
export const LADDER_PASS_THRESHOLD = 55;

export function isLadderPass(score: number | null | undefined): boolean {
  return (
    typeof score === "number" &&
    Number.isFinite(score) &&
    score > LADDER_PASS_THRESHOLD
  );
}
