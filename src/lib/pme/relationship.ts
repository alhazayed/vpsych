/**
 * Module 1 — Relationship memory. Trust evolves gradually; never hard-resets.
 */

import type { RelationshipMemory } from "@/lib/pme/types";
import { clamp01to100 } from "@/lib/pme/emotion";

export function createRelationshipMemory(
  therapistId: string | null,
): RelationshipMemory {
  return {
    therapist_id: therapistId,
    warmth_cumulative: 0,
    empathy_cumulative: 0,
    confrontation_count: 0,
    rupture_count: 0,
    repair_count: 0,
    broken_promises: [],
    therapist_style_notes: [],
    sessions_together: 1,
    last_session_summary: null,
    trust: 42,
    alliance: 45,
  };
}

export type TherapistTurnSignals = {
  warmth: number;
  empathy: number;
  confrontation: number;
  validation: number;
  poor_empathy: number;
  cbt_skill: number;
  mi_skill: number;
  rupture: boolean;
  repair: boolean;
  cues: string[];
};

const WARMTH_RE =
  /\b(thank you|appreciate|glad you're here|with you|safe here)\b|شكرا|معك|بأمان/i;
const EMPATHY_RE =
  /\b(sounds|hear|hard|difficult|that makes sense|must feel|understand)\b|يفهم|صعب|يبدو|أحس/i;
const CONFRONT_RE =
  /\b(you need to|you should|why didn't|obviously|just admit|stop)\b|لازم|ليش ما|اهدأ/i;
const VALIDATE_RE =
  /\b(makes sense|understandable|anyone would|reasonable|valid)\b|مفهوم|طبيبرعي|محق/i;
const REPAIR_RE =
  /\b(sorry if|I may have|let me try again|did I misunderstand|appreciate you correcting)\b|آسف|خليني أرجع/i;
const CBT_RE =
  /\b(thought|evidence|behaviour|activity|homework|between now and)\b|فكرة|دليل|نشاط|واجب/i;
const MI_RE =
  /\b(on a scale|how ready|what would|pros and cons|your reasons)\b|جاهز|ليش بدك|أسبابك/i;

export function signalTherapistTurn(content: string): TherapistTurnSignals {
  const cues: string[] = [];
  let warmth = 0;
  let empathy = 0;
  let confrontation = 0;
  let validation = 0;
  let poor_empathy = 0;
  let cbt_skill = 0;
  let mi_skill = 0;

  if (WARMTH_RE.test(content)) {
    warmth += 8;
    cues.push("warmth");
  }
  if (EMPATHY_RE.test(content)) {
    empathy += 10;
    cues.push("empathy");
  }
  if (VALIDATE_RE.test(content)) {
    validation += 8;
    cues.push("validation");
  }
  if (CONFRONT_RE.test(content)) {
    confrontation += 12;
    poor_empathy += 8;
    cues.push("confrontation");
  }
  if (content.split("?").length > 3) {
    confrontation += 6;
    poor_empathy += 4;
    cues.push("stacked_questions");
  }
  if (REPAIR_RE.test(content)) {
    cues.push("repair");
  }
  if (CBT_RE.test(content) && EMPATHY_RE.test(content)) {
    cbt_skill += 6;
    cues.push("cbt_skill");
  }
  if (MI_RE.test(content)) {
    mi_skill += 8;
    cues.push("mi_skill");
  }
  if (content.length < 10) {
    poor_empathy += 4;
    cues.push("curt");
  }

  const rupture = confrontation >= 12 && empathy < 5;
  const repair = REPAIR_RE.test(content);

  return {
    warmth,
    empathy,
    confrontation,
    validation,
    poor_empathy,
    cbt_skill,
    mi_skill,
    rupture,
    repair,
    cues,
  };
}

export function updateRelationship(
  rel: RelationshipMemory,
  signals: TherapistTurnSignals,
): RelationshipMemory {
  const next = { ...rel };
  next.warmth_cumulative += signals.warmth;
  next.empathy_cumulative += signals.empathy;
  if (signals.confrontation >= 8) next.confrontation_count += 1;
  if (signals.rupture) next.rupture_count += 1;
  if (signals.repair) next.repair_count += 1;

  // Gradual trust — never jumps more than ~6 points per turn
  let trustDelta =
    signals.warmth * 0.25 +
    signals.empathy * 0.35 +
    signals.validation * 0.3 +
    (signals.repair ? 4 : 0) -
    signals.confrontation * 0.45 -
    signals.poor_empathy * 0.4;
  trustDelta = Math.max(-6, Math.min(6, trustDelta));
  next.trust = clamp01to100(next.trust + trustDelta);

  let allianceDelta =
    signals.empathy * 0.3 +
    signals.validation * 0.25 +
    signals.mi_skill * 0.2 +
    signals.cbt_skill * 0.15 -
    signals.confrontation * 0.35;
  allianceDelta = Math.max(-7, Math.min(7, allianceDelta));
  next.alliance = clamp01to100(next.alliance + allianceDelta);

  if (signals.cues.includes("confrontation") && next.therapist_style_notes.length < 12) {
    next.therapist_style_notes = [
      ...next.therapist_style_notes.slice(-11),
      "confrontational moments remembered",
    ];
  }
  if (signals.empathy >= 8 && next.therapist_style_notes.length < 12) {
    next.therapist_style_notes = [
      ...next.therapist_style_notes.slice(-11),
      "empathic moments remembered",
    ];
  }

  return next;
}
