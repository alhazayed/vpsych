/**
 * Clinical gates — keep humanization behaviours phenotype-accurate.
 * Suppresses humour/laughter during active risk, etc.
 */

import { speechBehaviorForDisorder } from "@/lib/case-engine/speech-behavior";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import { HUMANIZATION_CATALOG } from "@/lib/humanization/catalog";
import type {
  AffectPrimary,
  ClinicalGateResult,
  HumanizationBehaviorId,
  TherapistMove,
} from "@/lib/humanization/types";
import type { ClinicalCore } from "@/lib/types";

function riskIsActive(
  core: ClinicalCore | null | undefined,
): boolean {
  const si = core?.risk_profile?.suicidal_ideation;
  return Boolean(
    si === "passive" ||
      si === "active_no_plan" ||
      si === "active_with_plan" ||
      core?.risk_profile?.self_harm ||
      core?.risk_profile?.harm_to_others,
  );
}

function therapistIsSafety(move: TherapistMove): boolean {
  return move === "safety_check";
}

/**
 * Filter the full catalog to behaviours that remain clinically appropriate
 * for this turn's diagnosis, affect, risk, and therapist move.
 */
export function applyClinicalGates(params: {
  snapshot: CaseInstanceSnapshot | null;
  clinicalCore?: ClinicalCore | null;
  therapistMove: TherapistMove;
  affect: AffectPrimary;
  intensity: number;
  sessionPhase: "opening" | "middle" | "closing" | "overtime";
  hasPriorSessionMemory: boolean;
  turnIndex: number;
}): ClinicalGateResult {
  const core =
    params.clinicalCore ?? params.snapshot?.clinical_core ?? null;
  const slug =
    params.snapshot?.primary_diagnosis?.slug ??
    (core?.disorder ? String(core.disorder) : "generic");
  const speech = speechBehaviorForDisorder(slug, null);
  const category = speech.category;
  const activeRisk = riskIsActive(core);
  const safetyTurn = therapistIsSafety(params.therapistMove);

  const blocked: ClinicalGateResult["blocked"] = [];
  const allowed: HumanizationBehaviorId[] = [];

  for (const def of Object.values(HUMANIZATION_CATALOG)) {
    const id = def.id;
    let reason: string | null = null;

    // Risk / safety: never joke or laugh during active risk or safety probes.
    if (
      (activeRisk || safetyTurn) &&
      (id === "humor" || id === "laughter" || id === "small_talk")
    ) {
      reason = "blocked during active risk or safety assessment";
    }

    // Crying only when affect supports it and intensity is high enough.
    if (
      id === "crying" &&
      !(
        (params.affect === "sad" ||
          params.affect === "tearful" ||
          params.affect === "ashamed") &&
        params.intensity >= 6
      )
    ) {
      reason = "crying requires sad/tearful/ashamed affect at intensity ≥6";
    }

    // Prior-session memory only when memory engine has cues.
    if (id === "remembering_previous_sessions" && !params.hasPriorSessionMemory) {
      reason = "no prior-session memory available";
    }

    // Small talk mostly opening/closing.
    if (
      id === "small_talk" &&
      params.sessionPhase !== "opening" &&
      params.sessionPhase !== "closing"
    ) {
      reason = "small talk reserved for opening/closing";
    }

    // Silence early can feel broken; allow after rapport turns.
    if (id === "silence" && params.turnIndex < 2) {
      reason = "silence deferred until after early rapport turns";
    }

    // Psychosis: avoid polished humor; allow uncertainty/forget/look_away.
    if (category === "psychosis" && (id === "humor" || id === "small_talk")) {
      reason = "humour/small-talk suppressed for psychosis phenotype";
    }

    // Mania/pressured: suppress fatigue/silence; prefer interruptions/false_start.
    const manic =
      speech.pace === "pressured" ||
      slug.includes("mania") ||
      slug.includes("bipolar");
    if (
      manic &&
      (id === "fatigue" || id === "silence" || id === "thinking_pause")
    ) {
      reason = "low-energy behaviours suppressed for pressured/manic pace";
    }

    // MDD/low energy: suppress interruptions and bright humor.
    if (
      speech.energy === "low" &&
      (id === "interruptions" || id === "humor")
    ) {
      reason = "high-activation behaviours suppressed for low-energy phenotype";
    }

    // Trauma: laughter only as nervous; humor rare — gate humor harder.
    if (category === "trauma" && id === "humor" && params.intensity >= 5) {
      reason = "humour blocked when trauma affect is elevated";
    }

    // Invalidation → prefer silence/look_away/withdraw, not small talk.
    if (
      params.therapistMove === "invalidation" &&
      (id === "small_talk" || id === "humor" || id === "laughter")
    ) {
      reason = "affiliative behaviours blocked after invalidation";
    }

    if (reason) {
      blocked.push({ id, reason });
    } else {
      allowed.push(id);
    }
  }

  return { allowed, blocked };
}
