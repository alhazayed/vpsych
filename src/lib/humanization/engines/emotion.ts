/**
 * Presentation affect mapper — maps Mission 2 Emotion Engine output (when
 * provided) into gating labels for micro-behaviour selection.
 *
 * Does NOT invent clinical affect, mutate emotional state, or own interventions.
 */

import { speechBehaviorForDisorder } from "@/lib/case-engine/speech-behavior";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import type {
  AffectPrimary,
  EmotionEngineOutput,
} from "@/lib/humanization/types";
import type { ClinicalCore } from "@/lib/types";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** Optional Mission 2 packet used for presentation gating only. */
export type ExternalEmotionPresentation = {
  mode?: string | null;
  facial_affect?: string | null;
  openness?: number | null;
  hesitation_ms?: number | null;
  variables?: {
    current_mood?: number;
    trust?: number;
    anger?: number;
    hope?: number;
    fatigue?: number;
    fear?: number;
  } | null;
};

function phenotypeFallback(
  slug: string,
  category: string,
): { primary: AffectPrimary; intensity: number } {
  const s = slug.toLowerCase();
  if (s.includes("mania") || s.includes("bipolar")) {
    return { primary: "irritable", intensity: 5 };
  }
  if (category === "mood" || s.includes("mdd") || s.includes("depress")) {
    return { primary: "sad", intensity: 4 };
  }
  if (category === "anxiety" || s.includes("gad") || s.includes("panic")) {
    return { primary: "anxious", intensity: 5 };
  }
  if (category === "trauma" || s.includes("ptsd")) {
    return { primary: "numb", intensity: 4 };
  }
  if (category === "psychosis") {
    return { primary: "numb", intensity: 3 };
  }
  if (category === "personality") {
    return { primary: "ashamed", intensity: 4 };
  }
  return { primary: "neutral", intensity: 3 };
}

function mapFacialToAffect(facial: string | null | undefined): AffectPrimary | null {
  if (!facial) return null;
  const f = facial.toLowerCase();
  if (f.includes("tear") || f.includes("cry")) return "tearful";
  if (f.includes("sad") || f.includes("down")) return "sad";
  if (f.includes("anx") || f.includes("fear") || f.includes("worr")) return "anxious";
  if (f.includes("anger") || f.includes("irrit")) return "irritable";
  if (f.includes("shame") || f.includes("guilt")) return "ashamed";
  if (f.includes("flat") || f.includes("numb") || f.includes("blunt")) return "numb";
  if (f.includes("hope") || f.includes("warm") || f.includes("soft")) return "hopeful";
  if (f.includes("reliev")) return "relieved";
  if (f.includes("fatig") || f.includes("tired")) return "fatigued";
  return null;
}

function mapModeToAffect(mode: string | null | undefined): AffectPrimary | null {
  if (!mode) return null;
  switch (mode) {
    case "withdrawn":
    case "collapsed":
      return "numb";
    case "activated":
      return "irritable";
    case "warming":
      return "hopeful";
    case "guarded":
      return "ashamed";
    case "engaged":
      return "neutral";
    default:
      return null;
  }
}

/**
 * Presentation-only affect tick.
 * Prefer Mission 2 expression/state when provided; otherwise phenotype fallback
 * for clinical gating only (never writes emotional state).
 */
export function emotionTick(params: {
  snapshot: CaseInstanceSnapshot | null;
  clinicalCore?: ClinicalCore | null;
  /** @deprecated Ignored — Emotion Engine owns interventions. */
  therapistMove?: string;
  /** @deprecated Ignored — must not invent affect from free text. */
  userMessage?: string;
  fatigue?: number;
  external?: ExternalEmotionPresentation | null;
}): EmotionEngineOutput {
  const core =
    params.clinicalCore ?? params.snapshot?.clinical_core ?? null;
  const slug =
    params.snapshot?.primary_diagnosis?.slug ??
    (core?.disorder ? String(core.disorder) : "generic");
  const speech = speechBehaviorForDisorder(slug, null);
  const fallback = phenotypeFallback(slug, speech.category);

  const external = params.external ?? null;
  let primary =
    mapFacialToAffect(external?.facial_affect) ??
    mapModeToAffect(external?.mode) ??
    fallback.primary;

  let intensity = fallback.intensity;
  if (external?.variables) {
    const v = external.variables;
    const arousal =
      ((v.anger ?? 40) + (v.fear ?? 40) + (100 - (v.current_mood ?? 50))) / 30;
    intensity = clamp(Math.round(arousal), 1, 10);
  } else if (typeof external?.openness === "number") {
    intensity = clamp(Math.round((100 - external.openness) / 12) + 3, 1, 10);
  }

  if ((params.fatigue ?? 0) > 0.7 && primary === "neutral") {
    primary = "fatigued";
  }

  let congruence: EmotionEngineOutput["congruence"] = "congruent";
  if (external?.mode === "guarded" || external?.mode === "withdrawn") {
    congruence = "guarded";
  }
  const masking = params.snapshot?.difficulty_modifiers?.masking;
  if (masking === "high" || masking === "very_high") {
    congruence = "guarded";
    intensity = Math.min(intensity, 6);
  }

  return {
    primary,
    intensity,
    congruence,
    // Presentation layer does not emit clinical emotion directives.
    directives: [],
    triggers_fired: [],
  };
}
