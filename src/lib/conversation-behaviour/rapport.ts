/**
 * Rapport estimator — 0–100, derived from history + difficulty (no persistence).
 */

import type { DifficultyModifiers } from "@/lib/case-engine/types";
import type { SessionMessage } from "@/lib/types";
import {
  classifySensitiveTopic,
  classifyTherapistMove,
} from "./therapist-move";

function allianceBaseline(
  alliance?: string | null,
): number {
  const a = (alliance ?? "neutral").toLowerCase().replace(/\s+/g, "_");
  if (a === "warm") return 55;
  if (a === "fragile" || a === "testing") return 28;
  return 38;
}

function resistanceDrag(resistance?: string | null): number {
  const r = (resistance ?? "moderate").toLowerCase().replace(/\s+/g, "_");
  if (r === "very_high") return -18;
  if (r === "high") return -10;
  if (r === "low") return 4;
  return 0;
}

function disclosureBaseline(disclosure?: string | null): number {
  const d = (disclosure ?? "mixed").toLowerCase().replace(/\s+/g, "_");
  if (d === "high") return 8;
  if (d === "guarded") return -8;
  if (d === "minimal") return -14;
  return 0;
}

/**
 * Estimate current rapport from difficulty priors + therapist skill signals
 * in prior user turns. Deterministic; never random.
 */
export function estimateRapport(params: {
  history: Pick<SessionMessage, "role" | "content">[];
  turnIndex: number;
  difficulty?: Pick<
    DifficultyModifiers,
    "alliance" | "resistance" | "disclosure"
  > | null;
}): number {
  let score =
    allianceBaseline(params.difficulty?.alliance) +
    resistanceDrag(params.difficulty?.resistance) +
    disclosureBaseline(params.difficulty?.disclosure);

  // Slow natural warming with turns (caps early oversharing).
  score += Math.min(18, params.turnIndex * 2);

  const userTurns = params.history.filter((m) => m.role === "user");
  for (const turn of userTurns.slice(-12)) {
    const move = classifyTherapistMove(turn.content);
    switch (move) {
      case "reflection":
        score += 4;
        break;
      case "validation":
        score += 5;
        break;
      case "rapport":
        score += 2;
        break;
      case "safety_check":
        // Careful safety can build trust; clumsy checklist tone is still ok-ish.
        score += 2;
        break;
      case "advice":
        score -= 5;
        break;
      case "confrontation":
        score -= 8;
        break;
      case "sensitive_probe":
        // Early probing without alliance hurts; later is milder (handled by turnIndex).
        score -= params.turnIndex < 3 ? 4 : 1;
        break;
      case "interruption":
        score -= 6;
        break;
      default:
        break;
    }
    if (classifySensitiveTopic(turn.content) === "risk" && params.turnIndex < 2) {
      score -= 3;
    }
  }

  return clamp(Math.round(score), 5, 95);
}

/**
 * Map rapport + difficulty disclosure into a turn disclosure gate.
 * Patients should not immediately answer everything.
 */
export function disclosureGateFromRapport(params: {
  rapport: number;
  sensitiveTopic: ReturnType<typeof classifySensitiveTopic>;
  therapistMove: ReturnType<typeof classifyTherapistMove>;
  difficulty?: Pick<DifficultyModifiers, "disclosure" | "resistance"> | null;
}): import("./types").DisclosureGate {
  const disclosure = (params.difficulty?.disclosure ?? "mixed")
    .toLowerCase()
    .replace(/\s+/g, "_");
  const resistance = (params.difficulty?.resistance ?? "moderate")
    .toLowerCase()
    .replace(/\s+/g, "_");

  let gate: import("./types").DisclosureGate =
    params.rapport >= 70
      ? "open"
      : params.rapport >= 50
        ? "partial"
        : params.rapport >= 30
          ? "deflect"
          : "withhold";

  if (params.sensitiveTopic !== "none") {
    if (gate === "open") gate = "partial";
    else if (gate === "partial") gate = "deflect";
    else gate = "withhold";
  }

  if (params.therapistMove === "safety_check" && params.rapport >= 35) {
    // Safety may open a crack even when otherwise deflecting — still not a dump.
    if (gate === "withhold") gate = "deflect";
    else if (gate === "deflect") gate = "partial";
  }

  if (params.therapistMove === "confrontation" || params.therapistMove === "advice") {
    if (gate === "open") gate = "partial";
    else if (gate === "partial") gate = "deflect";
  }

  if (disclosure === "minimal" || resistance === "very_high") {
    if (gate === "open") gate = "partial";
    else if (gate === "partial") gate = "deflect";
  }
  if (disclosure === "guarded" && gate === "open") gate = "partial";

  return gate;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
