import type { ConsortFlow } from "./types";

/**
 * Build a CONSORT-style flow diagram summary from study funnel counts.
 * Narrative reporting still requires human protocol text (see docs/cvp/CONSORT).
 */
export function buildConsortFlow(input: {
  invited: number;
  excluded: number;
  enrolled: number;
  allocatedStandard: number;
  allocatedControl: number;
  allocatedBlind: number;
  completedAssignments: number;
  completedOutcomes: number;
  analysed: number;
  notes?: string[];
}): ConsortFlow {
  const randomized =
    input.allocatedStandard + input.allocatedControl + input.allocatedBlind;
  return {
    assessed_for_eligibility: input.invited,
    excluded: input.excluded,
    randomized,
    allocated_intervention: input.allocatedStandard + input.allocatedBlind,
    allocated_control: input.allocatedControl,
    received_intervention: input.completedAssignments,
    completed_followup: input.completedOutcomes,
    analysed: input.analysed,
    notes: input.notes ?? [
      "Adapt CONSORT for educational simulation trials; not a clinical drug trial.",
      "Report allocation concealment (seeded assignment) and blinding of condition codes.",
    ],
  };
}
