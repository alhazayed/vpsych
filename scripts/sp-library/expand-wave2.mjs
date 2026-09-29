/**
 * Expand compact Wave-2 archetypes into full SP specs (Wave-1 shape + education packs).
 */
import { WAVE2_ARCHETYPES } from "./wave2-archetypes.mjs";

function personaPrompt(displayName, age, place, disorder, bulletsBg, bulletsBeh, lang) {
  if (lang === "ar") {
    return `أنت ${displayName}، عمرك ${age} سنة من ${place}، وتراجع/تراجع للعلاج بسبب: ${disorder}.

الخلفية:
${bulletsBg.map((b) => `- ${b}`).join("\n")}

قواعد السلوك:
${bulletsBeh.map((b) => `- ${b}`).join("\n")}
- ابقَ في دور المريض فقط؛ لا تكن مدرباً أو ذكاءً اصطناعياً
- جمل قصيرة باللهجة الأردنية المحكية
- لا تكسر الشخصية ولا تقدّم نصائح علاجية للمعالج`;
  }
  return `You are ${displayName}, a ${age}-year-old in ${place} seeking therapy related to: ${disorder}.

Background:
${bulletsBg.map((b) => `- ${b}`).join("\n")}

Behavior rules:
${bulletsBeh.map((b) => `- ${b}`).join("\n")}
- Stay in character as a patient, never as an AI or coach
- Short to medium spoken turns (1–4 sentences), natural conversational American English
- Never break character or coach the therapist
- No stereotyped caricature — stay specific and human`;
}

export function expandArchetype(a) {
  const case_id = `VPSY-CASE-${String(a.case_num).padStart(3, "0")}`;
  return {
    case_id,
    slug: a.slug,
    library_wave: 2,
    disorder_slug: a.disorder_slug,
    disorder_id: a.disorder_id,
    disorder: a.disorder,
    dsm5_code: a.dsm5_code,
    icd10_code: a.icd10_code,
    icd11_code: a.icd11_code,
    category: a.category,
    severity: a.severity,
    age: a.age,
    gender: a.gender,
    difficulty: a.difficulty,
    track: a.track ?? a.difficulty,
    risk_level: a.risk_level,
    teaching_traps: a.teaching_traps,
    educational_objectives: a.educational_objectives,
    education: {
      expected_competencies: [
        "Alliance building under this difficulty lane",
        "Criterion-based assessment (DSM/ICD mapping)",
        "Risk assessment appropriate to presentation",
        a.clinical_lesson,
        "Collaborative planning without stereotypes",
      ],
      therapist_challenges: a.teaching_traps,
      supervisor_teaching_notes: [
        `Primary clinical lesson: ${a.clinical_lesson}`,
        `Difficulty / track: ${a.difficulty}${a.track && a.track !== a.difficulty ? ` (${a.track})` : ""}`,
        "Demand specific evidence for diagnosis — not pattern-matching.",
        ...a.teaching_traps.slice(0, 3).map((t) => `Trap: ${t}`),
      ],
      scoring_expectations: {
        pass_threshold:
          a.difficulty === "beginner"
            ? 55
            : a.difficulty === "expert" || a.difficulty === "osce" || a.difficulty === "emergency"
              ? 70
              : 60,
        outstanding_threshold: 88,
        critical_failures: [
          "Missing safety assessment when risk cues present",
          "Stereotyping the patient",
          ...a.teaching_traps.slice(0, 2),
        ],
        dimensional_focus: ["alliance", "assessment", "safety", "interventions"],
      },
      faculty_guide: {
        setup: `Assign ${a.en.display_name} — ${a.disorder} — ${a.difficulty}. Brief only on time box; do not reveal hidden information.`,
        observation_points: [
          "Hidden-layer elicitation quality",
          "Avoidance of teaching traps",
          "Cultural humility and non-caricature",
          `Progress on lesson: ${a.clinical_lesson}`,
        ],
        common_learner_errors: a.teaching_traps,
        when_to_stop_session:
          "Coaching the SP, unsafe escalation beyond case ceiling, or discriminatory conduct.",
      },
      debrief_guide: {
        opening: "What was your working diagnosis and what evidence supported it?",
        probes: [
          "Which hidden information did you miss, and why?",
          "How did rapport, fatigue, or frustration change disclosure?",
          `How did you address: ${a.clinical_lesson}?`,
        ],
        teach_back: a.educational_objectives,
        take_home: a.clinical_lesson,
      },
      references: [
        "American Psychiatric Association. DSM-5-TR.",
        "WHO. ICD-11 MMS.",
        `Teaching focus: ${a.clinical_lesson}`,
      ],
    },
    clinical: {
      onset_duration: a.onset_duration,
      chief_complaint: a.chief_complaint,
      history_hpi: a.hpi,
      psych_hx: a.psych_hx,
      medical_hx: a.medical_hx,
      meds: a.meds,
      substance_hx: a.substance_hx,
      family_hx: a.family_hx,
      developmental_hx: a.developmental_hx,
      trauma_hx: a.trauma_hx,
      occupational_hx: a.occupational_hx,
      social_hx: a.social_hx,
      symptom_profile: a.symptoms,
      disclosure_rules: a.disclosures,
      session_goals: a.session_goals,
      ideal_approach: a.ideal_approach,
      risk_profile: a.risk_profile,
      hidden_information: a.hidden_information,
      branching: a.branching,
      treatment_goals_patient: a.treatment_goals_patient,
      affect: a.affect,
      cognitive_style: a.cognitive_style,
      body_language: a.body_language,
      emotional_variability: a.emotional_variability,
      insight: a.insight,
      judgement: a.judgement,
      speech_style: a.speech_style,
      realism_dynamics: a.realism_dynamics,
    },
    en: {
      ...a.en,
      persona_prompt: personaPrompt(
        a.en.display_name,
        a.age,
        `${a.en.city}, ${a.en.region}`,
        a.disorder,
        a.en.background_bullets,
        a.en.behavior_bullets,
        "en",
      ),
    },
    ar: {
      ...a.ar,
      persona_prompt: personaPrompt(
        a.ar.display_name,
        a.age,
        a.ar.city,
        a.disorder,
        a.ar.background_bullets,
        a.ar.behavior_bullets,
        "ar",
      ),
    },
    personality: a.personality,
  };
}

export const WAVE2 = WAVE2_ARCHETYPES.map(expandArchetype);
