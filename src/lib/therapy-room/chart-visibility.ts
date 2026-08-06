/**
 * Difficulty-gated chart visibility for pre-session review.
 *
 * Beginner: fuller chart (scaffolded). Expert: sparse chart (trainee must elicit).
 */

import type { CaseDifficulty } from "@/lib/case-engine/types";
import type { ChartSectionId } from "./types";

const ALWAYS: ChartSectionId[] = [
  "referral_letter",
  "chief_complaint",
  "session_number",
  "risk_alerts",
];

const BY_DIFFICULTY: Record<CaseDifficulty, ChartSectionId[]> = {
  beginner: [
    ...ALWAYS,
    "previous_summary",
    "current_medication",
    "previous_notes",
    "homework_status",
    "laboratory",
    "psychological_testing",
    "diagnosis",
  ],
  intermediate: [
    ...ALWAYS,
    "previous_summary",
    "current_medication",
    "previous_notes",
    "homework_status",
    "diagnosis",
  ],
  advanced: [
    ...ALWAYS,
    "previous_summary",
    "current_medication",
    "homework_status",
  ],
  expert: [...ALWAYS],
};

export function chartSectionsForDifficulty(
  difficulty: CaseDifficulty | null | undefined,
): ChartSectionId[] {
  const d = difficulty ?? "intermediate";
  return BY_DIFFICULTY[d] ?? BY_DIFFICULTY.intermediate;
}

export function isChartSectionVisible(
  section: ChartSectionId,
  difficulty: CaseDifficulty | null | undefined,
): boolean {
  return chartSectionsForDifficulty(difficulty).includes(section);
}
