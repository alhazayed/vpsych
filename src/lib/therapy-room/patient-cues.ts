import type { PatientBehaviorState } from "./types";

/**
 * Nonverbal cues a trainee would notice and could act on, in the order they
 * are read out. Blinks, breathing and passing glances are left out: they
 * carry no clinical meaning and would only add noise for screen readers.
 */
export const DESCRIBED_PATIENT_CUES = [
  "tears",
  "lookAway",
  "headDown",
  "crossArms",
  "agitated",
  "fidget",
  "slow",
  "handTremor",
  "sigh",
  "laughter",
  "smile",
  "eyeContact",
] as const;

export type DescribedPatientCue = (typeof DESCRIBED_PATIENT_CUES)[number];

/**
 * The cues the patient is visibly showing right now, using the same signals
 * PatientPresence turns into animation classes, so the text alternative and
 * the picture never disagree (WCAG 1.1.1).
 */
export function describedPatientCues(
  behavior: Pick<PatientBehaviorState, "activeCues" | "animationClasses">,
): DescribedPatientCue[] {
  const cues = new Set(behavior.activeCues);
  const anim = new Set(behavior.animationClasses ?? []);
  const showing: Record<DescribedPatientCue, boolean> = {
    tears: cues.has("tears") || anim.has("trm-patient--tears"),
    lookAway: cues.has("look_away") || anim.has("trm-patient--look-away"),
    headDown: cues.has("head_down") || anim.has("trm-patient--head-down"),
    crossArms: cues.has("cross_arms"),
    agitated: cues.has("psychomotor_agitation"),
    fidget:
      cues.has("fidget") ||
      cues.has("restlessness") ||
      anim.has("trm-patient--fidget"),
    slow:
      cues.has("psychomotor_retardation") ||
      cues.has("slow_movements") ||
      anim.has("trm-patient--slow"),
    handTremor: cues.has("hand_tremor") || anim.has("trm-patient--hand-tremor"),
    sigh: cues.has("sigh") || anim.has("trm-patient--sigh"),
    laughter: cues.has("laughter"),
    smile:
      cues.has("smile") ||
      [...anim].some((c) => c.startsWith("trm-patient--smile-")),
    eyeContact: cues.has("eye_contact") || anim.has("trm-patient--eye-contact"),
  };
  // Looking away and holding eye contact can't both be true for a listener.
  if (showing.lookAway) showing.eyeContact = false;
  return DESCRIBED_PATIENT_CUES.filter((cue) => showing[cue]);
}
