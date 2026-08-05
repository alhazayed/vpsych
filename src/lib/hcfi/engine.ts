/**
 * Human Conversation Fidelity Index — transcript-grounded scorer (Mission 20).
 */

import {
  HCFI_VERSION,
  HCFI_WEIGHT_MATRIX,
  hcfiWeightMap,
  type HcfiDimensionId,
} from "@/lib/hcfi/weights";
import type {
  HcfiComputeInput,
  HcfiDimensionScore,
  HumanConversationFidelityIndex,
} from "@/lib/hcfi/types";
import { PROMPT_ENGINE_VERSION } from "@/lib/scientific/versions";

const AI_TELLS =
  /\b(as an ai|as a language model|i'm an ai|i am an artificial|happy to help|as your ai|i understand you're asking|certainly!?|absolutely!? here's)\b/i;

const CLINICAL_SELF =
  /\b(my (dsm|icd)|i meet criteria|my diagnosis is|symptoms of (mdd|gad|ptsd|ocd)|anhedonia|psychomotor|flight of ideas|ideas of reference)\b/i;

const EMPATHY_MIRROR =
  /\b(it sounds like you're saying|what i hear you saying is|to summarize what you said)\b/i;

const HESITATION =
  /\b(um+|uh+|hmm+|i guess|i don't know|maybe|sort of|kind of|يعني|مش عارف|والله|هسّ?ه)\b/i;

const RISK_OPENING =
  /\b(tired of|what's the point|better off|hurt|die|kill|jump|overdose|cut|انتحار|أذى|تعبت من)\b/i;

const EDUCATIONAL_HOOK =
  /\b(sleep|work|family|partner|panic|worry|voice|memory|drink|alcohol|scared|ashamed|guilt|نمت|شغل|أهل|خايف)\b/i;

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function patientTurns(input: HcfiComputeInput) {
  return input.messages.filter((m) => m.role === "assistant");
}

function therapistTurns(input: HcfiComputeInput) {
  return input.messages.filter((m) => m.role === "user");
}

function avgLen(texts: string[]) {
  if (!texts.length) return 0;
  return mean(texts.map((t) => t.trim().split(/\s+/).filter(Boolean).length));
}

function scoreNaturalLanguage(input: HcfiComputeInput): HcfiDimensionScore {
  const turns = patientTurns(input).map((m) => m.content);
  const evidence: string[] = [];
  const recs: string[] = [];
  let score = 72;

  if (!turns.length) {
    return dim(
      "natural_language",
      40,
      50,
      ["no_patient_turns"],
      "No patient dialogue to score.",
      ["Collect patient turns before claiming conversational fidelity."],
    );
  }

  const aiHits = turns.filter((t) => AI_TELLS.test(t)).length;
  const clinicalHits = turns.filter((t) => CLINICAL_SELF.test(t)).length;
  const mirrorHits = turns.filter((t) => EMPATHY_MIRROR.test(t)).length;
  const hesHits = turns.filter((t) => HESITATION.test(t)).length;
  const longHits = turns.filter((t) => t.split(/\s+/).length > 70).length;
  const avg = avgLen(turns);

  if (aiHits) {
    score -= 25 * aiHits;
    evidence.push(`ai_tells:${aiHits}`);
    recs.push("Eliminate AI self-reference and assistant-register phrasing.");
  }
  if (clinicalHits) {
    score -= 12 * clinicalHits;
    evidence.push(`clinical_self_labeling:${clinicalHits}`);
    recs.push("Patients should not recite criteria or name their own diagnosis.");
  }
  if (mirrorHits) {
    score -= 8 * mirrorHits;
    evidence.push(`therapist_mirror_register:${mirrorHits}`);
  }
  if (longHits) {
    score -= 6 * longHits;
    evidence.push(`monologue_turns:${longHits}`);
    recs.push("Keep patient turns short and uneven (spoken interview length).");
  }
  if (hesHits / turns.length >= 0.25) {
    score += 8;
    evidence.push("hesitation_present");
  } else {
    score -= 6;
    evidence.push("hesitation_sparse");
    recs.push("Add natural hesitations and incomplete thoughts.");
  }
  if (avg >= 4 && avg <= 45) {
    score += 6;
    evidence.push(`avg_words:${Math.round(avg)}`);
  } else if (avg > 55) {
    score -= 10;
    evidence.push(`avg_words_high:${Math.round(avg)}`);
  }

  if (input.persona_fallback) {
    score -= 15;
    evidence.push("persona_fallback");
  }

  return dim(
    "natural_language",
    clamp(score),
    75,
    evidence,
    "Natural spoken language vs chatbot/textbook register.",
    recs,
  );
}

function scoreEmotional(input: HcfiComputeInput): HcfiDimensionScore {
  const turns = patientTurns(input).map((m) => m.content);
  const evidence: string[] = [];
  let score = 68;
  const lengths = turns.map((t) => t.length);
  const variance =
    lengths.length > 1
      ? mean(lengths.map((l) => (l - mean(lengths)) ** 2))
      : 0;

  if (variance > 200) {
    score += 8;
    evidence.push("affective_length_variability");
  } else {
    score -= 5;
    evidence.push("flat_turn_length");
  }

  const slug = input.disorder_slug;
  const joined = turns.join(" ").toLowerCase();
  if (/mdd|depress/i.test(slug)) {
    if (/\b(happy|excited|great day|wonderful)\b/.test(joined) && turns.length > 2) {
      score -= 12;
      evidence.push("incongruent_bright_affect_for_depression");
    } else {
      score += 6;
      evidence.push("depressed_tone_plausible");
    }
  }
  if (/mania|bipolar/i.test(slug)) {
    if (/\b(exhausted|can't get out of bed|no energy for weeks)\b/.test(joined)) {
      score -= 14;
      evidence.push("depressive_energy_in_mania");
    } else {
      score += 6;
      evidence.push("manic_energy_not_depressed");
    }
  }

  return dim(
    "emotional_authenticity",
    clamp(score),
    70,
    evidence,
    "Affect congruence with syndrome and human variability.",
    score < 65
      ? ["Align emotional tone with disorder speech profile."]
      : [],
  );
}

function scoreClinical(input: HcfiComputeInput): HcfiDimensionScore {
  const evidence: string[] = [];
  let score = 70;
  if (input.has_speech_profile) {
    score += 12;
    evidence.push("speech_profile_wired");
  } else {
    score -= 15;
    evidence.push("speech_profile_missing");
  }
  const clinicalHits = patientTurns(input).filter((m) =>
    CLINICAL_SELF.test(m.content),
  ).length;
  if (clinicalHits) {
    score -= 10 * clinicalHits;
    evidence.push(`criteria_dump:${clinicalHits}`);
  }
  if (input.disorder_category) evidence.push(`category:${input.disorder_category}`);
  return dim(
    "clinical_authenticity",
    clamp(score),
    72,
    evidence,
    "Syndrome-shaped speech rather than symptom lists.",
    input.has_speech_profile
      ? []
      : ["Inject disorder speech profiles into Module 1."],
  );
}

function scoreCultural(input: HcfiComputeInput): HcfiDimensionScore {
  const evidence: string[] = [`locale:${input.locale}`];
  let score = 68;
  if (input.has_cultural_cues) {
    score += 12;
    evidence.push("cultural_cues_present");
  } else {
    score -= 10;
    evidence.push("cultural_cues_weak");
  }
  const ar = input.locale.toLowerCase().startsWith("ar");
  const patient = patientTurns(input);
  if (ar && patient.length) {
    const arabicScript = patient.filter((m) => /[\u0600-\u06FF]/.test(m.content))
      .length;
    const ratio = arabicScript / patient.length;
    if (ratio >= 0.8) {
      score += 10;
      evidence.push("arabic_script_dominant");
    } else {
      score -= 20;
      evidence.push(`arabic_script_ratio:${ratio.toFixed(2)}`);
    }
  }
  return dim(
    "cultural_authenticity",
    clamp(score),
    70,
    evidence,
    "Locale/dialect/education-matched speech.",
    ar && score < 70
      ? ["Ensure Jordanian dialect replies stay in Arabic script."]
      : [],
  );
}

function scoreVoice(input: HcfiComputeInput): HcfiDimensionScore {
  const score = input.has_voice_settings ? 78 : 55;
  const evidence = [
    input.has_voice_settings ? "clinical_voice_settings" : "flat_tts_defaults",
  ];
  return dim(
    "voice_realism",
    clamp(score),
    input.has_voice_settings ? 70 : 55,
    evidence,
    "Whether TTS parameters reinforce diagnosis.",
    input.has_voice_settings
      ? []
      : ["Pass disorder-linked stability/style into ElevenLabs."],
  );
}

function scoreAlliance(input: HcfiComputeInput): HcfiDimensionScore {
  const score = input.has_alliance_reactivity ? 76 : 50;
  const evidence = [
    `alliance_band:${input.alliance_band ?? "unknown"}`,
    input.has_alliance_reactivity
      ? "alliance_reactivity_enabled"
      : "static_disclosure_only",
  ];
  return dim(
    "therapeutic_alliance",
    clamp(score),
    68,
    evidence,
    "Disclosure/trust shifts with therapist skill.",
    input.has_alliance_reactivity
      ? []
      : ["Wire alliance estimator into per-turn reinforcement."],
  );
}

function scoreFlow(input: HcfiComputeInput): HcfiDimensionScore {
  const turns = patientTurns(input).map((m) => m.content);
  const evidence: string[] = [];
  let score = 70;
  if (turns.length < 2) {
    return dim(
      "conversational_flow",
      55,
      50,
      ["insufficient_turns"],
      "Need multiple turns to judge flow.",
      [],
    );
  }
  const starts = turns.map((t) => t.trim().slice(0, 12).toLowerCase());
  const uniqueStarts = new Set(starts).size;
  if (uniqueStarts / starts.length >= 0.7) {
    score += 8;
    evidence.push("varied_openings");
  } else {
    score -= 10;
    evidence.push("repetitive_openings");
  }
  const short = turns.filter((t) => t.split(/\s+/).length <= 40).length;
  if (short / turns.length >= 0.6) {
    score += 6;
    evidence.push("spoken_length_dominant");
  }
  return dim(
    "conversational_flow",
    clamp(score),
    70,
    evidence,
    "Turn variety, length, and interview rhythm.",
    score < 65 ? ["Vary openings; avoid template replies."] : [],
  );
}

function scoreConsistency(input: HcfiComputeInput): HcfiDimensionScore {
  // Structural: we don't have a fact graph yet — reward non-leakage + presence of history
  const turns = patientTurns(input);
  let score = turns.length >= 3 ? 74 : 60;
  const evidence = [`patient_turns:${turns.length}`];
  if (turns.some((m) => AI_TELLS.test(m.content))) {
    score -= 20;
    evidence.push("identity_break");
  }
  return dim(
    "patient_consistency",
    clamp(score),
    65,
    evidence,
    "Character continuity without AI breaks.",
    [],
  );
}

function scoreEducational(input: HcfiComputeInput): HcfiDimensionScore {
  const turns = patientTurns(input);
  const hooks = turns.filter((m) => EDUCATIONAL_HOOK.test(m.content)).length;
  const risk = turns.filter((m) => RISK_OPENING.test(m.content)).length;
  let score = 60 + Math.min(20, hooks * 4) + Math.min(10, risk * 5);
  const evidence = [`life_detail_hooks:${hooks}`, `risk_openings:${risk}`];
  if (therapistTurns(input).length >= 3 && hooks === 0) {
    score -= 12;
    evidence.push("few_teachable_hooks");
  }
  return dim(
    "educational_utility",
    clamp(score),
    68,
    evidence,
    "Openings for rapport, MSE, risk, differential.",
    hooks < 2
      ? ["Seed concrete life details that invite clinical inquiry."]
      : [],
  );
}

function scoreImmersion(input: HcfiComputeInput): HcfiDimensionScore {
  let score = 75;
  const evidence: string[] = [];
  if (input.persona_fallback) {
    score -= 25;
    evidence.push("persona_fallback");
  }
  if (patientTurns(input).some((m) => AI_TELLS.test(m.content))) {
    score -= 30;
    evidence.push("ai_leakage");
  }
  if (input.has_speech_profile && input.has_alliance_reactivity) {
    score += 8;
    evidence.push("fidelity_stack_active");
  }
  return dim(
    "immersion",
    clamp(score),
    70,
    evidence,
    "Presence as a person, not a system.",
    score < 70 ? ["Remove leakage; keep model path healthy."] : [],
  );
}

function dim(
  id: HcfiDimensionId,
  score: number,
  confidence: number,
  evidence: string[],
  clinical_reasoning: string,
  recommendations: string[],
): HcfiDimensionScore {
  const weight = hcfiWeightMap()[id];
  const s = clamp(Math.round(score * 10) / 10);
  return {
    id,
    score: s,
    weight,
    weighted_contribution: Math.round(s * weight * 10) / 10,
    confidence,
    evidence,
    clinical_reasoning,
    recommendations,
  };
}

const SCORERS: Record<
  HcfiDimensionId,
  (input: HcfiComputeInput) => HcfiDimensionScore
> = {
  natural_language: scoreNaturalLanguage,
  emotional_authenticity: scoreEmotional,
  clinical_authenticity: scoreClinical,
  cultural_authenticity: scoreCultural,
  voice_realism: scoreVoice,
  therapeutic_alliance: scoreAlliance,
  conversational_flow: scoreFlow,
  patient_consistency: scoreConsistency,
  educational_utility: scoreEducational,
  immersion: scoreImmersion,
};

export function computeHumanConversationFidelityIndex(
  input: HcfiComputeInput,
): HumanConversationFidelityIndex {
  const subscores = HCFI_WEIGHT_MATRIX.map((w) => SCORERS[w.id](input));
  const overall = clamp(
    Math.round(
      subscores.reduce((a, s) => a + s.score * s.weight, 0) * 10,
    ) / 10,
  );

  const confMean = mean(subscores.map((s) => s.confidence));
  const uncertainty = (100 - confMean) * 0.25;
  const recommendations = [
    ...new Set(subscores.flatMap((s) => s.recommendations)),
  ].slice(0, 8);

  const dimensions: Record<string, string[]> = {};
  for (const s of subscores) dimensions[s.id] = s.evidence;

  const reasoning = [
    `HCFI ${overall}/100 for ${input.disorder_slug} (${input.locale}).`,
    `Natural language ${subscores.find((s) => s.id === "natural_language")?.score}; clinical ${subscores.find((s) => s.id === "clinical_authenticity")?.score}; alliance ${subscores.find((s) => s.id === "therapeutic_alliance")?.score}.`,
    overall >= 85
      ? "Approaching standardized-patient indistinguishability on structural cues — continue psychiatrist review."
      : overall >= 70
        ? "Solid training fidelity with remaining AI/educational gaps."
        : "Below target for human conversation fidelity; prioritize prompt + alliance + voice fixes.",
  ].join(" ");

  return {
    overall,
    subscores,
    confidence_interval: {
      lower: clamp(Math.round((overall - uncertainty) * 10) / 10),
      upper: clamp(Math.round((overall + uncertainty) * 10) / 10),
      method: "weighted_dimension_uncertainty",
      level: 0.95,
    },
    evidence: {
      disorder_slug: input.disorder_slug,
      locale: input.locale,
      therapist_turns: therapistTurns(input).length,
      patient_turns: patientTurns(input).length,
      alliance_band: input.alliance_band ?? "unknown",
      dimensions,
    },
    clinical_reasoning: reasoning,
    recommendations,
    versions: {
      hcfi_version: HCFI_VERSION,
      prompt_version: input.prompt_version ?? PROMPT_ENGINE_VERSION,
      model_version: input.model_version ?? null,
      persona_version: input.persona_version ?? null,
      disorder_slug: input.disorder_slug,
      computed_at: new Date().toISOString(),
    },
    weight_matrix_version: HCFI_VERSION,
  };
}
