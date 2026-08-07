/**
 * TherapyAlliance read model + adherence helpers (Adaptation owner).
 */

import type { PatientAdaptationState } from "@/lib/adaptation/types";
import type {
  HomeworkAdherence,
  MedicationAdherence,
  TherapyAlliance,
  TreatmentAdherence,
} from "@/lib/clinical-intelligence/types";
import { clamp01to100 } from "@/lib/clinical-intelligence/clamp";

export function therapyAllianceFromAdaptation(
  state: PatientAdaptationState,
): TherapyAlliance {
  return {
    rapport: state.rapport.level,
    trust: state.trust.level,
    stance: state.stance,
    disclosure_readiness: state.effects.disclosure_readiness,
    engagement: state.effects.engagement,
    withdrawal: state.effects.withdrawal,
    anger: state.effects.anger,
    sessions_together: state.rapport.sessions_together,
  };
}

export function defaultHomeworkAdherence(): HomeworkAdherence {
  return {
    assigned: false,
    completed_band: "none",
    barriers: [],
  };
}

export function defaultMedicationAdherence(): MedicationAdherence {
  return {
    adherence_band: "unknown",
  };
}

export function defaultTreatmentAdherence(
  alliance?: TherapyAlliance | null,
): TreatmentAdherence {
  const overall = alliance
    ? clamp01to100(
        alliance.engagement * 0.4 +
          alliance.trust * 0.4 +
          alliance.disclosure_readiness * 0.2,
      )
    : 40;
  return {
    attendance_band: "unknown",
    overall,
    homework: defaultHomeworkAdherence(),
    medication: defaultMedicationAdherence(),
  };
}

/**
 * Deterministic homework update from alliance + conscientiousness (1–5) + effect delta.
 */
export function updateHomeworkAdherence(input: {
  current: HomeworkAdherence;
  allianceTrust: number;
  conscientiousness: number; // 1–5 HPE
  assignedThisTurn?: boolean;
  delta?: number;
}): HomeworkAdherence {
  const next: HomeworkAdherence = {
    ...input.current,
    barriers: [...(input.current.barriers ?? [])],
  };
  if (input.assignedThisTurn) {
    next.assigned = true;
    next.last_assignment_summary = "Homework discussed this turn";
  }
  if (!next.assigned) return next;

  const readiness =
    input.allianceTrust * 0.6 +
    ((input.conscientiousness - 1) / 4) * 100 * 0.4 +
    (input.delta ?? 0) * 5;
  if (readiness >= 70) next.completed_band = "full";
  else if (readiness >= 40) next.completed_band = "partial";
  else {
    next.completed_band = "none";
    if (!next.barriers?.includes("low_alliance_or_activation")) {
      next.barriers = [...(next.barriers ?? []), "low_alliance_or_activation"];
    }
  }
  return next;
}

export function recomputeTreatmentOverall(
  adherence: TreatmentAdherence,
  alliance?: TherapyAlliance | null,
): TreatmentAdherence {
  const hw =
    adherence.homework.completed_band === "full"
      ? 90
      : adherence.homework.completed_band === "partial"
        ? 55
        : adherence.homework.assigned
          ? 25
          : 40;
  const med =
    adherence.medication.adherence_band === "full"
      ? 90
      : adherence.medication.adherence_band === "partial"
        ? 55
        : adherence.medication.adherence_band === "none"
          ? 20
          : 50;
  const all = alliance?.trust ?? adherence.overall;
  return {
    ...adherence,
    overall: clamp01to100(hw * 0.35 + med * 0.25 + all * 0.4),
  };
}
