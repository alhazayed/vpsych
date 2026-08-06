/**
 * Deterministic nonverbal / process behaviour for the consultation room.
 *
 * Derived from disorder speech profiles + therapy-process difficulty mods +
 * clinical risk — never random. Ready for facial/body animation adapters.
 */

import { speechBehaviorForDisorder } from "@/lib/case-engine/speech-behavior";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import type { PatientNonverbalProfile } from "./types";

function defenceForCategory(category: string): string[] {
  switch (category) {
    case "mood":
      return ["minimisation", "isolation of affect", "intellectualisation"];
    case "anxiety":
      return ["reassurance seeking", "catastrophising", "avoidance"];
    case "psychosis":
      return ["guardedness", "concrete thinking", "projection"];
    case "trauma":
      return ["avoidance", "dissociation", "numbing"];
    case "personality":
      return ["splitting", "projective identification", "idealisation/devaluation"];
    case "substance":
      return ["denial", "bargaining", "rationalisation"];
    case "neurodevelopmental":
      return ["humour deflection", "topic jumping", "externalisation"];
    case "medical":
      return ["fluctuating attention", "misidentification"];
    default:
      return ["minimisation", "topic shift"];
  }
}

export function resolvePatientNonverbal(
  snapshot: CaseInstanceSnapshot | null | undefined,
  disorderSlugFallback?: string | null,
): PatientNonverbalProfile {
  const slug =
    snapshot?.primary_diagnosis?.slug ?? disorderSlugFallback ?? "generic";
  const speech = speechBehaviorForDisorder(
    slug,
    snapshot?.clinical_core ? undefined : null,
  );
  const mods = snapshot?.difficulty_modifiers;
  const risk = snapshot?.clinical_core?.risk_profile;
  const alliance = mods?.alliance ?? "gradual";
  const disclosure = mods?.disclosure ?? "mixed";
  const resistance = mods?.resistance ?? "moderate";

  const posture =
    speech.energy === "low"
      ? "Shoulders forward, gaze often down; sits still for long stretches."
      : speech.energy === "high" || speech.pace === "pressured"
        ? "Perched forward on the chair; restless lean; hard to settle."
        : speech.energy === "labile"
          ? "Posture shifts with affect — open then suddenly guarded."
          : "Upright but reserved; occasional shift when topics warm.";

  const eyeContact =
    speech.category === "psychosis"
      ? "Fleeting or oddly fixed; breaks contact when meaning feels unsafe."
      : speech.category === "trauma"
        ? "Scans the room; brief contact then looks away when approached."
        : speech.energy === "low"
          ? "Downcast; brief glances when naming feeling accurately."
          : "Intermittent contact; holds longer when alliance feels earned.";

  const movement =
    speech.pace === "pressured" || speech.pace === "fast"
      ? "Frequent small movements; interrupts own stillness."
      : speech.energy === "low"
        ? "Sparse movement; delayed start after being asked to sit."
        : "Natural micro-adjustments; freezes briefly on hard questions.";

  const fidgeting =
    speech.category === "anxiety" || speech.category === "neurodevelopmental"
      ? "Hands busy — ring, sleeve, notebook edge — especially during silence."
      : speech.category === "substance"
        ? "Restless legs; jaw set when use is near the surface."
        : resistance === "high" || resistance === "very_high"
          ? "Controlled stillness that reads as distance, not calm."
          : "Occasional hand-to-face; otherwise composed.";

  const breathing =
    risk?.suicidal_ideation && risk.suicidal_ideation !== "none"
      ? "Shallow when risk topics open; longer exhales after being heard."
      : speech.category === "anxiety"
        ? "Upper-chest breathing; audible catch before panic content."
        : speech.energy === "low"
          ? "Slow, low-amplitude breathing; sighs before effortful answers."
          : "Even breathing with brief holds when thinking.";

  const emotionalRegulation =
    speech.energy === "labile"
      ? "Affect swings within the hour; recovery is incomplete but real."
      : speech.energy === "low"
        ? "Constricted range; softens rather than brightens on positives."
        : speech.category === "trauma"
          ? "Numb or irritable under pressure; tears optional, not required."
          : "Regulates by pacing disclosure; one good reflection does not cure.";

  const allianceDevelopment =
    alliance === "fragile" || alliance === "testing"
      ? "Alliance fragile — warmth without accuracy cools disclosure."
      : alliance === "warm"
        ? "Warms when met with curiosity; still tests premature advice."
        : "Builds gradually; accurate feeling reflection before second facts.";

  const disclosureTiming =
    disclosure === "minimal" || disclosure === "guarded"
      ? "Surface first; mid-layer rare; deep material late or withheld."
      : disclosure === "high"
        ? "Surface and some mid-layer with ordinary empathy; core still gated."
        : "Layered: logistics freely; feeling on direct ask; risk on careful enquiry.";

  const cssModifiers = {
    scale: speech.energy === "low" ? 0.98 : speech.pace === "pressured" ? 1.02 : 1,
    brightness:
      speech.energy === "low" ? 0.92 : speech.energy === "high" ? 1.05 : 1,
    saturate:
      speech.category === "mood" && speech.energy === "low" ? 0.85 : 1,
    translateY: speech.energy === "low" ? 4 : 0,
    swayMs:
      speech.pace === "pressured" || speech.pace === "fast" ? 3200 : 5200,
    breatheMs:
      speech.category === "anxiety" ? 2800 : speech.energy === "low" ? 5200 : 4000,
  };

  return {
    disorderSlug: slug,
    posture,
    eyeContact,
    speechTempo: `${speech.pace} / ${speech.energy}`,
    movement,
    fidgeting,
    breathing,
    emotionalRegulation,
    defenceMechanisms: defenceForCategory(speech.category),
    allianceDevelopment,
    disclosureTiming,
    cssModifiers,
  };
}
