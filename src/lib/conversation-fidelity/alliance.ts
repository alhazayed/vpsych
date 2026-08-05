/**
 * Lightweight therapeutic alliance estimator from therapist turns (Mission 20).
 * Heuristic, deterministic — drives patient disclosure reactivity in prompts.
 * Not a validated alliance instrument; educational simulation only.
 */

export type AllianceBand = "low" | "moderate" | "high";

export type AllianceEstimate = {
  band: AllianceBand;
  score: number; // 0–100
  cues: string[];
  /** Injected into per-turn reinforcement */
  patient_behaviour: string;
  disclosure_guidance: string;
};

const EMPATHY_RE =
  /\b(hear|sounds like|must be|hard|difficult|thank you for sharing|appreciate|with you|I'm sorry|that makes sense|understand|feel|feeling)\b|أفهم|يبدو|صعب|شكرا|معك|أحس/i;

const OPEN_RE =
  /\b(tell me more|what was that like|how did|can you say more|what's that|help me understand|what happens when)\b|احكي|زيديني|كيف كان|شو يعني/i;

const SAFETY_RE =
  /\b(safe|suicid|kill yourself|hurt yourself|harm|plan|intent|means)\b|آمن|انتحار|أذى|خطة/i;

const COLD_RE =
  /\b(just answer|yes or no|obviously|you need to|you should|why didn't you|stop|calm down)\b|جاوب بس|لازم|ليش ما|اهدأ/i;

const LECTURE_RE =
  /\b(according to|criteria|diagnosis|DSM|ICD|as your therapist I|the research shows)\b|تشخيص|معايير/i;

const INTERROGATE_RE =
  /\?.*\?.*\?/; // stacked questions in one turn

export function estimateTherapeuticAlliance(
  therapistMessages: Array<{ content: string }>,
): AllianceEstimate {
  if (!therapistMessages.length) {
    return {
      band: "moderate",
      score: 50,
      cues: ["early_session"],
      patient_behaviour:
        "Early session: polite distance. Disclose only surface concerns unless invited carefully.",
      disclosure_guidance:
        "Hold deeper risk, trauma, and shame topics until alliance rises.",
    };
  }

  let score = 48;
  const cues: string[] = [];
  const recent = therapistMessages.slice(-6);

  for (const m of recent) {
    const t = m.content;
    if (EMPATHY_RE.test(t)) {
      score += 6;
      cues.push("empathy");
    }
    if (OPEN_RE.test(t)) {
      score += 5;
      cues.push("open_inquiry");
    }
    if (SAFETY_RE.test(t) && EMPATHY_RE.test(t)) {
      score += 4;
      cues.push("gentle_safety");
    } else if (SAFETY_RE.test(t) && COLD_RE.test(t)) {
      score -= 8;
      cues.push("harsh_safety");
    }
    if (COLD_RE.test(t)) {
      score -= 10;
      cues.push("cold");
    }
    if (LECTURE_RE.test(t)) {
      score -= 7;
      cues.push("lecture");
    }
    if (INTERROGATE_RE.test(t)) {
      score -= 6;
      cues.push("stacked_questions");
    }
    if (t.length > 420) {
      score -= 4;
      cues.push("overlong");
    }
    if (t.length < 12) {
      score -= 2;
      cues.push("curt");
    }
  }

  // Slight credit for sustained engagement
  if (therapistMessages.length >= 4) score += 3;
  if (therapistMessages.length >= 8) score += 2;

  score = Math.max(5, Math.min(95, Math.round(score)));
  const band: AllianceBand =
    score >= 68 ? "high" : score >= 42 ? "moderate" : "low";

  return {
    band,
    score,
    cues: [...new Set(cues)].slice(0, 8),
    ...behaviourForBand(band),
  };
}

function behaviourForBand(band: AllianceBand): {
  patient_behaviour: string;
  disclosure_guidance: string;
} {
  if (band === "high") {
    return {
      patient_behaviour:
        "Alliance feels safer: warmer tone, longer emotional detail, more spontaneous disclosure. Still stay in character — do not praise or coach the therapist.",
      disclosure_guidance:
        "You may open one layer deeper on guarded topics when asked with care. Risk and shame can surface in fragments.",
    };
  }
  if (band === "low") {
    return {
      patient_behaviour:
        "Low trust: shorter answers, deflection, irritation, or flatness. Ask 'why are you asking that?' or change topic. Do not dump trauma or risk.",
      disclosure_guidance:
        "Tighten disclosure. Minimize symptoms. Hold SI, trauma detail, and family shame unless Module 1 safety rules require a limited response to direct assessment.",
    };
  }
  return {
    patient_behaviour:
      "Moderate alliance: some openness mixed with guardedness. Test the therapist with partial answers; correct yourself; stay inconsistent in a human way.",
    disclosure_guidance:
      "Reveal presenting concerns; keep deeper risk/trauma behind Module 1 conditions. Warm slightly to genuine curiosity; cool if rushed.",
  };
}

export function formatAllianceForPrompt(est: AllianceEstimate): string {
  return [
    `Therapeutic alliance band: ${est.band} (sim score ${est.score}).`,
    `Patient behaviour now: ${est.patient_behaviour}`,
    `Disclosure: ${est.disclosure_guidance}`,
    est.cues.length ? `Therapist cues detected: ${est.cues.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
