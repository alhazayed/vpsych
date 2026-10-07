/**
 * Trainee-facing practice checklist — which observable practices the trainee
 * did or missed in a session, grouped. Deliberately carries no score, count,
 * coverage or narrative: the performance report stays admin-only.
 *
 * Built from the same `evaluateSessionPractice` result the admin panel uses;
 * only practices expected in this session are listed.
 */

import type {
  PracticeCheckId,
  PracticeGroup,
  SessionPracticeReport,
} from "@/lib/session-practice/types";

export type TraineeChecklistItem = { id: PracticeCheckId; done: boolean };

export type TraineeChecklistGroup = {
  group: PracticeGroup;
  items: TraineeChecklistItem[];
};

export function buildTraineeChecklist(
  report: SessionPracticeReport,
): TraineeChecklistGroup[] {
  return report.groups
    .filter((g) => g.applicable)
    .map((g) => ({
      group: g.group,
      items: report.checks
        .filter((c) => c.group === g.group && c.applicable)
        .map((c) => ({ id: c.id, done: c.detected })),
    }))
    .filter((g) => g.items.length > 0);
}
