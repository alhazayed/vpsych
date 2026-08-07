/**
 * Presentation speech mapper — pace/energy for TTS timing only.
 *
 * Does NOT own cooperation, defenses, resistance, or therapist-move reactions
 * (those belong to Adaptation / Conversation Behaviour).
 */

import { speechBehaviorForDisorder } from "@/lib/case-engine/speech-behavior";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import type {
  BehaviorEngineOutput,
  EmotionEngineOutput,
} from "@/lib/humanization/types";
import type { ClinicalCore } from "@/lib/types";

export function behaviorTick(params: {
  snapshot: CaseInstanceSnapshot | null;
  clinicalCore?: ClinicalCore | null;
  /** @deprecated Ignored — Adaptation/CBE own therapist influence. */
  therapistMove?: string;
  emotion: EmotionEngineOutput;
  fatigue: number;
}): BehaviorEngineOutput {
  const core =
    params.clinicalCore ?? params.snapshot?.clinical_core ?? null;
  const slug =
    params.snapshot?.primary_diagnosis?.slug ??
    (core?.disorder ? String(core.disorder) : "generic");
  const speech = speechBehaviorForDisorder(slug, null);

  let speech_pace = speech.pace;
  let speech_energy = speech.energy;

  // Fatigue / high intensity only adjust delivery timing — not clinical stance.
  if (params.fatigue > 0.6 && speech_pace !== "pressured") {
    speech_pace = "slow";
    if (speech_energy === "high") speech_energy = "moderate";
    else if (speech_energy === "moderate") speech_energy = "low";
  }
  if (params.emotion.intensity >= 8 && speech_pace === "measured") {
    speech_pace = speech.category === "anxiety" ? "fast" : "variable";
  }

  return {
    // Neutral placeholders — not Adaptation state.
    cooperation: 50,
    resistance_mode: "presentation_only",
    speech_pace,
    speech_energy,
    defense_active: null,
    directives: [],
    category: speech.category,
  };
}
