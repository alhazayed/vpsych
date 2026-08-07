/**
 * Recovery trajectory, relapse risk, longitudinal evolution.
 * Deterministic, explainable, auditable — never silent DSM cure.
 */

import type {
  ClinicalIntelligenceMindState,
  EvolutionHorizon,
  InsightBand,
  RecoveryStage,
  RecoveryTrajectory,
  RelapseRisk,
  StressReservoir,
} from "@/lib/clinical-intelligence/types";
import { clamp01to100 } from "@/lib/clinical-intelligence/clamp";
import { isRecoveryStage } from "@/lib/clinical-intelligence/validation";

/** Legal recovery transitions (educational curriculum). */
const ALLOWED: Record<RecoveryStage, RecoveryStage[]> = {
  intake: ["early_alliance", "dropout_risk", "relapse_risk"],
  early_alliance: ["engaged_work", "dropout_risk", "intake", "plateau"],
  engaged_work: [
    "partial_response",
    "plateau",
    "relapse_risk",
    "dropout_risk",
    "recovery",
  ],
  partial_response: [
    "engaged_work",
    "recovery",
    "plateau",
    "relapse_risk",
    "dropout_risk",
  ],
  plateau: ["engaged_work", "relapse_risk", "dropout_risk", "partial_response"],
  relapse_risk: ["relapse", "engaged_work", "dropout_risk", "partial_response"],
  relapse: ["re_intake", "relapse_risk", "dropout_risk"],
  dropout_risk: ["dropped_out", "early_alliance", "engaged_work", "re_intake"],
  dropped_out: ["re_intake"],
  re_intake: ["early_alliance", "engaged_work", "dropout_risk"],
  recovery: ["maintenance", "relapse_risk", "plateau"],
  maintenance: ["recovery", "relapse_risk", "relapse"],
};

export function canTransitionRecovery(
  from: RecoveryStage,
  to: RecoveryStage,
): boolean {
  if (from === to) return true;
  return ALLOWED[from]?.includes(to) ?? false;
}

export function transitionRecovery(
  current: RecoveryStage,
  next: RecoveryStage,
): { ok: true; stage: RecoveryStage } | { ok: false; stage: RecoveryStage; reason: string } {
  if (!isRecoveryStage(next)) {
    return { ok: false, stage: current, reason: "invalid_stage" };
  }
  if (!canTransitionRecovery(current, next)) {
    return { ok: false, stage: current, reason: "illegal_transition" };
  }
  return { ok: true, stage: next };
}

/**
 * Horizon playbooks — expected stage by sessions_completed.
 * Deterministic curriculum guidance (not auto-cure of symptoms).
 */
export function expectedStageForHorizon(
  horizon: EvolutionHorizon,
  sessionsCompleted: number,
): RecoveryStage {
  if (horizon === "none" || horizon === 1) {
    return sessionsCompleted <= 0 ? "intake" : "early_alliance";
  }
  const n = sessionsCompleted;
  if (horizon === 5) {
    if (n <= 1) return "intake";
    if (n <= 3) return "early_alliance";
    return "engaged_work";
  }
  if (horizon === 10) {
    if (n <= 1) return "intake";
    if (n <= 3) return "early_alliance";
    if (n <= 7) return "engaged_work";
    if (n <= 9) return "partial_response";
    return "partial_response";
  }
  if (horizon === 25) {
    if (n <= 2) return "intake";
    if (n <= 6) return "early_alliance";
    if (n <= 14) return "engaged_work";
    if (n <= 20) return "partial_response";
    return "recovery";
  }
  if (horizon === 50) {
    if (n <= 3) return "intake";
    if (n <= 10) return "early_alliance";
    if (n <= 25) return "engaged_work";
    if (n <= 35) return "partial_response";
    if (n <= 45) return "recovery";
    return "maintenance";
  }
  // 100
  if (n <= 5) return "intake";
  if (n <= 15) return "early_alliance";
  if (n <= 40) return "engaged_work";
  if (n <= 60) return "partial_response";
  if (n <= 80) return "recovery";
  return "maintenance";
}

/**
 * Advance recovery toward horizon expectation without illegal jumps.
 */
export function advanceRecoveryTrajectory(
  trajectory: RecoveryTrajectory,
  opts?: {
    allianceTrust?: number;
    hostilityStreak?: boolean;
    dropoutSignal?: boolean;
  },
): RecoveryTrajectory {
  const sessions = trajectory.sessions_completed + 1;
  let target = expectedStageForHorizon(trajectory.horizon, sessions);

  if (opts?.dropoutSignal) {
    const drop = transitionRecovery(trajectory.stage, "dropout_risk");
    if (drop.ok) target = drop.stage;
  } else if (opts?.hostilityStreak) {
    const rel = transitionRecovery(trajectory.stage, "relapse_risk");
    if (rel.ok) target = rel.stage;
  } else if ((opts?.allianceTrust ?? 50) < 25) {
    const drop = transitionRecovery(trajectory.stage, "dropout_risk");
    if (drop.ok) target = drop.stage;
  }

  // Walk one legal step toward target if direct transition illegal
  let stage = trajectory.stage;
  if (stage !== target) {
    const direct = transitionRecovery(stage, target);
    if (direct.ok) {
      stage = direct.stage;
    } else {
      // Prefer engaged_work / early_alliance as stepping stones
      for (const step of ALLOWED[stage] ?? []) {
        if (step === target || canTransitionRecovery(step, target)) {
          stage = step;
          break;
        }
      }
    }
  }

  return {
    ...trajectory,
    sessions_completed: sessions,
    stage,
  };
}

export function computeRelapseRisk(input: {
  recovery: RecoveryTrajectory;
  chronicStress: number;
  allianceTrust: number;
  hope: number;
}): RelapseRisk {
  const triggers: string[] = [];
  let score = 20;
  if (input.recovery.stage === "relapse_risk" || input.recovery.stage === "relapse") {
    score += 40;
    triggers.push("recovery_stage");
  }
  if (input.chronicStress >= 70) {
    score += 20;
    triggers.push("chronic_stress");
  }
  if (input.allianceTrust < 35) {
    score += 15;
    triggers.push("low_alliance");
  }
  if (input.hope < 30) {
    score += 15;
    triggers.push("low_hope");
  }
  score = clamp01to100(score);
  const level = score >= 70 ? "high" : score >= 45 ? "elevated" : "none";
  return { level, score, triggers };
}

export function evolveStressReservoir(
  current: StressReservoir,
  acute: number,
  sessionDelta = 0,
): StressReservoir {
  const chronic = clamp01to100(
    current.chronic_load * 0.92 + acute * 0.08 + sessionDelta,
  );
  return {
    acute: clamp01to100(acute),
    chronic_load: chronic,
  };
}

/** Deterministic belief strength drift across sessions (never rewrites statements). */
export function evolveBeliefStrengths(
  strengths: Record<string, number>,
  sessionsCompleted: number,
  allianceTrust: number,
): Record<string, number> {
  const next: Record<string, number> = { ...strengths };
  // Soften ~1 point per session when alliance trust high (educational drift).
  const soften = allianceTrust >= 60 ? 1 : allianceTrust >= 40 ? 0.5 : 0;
  const harden = allianceTrust < 30 ? 0.5 : 0;
  const steps = Math.max(1, Math.min(sessionsCompleted, 3));
  for (const id of Object.keys(next)) {
    next[id] = clamp01to100(next[id]! - soften * steps + harden);
  }
  return next;
}

export function evolveInsightBand(
  current: InsightBand,
  mutable: boolean,
  sessionsCompleted: number,
  psychoeducationHits: number,
): InsightBand {
  if (!mutable) return current;
  // intellectual_only → partial after sustained work (alliance/curriculum).
  if (current === "intellectual_only" && sessionsCompleted >= 8) {
    return "partial";
  }
  if (sessionsCompleted < 3 || psychoeducationHits < 2) return current;
  const order: InsightBand[] = [
    "absent",
    "poor",
    "partial",
    "intellectual_only",
    "good",
  ];
  const idx = order.indexOf(current);
  if (idx < 0) return current;
  if (sessionsCompleted >= 10 && psychoeducationHits >= 5 && idx < order.length - 1) {
    const next = order[Math.min(idx + 1, order.length - 1)]!;
    return next === "intellectual_only" ? "good" : next;
  }
  return current;
}

export function defaultRecoveryTrajectory(
  horizon: EvolutionHorizon = 10,
): RecoveryTrajectory {
  return {
    stage: "intake",
    horizon,
    sessions_completed: 0,
    pin_disorder: true,
  };
}

/** Simulate N sessions of recovery/alliance-linked evolution (for tests). */
export function simulateLongitudinalArc(input: {
  sessions: number;
  horizon?: EvolutionHorizon;
  allianceTrustSeries?: number[];
  hopeSeries?: number[];
}): ClinicalIntelligenceMindState["recovery"] & {
  stages: RecoveryStage[];
  relapse: RelapseRisk[];
} {
  let recovery = defaultRecoveryTrajectory(input.horizon ?? 100);
  const stages: RecoveryStage[] = [recovery.stage];
  const relapse: RelapseRisk[] = [];
  let chronic = 40;
  for (let i = 0; i < input.sessions; i++) {
    const trust = input.allianceTrustSeries?.[i] ?? Math.min(85, 35 + i * 0.5);
    const hope = input.hopeSeries?.[i] ?? Math.min(80, 30 + i * 0.4);
    recovery = advanceRecoveryTrajectory(recovery, {
      allianceTrust: trust,
      dropoutSignal: trust < 20,
    });
    chronic = clamp01to100(chronic * 0.95 + (100 - hope) * 0.05);
    stages.push(recovery.stage);
    relapse.push(
      computeRelapseRisk({
        recovery,
        chronicStress: chronic,
        allianceTrust: trust,
        hope,
      }),
    );
  }
  return { ...recovery, stages, relapse };
}
