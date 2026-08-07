/**
 * Emotion → expression layer (Mission 2).
 *
 * Maps continuous variables + mode onto:
 *   voice · facial animation · word choice · hesitation · body language
 *
 * Deterministic — no RNG. Therapy-room / TTS / prompt consumers read this.
 */

import type {
  EmotionExpression,
  EmotionMode,
  EmotionState,
  EmotionalVariables,
} from "@/lib/emotion/types";

function facialAffect(
  vars: EmotionalVariables,
  mode: EmotionMode,
): EmotionExpression["facial_affect"] {
  if (mode === "withdrawn") return "guarded";
  if (mode === "collapsed") return "flat";
  if (mode === "warming" && vars.hope >= 50) return "hopeful";
  if (vars.anger >= 60) return "irritable";
  if (vars.fear >= 65 || vars.stress >= 70) return "anxious";
  if (vars.current_mood <= 30 && vars.hope <= 35) return "depressed";
  if (vars.current_mood <= 35 && vars.fatigue >= 60) return "tearful";
  if (mode === "activated") return "agitated";
  if (vars.rapport >= 60 && vars.trust >= 55) return "warm";
  return "neutral";
}

function voiceFromState(
  vars: EmotionalVariables,
  mode: EmotionMode,
): EmotionExpression["voice"] {
  // Rate: low mood / fatigue slow; fear / anger / activation speed up
  let rate = 1;
  rate -= (100 - vars.current_mood) * 0.002;
  rate -= vars.fatigue * 0.0015;
  rate += vars.fear * 0.001;
  rate += vars.anger * 0.0012;
  if (mode === "withdrawn") rate *= 0.92;
  if (mode === "activated") rate *= 1.08;
  rate = Math.max(0.75, Math.min(1.3, Math.round(rate * 100) / 100));

  let volume = 1 - vars.fatigue * 0.003 - (100 - vars.current_mood) * 0.002;
  if (vars.anger >= 60) volume += 0.08;
  if (mode === "withdrawn") volume *= 0.85;
  volume = Math.max(0.55, Math.min(1.2, Math.round(volume * 100) / 100));

  let pitch = 1 + (vars.fear - 50) * 0.0015 - (vars.current_mood - 50) * 0.0008;
  pitch = Math.max(0.85, Math.min(1.15, Math.round(pitch * 100) / 100));

  // Hesitation / pause: low trust and high fear stretch pauses
  let pause_scale =
    1 +
    (100 - vars.trust) * 0.006 +
    vars.fear * 0.004 +
    vars.fatigue * 0.003;
  if (mode === "withdrawn") pause_scale += 0.35;
  if (mode === "warming") pause_scale *= 0.9;
  pause_scale = Math.max(0.6, Math.min(2.2, Math.round(pause_scale * 100) / 100));

  // ElevenLabs-style: lower stability = more expressive
  let stability = 0.45;
  if (vars.current_mood <= 35) stability = 0.62;
  if (mode === "activated") stability = 0.3;
  if (vars.anger >= 60) stability = 0.32;
  if (mode === "withdrawn") stability = 0.7;

  const style =
    mode === "activated"
      ? 0.4
      : mode === "warming"
        ? 0.3
        : mode === "withdrawn"
          ? 0.1
          : 0.22;

  return {
    rate,
    volume,
    pitch,
    pause_scale,
    stability: Math.round(stability * 100) / 100,
    similarity_boost: 0.74,
    style,
  };
}

function hesitationMs(vars: EmotionalVariables, mode: EmotionMode): number {
  let ms =
    600 +
    (100 - vars.trust) * 12 +
    vars.fear * 8 +
    vars.fatigue * 6 +
    (100 - vars.motivation) * 4;
  if (mode === "withdrawn") ms += 900;
  if (mode === "collapsed") ms += 1200;
  if (mode === "warming") ms *= 0.75;
  if (mode === "activated") ms *= 0.55;
  return Math.round(Math.max(250, Math.min(4500, ms)));
}

function wordChoice(
  vars: EmotionalVariables,
  mode: EmotionMode,
): string[] {
  const dirs: string[] = [];
  if (mode === "withdrawn") {
    dirs.push("short answers; minimal elaboration");
    dirs.push("polite distance; do not volunteer new material");
    dirs.push("prefer concrete logistics over feeling words");
  } else if (mode === "collapsed") {
    dirs.push("sparse vocabulary; long pauses implied");
    dirs.push("low energy verbs; avoid bright affect words");
  } else if (mode === "guarded") {
    dirs.push("hedge and minimize; answer sideways");
    dirs.push("test the therapist before deeper disclosure");
  } else if (mode === "warming") {
    dirs.push("slightly more feeling words allowed");
    dirs.push("may risk a brief authentic disclosure");
  } else if (mode === "activated") {
    dirs.push("faster, fragmented clauses when anxious or angry");
    dirs.push("may interrupt self; pressured or sharp tone");
  } else {
    dirs.push("measured conversational naturalness");
  }

  if (vars.hope <= 30) dirs.push("avoid optimistic phrasing; hope is low");
  if (vars.hope >= 60) dirs.push("allow cautious hopeful phrasing");
  if (vars.anger >= 55) dirs.push("edge of irritability in wording");
  if (vars.fear >= 60) dirs.push("safety-checking asides; uncertain tone");
  if (vars.trust >= 60) dirs.push("trust permits slightly longer turns");
  if (vars.trust <= 30) dirs.push("distrust colours answers; do not warm abruptly");
  if (vars.fatigue >= 65) dirs.push("tired diction; trail off");

  return dirs;
}

function bodyLanguage(
  vars: EmotionalVariables,
  mode: EmotionMode,
): string[] {
  const cues: string[] = ["idle_breathing", "blink"];
  if (mode === "withdrawn" || vars.trust <= 30) {
    cues.push("look_away", "cross_arms", "posture_shift");
  }
  if (vars.fear >= 55 || vars.stress >= 60) {
    cues.push("fidget", "hand_tremor", "restlessness");
  }
  if (vars.current_mood <= 35) {
    cues.push("head_down", "slow_movements", "sigh");
  }
  if (vars.fatigue >= 65) {
    cues.push("psychomotor_retardation", "sigh");
  }
  if (vars.anger >= 60) {
    cues.push("psychomotor_agitation", "restlessness");
  }
  if (mode === "warming" && vars.rapport >= 50) {
    cues.push("eye_contact");
  }
  if (mode === "collapsed") {
    cues.push("silence", "head_down", "slow_movements");
  }
  if (vars.current_mood <= 30 && vars.hope <= 35) {
    cues.push("tears");
  }
  return [...new Set(cues)];
}

function animationHooks(
  vars: EmotionalVariables,
  mode: EmotionMode,
  facial: EmotionExpression["facial_affect"],
): string[] {
  const hooks = [`affect.${facial}`, `mode.${mode}`];
  if (vars.trust <= 30) hooks.push("gaze.averted", "posture.closed");
  if (vars.trust >= 60) hooks.push("gaze.soft", "posture.open");
  if (vars.fatigue >= 65) hooks.push("motion.retarded", "breath.shallow");
  if (vars.anger >= 60) hooks.push("motion.agitated");
  if (mode === "warming") hooks.push("alliance.warming");
  if (mode === "withdrawn") hooks.push("alliance.ruptured");
  return hooks;
}

/** Trust + rapport + low fear → disclosure openness (0–100). */
export function computeOpenness(vars: EmotionalVariables, mode: EmotionMode): number {
  let open =
    vars.trust * 0.45 +
    vars.rapport * 0.3 +
    vars.hope * 0.1 +
    (100 - vars.fear) * 0.1 +
    vars.motivation * 0.05;
  if (mode === "withdrawn") open *= 0.45;
  if (mode === "collapsed") open *= 0.55;
  if (mode === "guarded") open *= 0.75;
  if (mode === "warming") open *= 1.1;
  return Math.max(0, Math.min(100, Math.round(open * 10) / 10));
}

export function emotionSummary(vars: EmotionalVariables, mode: EmotionMode): string {
  const parts: string[] = [`mode=${mode}`];
  if (vars.current_mood <= 35) parts.push("low mood");
  if (vars.stress >= 60) parts.push("stressed");
  if (vars.fear >= 55) parts.push("fearful");
  if (vars.anger >= 55) parts.push("angry");
  if (vars.hope <= 35) parts.push("low hope");
  if (vars.hope >= 60) parts.push("hopeful");
  if (vars.trust <= 35) parts.push("low trust");
  if (vars.trust >= 60) parts.push("trusting");
  if (vars.rapport >= 55) parts.push("rapport building");
  if (vars.fatigue >= 60) parts.push("fatigued");
  if (vars.motivation <= 35) parts.push("low motivation");
  return parts.join(", ");
}

export function deriveExpression(state: EmotionState): EmotionExpression {
  const { variables: vars, mode } = state;
  const facial_affect = facialAffect(vars, mode);
  return {
    mode,
    facial_affect,
    voice: voiceFromState(vars, mode),
    hesitation_ms: hesitationMs(vars, mode),
    word_choice: wordChoice(vars, mode),
    body_language: bodyLanguage(vars, mode),
    animation_hooks: animationHooks(vars, mode, facial_affect),
    openness: computeOpenness(vars, mode),
    summary: emotionSummary(vars, mode),
  };
}

/** Prompt block injected into patient agent — expression only. */
export function expressionPromptBlock(expression: EmotionExpression): string {
  return [
    "[Emotion Engine — express this state; do not invent different affect]",
    `Mode: ${expression.mode}`,
    `Affect: ${expression.facial_affect}`,
    `Openness (0–100): ${expression.openness}`,
    `Hesitation hint: ~${expression.hesitation_ms}ms before speaking`,
    `Word choice: ${expression.word_choice.join("; ")}`,
    `Body language: ${expression.body_language.join(", ")}`,
    `Summary: ${expression.summary}`,
  ].join("\n");
}
