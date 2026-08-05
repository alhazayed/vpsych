/**
 * Module 5 — Session arc engine (phase progression).
 */

import type { RelationshipMemory, SessionPhase, TherapyProgress } from "@/lib/pme/types";
import type { TherapistTurnSignals } from "@/lib/pme/relationship";

const ORDER: SessionPhase[] = [
  "opening",
  "rapport",
  "exploration",
  "resistance",
  "disclosure",
  "reflection",
  "closure",
  "carry_over",
];

export function advanceSessionPhase(
  therapy: TherapyProgress,
  opts: {
    turnIndex: number;
    relationship: RelationshipMemory;
    signals: TherapistTurnSignals;
    anyPartialDisclosure: boolean;
  },
): TherapyProgress {
  let phase = therapy.phase;
  let turns = therapy.turns_in_phase + 1;

  const advance = (next: SessionPhase) => {
    phase = next;
    turns = 0;
  };

  // Natural phase movement — not instant affect flips
  if (phase === "opening" && (opts.turnIndex >= 2 || opts.signals.warmth + opts.signals.empathy >= 10)) {
    advance("rapport");
  } else if (phase === "rapport" && turns >= 2 && opts.relationship.alliance >= 48) {
    advance("exploration");
  } else if (phase === "exploration") {
    if (opts.signals.confrontation >= 10 || opts.relationship.alliance < 40) {
      advance("resistance");
    } else if (turns >= 3) {
      advance(opts.relationship.alliance >= 55 ? "disclosure" : "resistance");
    }
  } else if (phase === "resistance") {
    if (opts.signals.repair || opts.signals.empathy >= 10) {
      advance("exploration");
    } else if (turns >= 3 && opts.relationship.alliance >= 50) {
      advance("disclosure");
    }
  } else if (phase === "disclosure") {
    if (opts.anyPartialDisclosure && turns >= 2) advance("reflection");
    else if (turns >= 4) advance("reflection");
  } else if (phase === "reflection" && turns >= 2) {
    advance("closure");
  } else if (phase === "closure" && turns >= 2) {
    advance("carry_over");
  }

  // Late session nudge toward closure
  if (opts.turnIndex >= 18 && ORDER.indexOf(phase) < ORDER.indexOf("closure")) {
    advance("closure");
  }

  return {
    ...therapy,
    phase,
    turns_in_phase: turns,
  };
}

export function phaseGuidance(phase: SessionPhase): string {
  switch (phase) {
    case "opening":
      return "Session opening: polite distance, brief answers, size up the therapist.";
    case "rapport":
      return "Rapport: slight warming if earned; still guarded on deep topics.";
    case "exploration":
      return "Exploration: share day-to-day detail; test whether they can handle emotion.";
    case "resistance":
      return "Resistance phase: shorten answers, deflect, use defenses; do not punish — protect.";
    case "disclosure":
      return "Disclosure window: if readiness allows, offer fragments — not a dump.";
    case "reflection":
      return "Reflection: quieter; may correct earlier statements; tolerate silence.";
    case "closure":
      return "Closure: wind down; maybe ask what happens next; residual emotion remains.";
    case "carry_over":
      return "Carry-over: something unfinished may linger for next session.";
  }
}
