import type { HumanPersonalityProfile } from "./types";

function scaleLabel(n: number): string {
  const labels = ["", "very low", "low", "moderate", "high", "very high"];
  return labels[n] ?? String(n);
}

/**
 * Format a human personality profile as structured prompt text.
 * Deterministic — no LLM involvement. Injected every turn via Module 2b.
 */
export function formatHumanPersonalityForPrompt(
  profile: HumanPersonalityProfile,
): string {
  const lines: string[] = [
    "HUMAN PERSONALITY PROFILE (authoritative — stay consistent every turn):",
    `- Temperament: ${profile.temperament}`,
    `- Attachment style: ${profile.attachment_style.replace(/_/g, " ")} — ${profile.attachment_notes}`,
    `- Intelligence: ${profile.intelligence.band.replace(/_/g, " ")} (${profile.intelligence.strengths.join("; ")}). Style: ${profile.intelligence.style}`,
    `- Education: ${profile.education}`,
    `- Occupation: ${profile.occupation}`,
    `- Culture: ${profile.culture}`,
    `- Religion / meaning: ${profile.religion}`,
    `- Resilience: ${profile.resilience}/5 (${scaleLabel(profile.resilience)})`,
    `- Openness: ${profile.openness}/5 · Agreeableness: ${profile.agreeableness}/5 · Conscientiousness: ${profile.conscientiousness}/5 · Neuroticism: ${profile.neuroticism}/5`,
    `- Coping style: ${profile.coping_style.replace(/_/g, " ")} — ${profile.coping_notes}`,
    `- Humor: ${profile.humor.replace(/_/g, " ")} — ${profile.humor_notes}`,
    `- Baseline trust of clinicians: ${profile.trust_level}/5 — ${profile.trust_notes}`,
    `- Emotional regulation: ${profile.emotional_regulation.replace(/_/g, " ")} — ${profile.emotional_regulation_notes}`,
    `- Speech style: ${profile.speech_style}`,
    `- Vocabulary: ${profile.vocabulary.register} — use: ${profile.vocabulary.markers.join(", ")}; avoid: ${profile.vocabulary.avoids.join(", ") || "none"}`,
    `- Preferred topics (volunteer more readily): ${profile.preferred_topics.join("; ")}`,
    `- Avoidant topics (deflect, minimise, or need earned trust): ${profile.avoidant_topics.join("; ")}`,
    `- Memory of therapist: remembers name=${profile.memory_of_therapist.remembers_name ? "yes" : "no"}; prior sessions=${profile.memory_of_therapist.remembers_prior_sessions ? "yes" : "no"}; alliance sensitivity ${profile.memory_of_therapist.alliance_sensitivity}/5. Rupture: ${profile.memory_of_therapist.rupture_style}. ${profile.memory_of_therapist.notes}`,
    `- Treatment expectations: ${profile.treatment_expectations}`,
    "",
    "Consistency rules:",
    "- You ARE this person. Traits do not drift mid-session.",
    "- Diagnosis (Module 1) shapes current symptoms; personality shapes who has them.",
    "- Never swap into another patient's temperament, humor, or speech pattern.",
    "- Prefer topics and avoidances above when choosing what to disclose.",
  ];
  return lines.join("\n");
}

/**
 * Compact one-line reminder for per-turn reinforcement.
 */
export function formatHumanPersonalityPerTurnCue(
  profile: HumanPersonalityProfile,
): string {
  const nameBits = [
    profile.attachment_style.replace(/_/g, "-"),
    profile.coping_style.replace(/_/g, "-"),
    `humor=${profile.humor.replace(/_/g, "-")}`,
    `trust=${profile.trust_level}/5`,
    `speech=${profile.speech_style.slice(0, 80)}`,
  ];
  return `Stay THIS personality: ${nameBits.join("; ")}.`;
}
