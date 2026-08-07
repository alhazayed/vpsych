/**
 * Therapist evaluation — score Stage 9 skills from transcript + assessment + education.
 * Every score cites observable evidence. Never invents diagnoses.
 */

import type { LearnerCompetency } from "@/lib/ace/types";
import type { ScoreEntry } from "@/lib/types";
import {
  THERAPIST_SKILL_DEFINITIONS,
  emptyEvidence,
  levelFromScore,
  skillDefinitionById,
} from "@/lib/supervisor/competency-engine";
import type {
  EvidenceCitation,
  TherapistSkillId,
  TherapistSkillScore,
} from "@/lib/supervisor/types";
import type { InterviewProcessSignals } from "@/lib/education/types";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function rubricScore(
  items: ScoreEntry[],
  ids: string[],
): { score: number | null; feedback: string | null } {
  const matched = items.filter((i) =>
    ids.some((id) => i.id.toLowerCase().includes(id) || id.includes(i.id.toLowerCase())),
  );
  if (matched.length === 0) return { score: null, feedback: null };
  const avg =
    matched.reduce((a, i) => a + (i.score / Math.max(1, i.max)) * 100, 0) /
    matched.length;
  return {
    score: clamp(avg),
    feedback: matched.map((m) => m.feedback).filter(Boolean).join("; ") || null,
  };
}

function aceScore(
  competencies: LearnerCompetency[] | undefined,
  ids: string[],
): number | null {
  if (!competencies?.length) return null;
  const matched = competencies.filter((c) => ids.includes(c.competency_id));
  if (!matched.length) return null;
  return clamp(
    matched.reduce((a, c) => a + c.score, 0) / matched.length,
  );
}

function citeTurn(
  messages: Array<{ role: string; content: string }>,
  predicate: (lower: string) => boolean,
  skill: TherapistSkillId,
): EvidenceCitation | null {
  const therapist = messages.filter((m) => m.role === "user");
  for (let i = 0; i < therapist.length; i++) {
    const t = therapist[i]!;
    if (predicate(t.content.toLowerCase())) {
      return {
        source: "transcript",
        excerpt: t.content.slice(0, 180),
        skill,
        message_index: i,
      };
    }
  }
  return null;
}

function blend(
  parts: Array<{ score: number | null; weight: number }>,
  fallback: number,
): number {
  let num = 0;
  let den = 0;
  for (const p of parts) {
    if (p.score == null) continue;
    num += p.score * p.weight;
    den += p.weight;
  }
  if (den === 0) return clamp(fallback);
  return clamp(num / den);
}

export function evaluateTherapistSkills(input: {
  messages: Array<{ role: string; content: string }>;
  items: ScoreEntry[];
  overall: number;
  process?: InterviewProcessSignals | null;
  aceCompetencies?: LearnerCompetency[];
}): TherapistSkillScore[] {
  const process = input.process;
  const therapistTurns = input.messages.filter((m) => m.role === "user").length || 1;

  const processScore = (count: number, target: number): number =>
    clamp((count / Math.max(1, target)) * 100);

  const builders: Record<
    TherapistSkillId,
    () => { score: number; evidence: EvidenceCitation[]; notes: string[] }
  > = {
    rapport: () => {
      const r = rubricScore(input.items, ["alliance", "empathy"]);
      const ace = aceScore(input.aceCompetencies, ["therapeutic_alliance"]);
      const ev: EvidenceCitation[] = [];
      const cite = citeTurn(
        input.messages,
        (l) => /\b(glad you're here|thanks for (coming|sharing)|we can (work|look))\b/.test(l),
        "rapport",
      );
      if (cite) ev.push(cite);
      if (r.feedback) ev.push(emptyEvidence(r.feedback, "assessment", "rapport"));
      return {
        score: blend(
          [
            { score: r.score, weight: 2 },
            { score: ace, weight: 2 },
            { score: input.overall, weight: 1 },
          ],
          50,
        ),
        evidence: ev.length
          ? ev
          : [emptyEvidence("No explicit rapport markers; inferred from overall alliance proxies.", "assessment", "rapport")],
        notes: cite ? ["Warm collaborative language observed."] : ["Build explicit collaborative framing early."],
      };
    },
    alliance: () => {
      const r = rubricScore(input.items, ["alliance"]);
      const ace = aceScore(input.aceCompetencies, ["therapeutic_alliance"]);
      const ev: EvidenceCitation[] = [];
      const cite = citeTurn(
        input.messages,
        (l) => /\b(what (matters|feels most important)|goals? for (today|our)|together)\b/.test(l),
        "alliance",
      );
      if (cite) ev.push(cite);
      if (r.feedback) ev.push(emptyEvidence(r.feedback, "assessment", "alliance"));
      return {
        score: blend([{ score: r.score, weight: 3 }, { score: ace, weight: 2 }], input.overall),
        evidence: ev.length ? ev : [emptyEvidence("Alliance inferred from assessment alliance item.", "assessment", "alliance")],
        notes: [],
      };
    },
    empathy: () => {
      const r = rubricScore(input.items, ["alliance", "empathy"]);
      const ace = aceScore(input.aceCompetencies, ["empathy"]);
      const reflections = process?.reflection_count ?? 0;
      const cite = citeTurn(
        input.messages,
        (l) => /\b(it sounds like|what i hear|you're saying|that must (be|feel))\b/.test(l),
        "empathy",
      );
      return {
        score: blend(
          [
            { score: r.score, weight: 2 },
            { score: ace, weight: 2 },
            { score: processScore(reflections, 2), weight: 2 },
          ],
          45,
        ),
        evidence: cite
          ? [cite]
          : [emptyEvidence(`Reflection count: ${reflections}`, "transcript", "empathy")],
        notes: reflections === 0 ? ["Add at least one accurate feeling reflection."] : [],
      };
    },
    active_listening: () => {
      const advice = process?.advice_count ?? 0;
      const reflections = process?.reflection_count ?? 0;
      const score = clamp(
        55 + reflections * 12 - advice * 10 + (process?.interruption_markers ? -8 : 0),
      );
      const cite = citeTurn(
        input.messages,
        (l) => /\b(tell me more|go on|what happened next|you mentioned)\b/.test(l),
        "active_listening",
      );
      return {
        score,
        evidence: [
          cite ??
            emptyEvidence(
              `Reflections ${reflections}; advice moves ${advice} across ${therapistTurns} turns.`,
              "transcript",
              "active_listening",
            ),
        ],
        notes: advice > 1 ? ["Premature advice reduced listening score."] : [],
      };
    },
    reflection: () => {
      const n = process?.reflection_count ?? 0;
      const cite = citeTurn(
        input.messages,
        (l) => /\b(what i hear|it sounds like|you're saying)\b/.test(l),
        "reflection",
      );
      return {
        score: processScore(n, 2),
        evidence: [cite ?? emptyEvidence(`Reflection utterances: ${n}`, "transcript", "reflection")],
        notes: [],
      };
    },
    validation: () => {
      const n = process?.validation_count ?? 0;
      const cite = citeTurn(
        input.messages,
        (l) => /\b(that makes sense|understandable|valid|of course you)\b/.test(l),
        "validation",
      );
      return {
        score: processScore(n, 2),
        evidence: [cite ?? emptyEvidence(`Validation utterances: ${n}`, "transcript", "validation")],
        notes: [],
      };
    },
    open_questions: () => {
      const n = process?.open_question_count ?? 0;
      const cite = citeTurn(
        input.messages,
        (l) => /^(what|how|tell me)\b/.test(l) || /\b(what|how)\b.*\?/.test(l),
        "open_questions",
      );
      return {
        score: processScore(n, 3),
        evidence: [cite ?? emptyEvidence(`Open questions: ${n}`, "transcript", "open_questions")],
        notes: [],
      };
    },
    closed_questions: () => {
      const open = process?.open_question_count ?? 0;
      const closed = process?.closed_question_count ?? 0;
      const total = open + closed || 1;
      // Reward balanced use — neither zero nor dominance.
      const ratio = closed / total;
      const score = clamp(100 - Math.abs(ratio - 0.35) * 180);
      return {
        score,
        evidence: [
          emptyEvidence(
            `Closed ${closed} / open ${open} (closed ratio ${(ratio * 100).toFixed(0)}%).`,
            "transcript",
            "closed_questions",
          ),
        ],
        notes:
          ratio > 0.7
            ? ["Closed questions dominate; prefer open exploration."]
            : [],
      };
    },
    summarization: () => {
      const n = process?.summarization_count ?? 0;
      const cite = citeTurn(
        input.messages,
        (l) => /\b(to summarize|let me summarize|so far we've|putting this together)\b/.test(l),
        "summarization",
      );
      return {
        score: processScore(n, 1),
        evidence: [cite ?? emptyEvidence(`Summaries: ${n}`, "transcript", "summarization")],
        notes: n === 0 ? ["Offer one mid-session or closing summary."] : [],
      };
    },
    boundary_management: () => {
      const cite = citeTurn(
        input.messages,
        (l) =>
          /\b(our (time|session)|role as|i'm (your|a) (therapist|clinician)|confidential)\b/.test(
            l,
          ),
        "boundary_management",
      );
      const hostility = citeTurn(
        input.messages,
        (l) => /\b(just do what i say|you have to)\b/.test(l),
        "boundary_management",
      );
      let score = cite ? 78 : 55;
      if (hostility) score -= 25;
      return {
        score: clamp(score),
        evidence: [
          cite ??
            emptyEvidence(
              "No explicit boundary/role language observed in therapist turns.",
              "transcript",
              "boundary_management",
            ),
        ],
        notes: hostility ? ["Coercive language undermines boundaries."] : [],
      };
    },
    risk_assessment: () => {
      const r = rubricScore(input.items, ["risk", "safety"]);
      const ace = aceScore(input.aceCompetencies, [
        "risk_assessment",
        "suicide_assessment",
        "violence_assessment",
      ]);
      const present = process?.risk_inquiry_present ?? false;
      const cite = citeTurn(
        input.messages,
        (l) =>
          /\b(suicid|harm yourself|ending your life|safety plan|thoughts of (dying|death)|hurt (yourself|others))\b/.test(
            l,
          ),
        "risk_assessment",
      );
      return {
        score: blend(
          [
            { score: r.score, weight: 3 },
            { score: ace, weight: 2 },
            { score: present ? 90 : 25, weight: 3 },
          ],
          present ? 70 : 30,
        ),
        evidence: [
          cite ??
            emptyEvidence(
              present
                ? "Risk inquiry flagged by interview process heuristics."
                : "No risk inquiry detected in therapist turns.",
              "transcript",
              "risk_assessment",
            ),
        ],
        notes: present ? [] : ["Direct risk inquiry was not observed."],
      };
    },
    diagnostic_reasoning: () => {
      const r = rubricScore(input.items, [
        "dsm",
        "icd",
        "differential",
        "assessment",
      ]);
      const ace = aceScore(input.aceCompetencies, [
        "differential_diagnosis",
        "dsm5_reasoning",
        "icd11_reasoning",
      ]);
      const cite = citeTurn(
        input.messages,
        (l) =>
          /\b(how long|when did|symptom|episode|differential|criteria)\b/.test(l),
        "diagnostic_reasoning",
      );
      return {
        score: blend([{ score: r.score, weight: 3 }, { score: ace, weight: 2 }], 50),
        evidence: [
          cite ??
            emptyEvidence(
              r.feedback ?? "Diagnostic reasoning inferred from assessment rubric items.",
              "assessment",
              "diagnostic_reasoning",
            ),
        ],
        notes: ["Uses case teaching / assessment evidence only — no invented diagnosis."],
      };
    },
    case_formulation: () => {
      const r = rubricScore(input.items, ["formulation", "clinical_formulation"]);
      const cite = citeTurn(
        input.messages,
        (l) =>
          /\b(pattern|maintains?|belief|what keeps|in your life|meaning)\b/.test(l),
        "case_formulation",
      );
      return {
        score: blend([{ score: r.score, weight: 3 }, { score: input.overall, weight: 1 }], 48),
        evidence: [
          cite ??
            emptyEvidence(
              r.feedback ?? "Formulation cues limited in transcript.",
              "assessment",
              "case_formulation",
            ),
        ],
        notes: [],
      };
    },
    clinical_prioritization: () => {
      const riskOk = process?.risk_inquiry_present ?? false;
      const adviceEarly =
        (process?.advice_count ?? 0) > 0 && !(process?.risk_inquiry_present ?? false);
      let score = riskOk ? 75 : 45;
      if (adviceEarly) score -= 20;
      return {
        score: clamp(score),
        evidence: [
          emptyEvidence(
            riskOk
              ? "Risk addressed before or alongside change strategies."
              : "Advice or exploration proceeded without observed risk inquiry.",
            "transcript",
            "clinical_prioritization",
          ),
        ],
        notes: adviceEarly ? ["Prioritize safety before advice."] : [],
      };
    },
    professional_language: () => {
      const stigma = citeTurn(
        input.messages,
        (l) => /\b(crazy|psycho|attention[- ]seeking|just get over)\b/.test(l),
        "professional_language",
      );
      const ace = aceScore(input.aceCompetencies, ["professional_communication"]);
      let score = blend([{ score: ace, weight: 2 }, { score: 72, weight: 1 }], 70);
      if (stigma) score = Math.min(score, 25);
      return {
        score: clamp(score),
        evidence: [
          stigma ??
            emptyEvidence(
              "No stigmatizing language detected in therapist turns.",
              "transcript",
              "professional_language",
            ),
        ],
        notes: stigma ? ["Stigmatizing language observed."] : [],
      };
    },
    ethics: () => {
      const r = rubricScore(input.items, ["educational_competency", "safety"]);
      const ace = aceScore(input.aceCompetencies, ["ethical_decision_making"]);
      const coerce = citeTurn(
        input.messages,
        (l) => /\b(you (must|have to)|or else|if you don't)\b/.test(l),
        "ethics",
      );
      let score = blend([{ score: r.score, weight: 1 }, { score: ace, weight: 2 }], 65);
      if (coerce) score = Math.min(score, 30);
      return {
        score: clamp(score),
        evidence: [
          coerce ??
            emptyEvidence(
              "No coercive language detected; ethics inferred from professional cues.",
              "transcript",
              "ethics",
            ),
        ],
        notes: [],
      };
    },
    documentation: () => {
      const ace = aceScore(input.aceCompetencies, ["documentation"]);
      const planCue = process?.closure_present ?? false;
      return {
        score: blend(
          [
            { score: ace, weight: 2 },
            { score: planCue ? 75 : 40, weight: 2 },
          ],
          50,
        ),
        evidence: [
          emptyEvidence(
            planCue
              ? "Closure/next-step language supports documentation quality."
              : "Limited closure cues for educational documentation proxy.",
            "transcript",
            "documentation",
          ),
        ],
        notes: [],
      };
    },
    session_structure: () => {
      const r = rubricScore(input.items, ["structure"]);
      const ace = aceScore(input.aceCompetencies, ["time_management"]);
      const closure = process?.closure_present ?? false;
      const summaries = process?.summarization_count ?? 0;
      return {
        score: blend(
          [
            { score: r.score, weight: 2 },
            { score: ace, weight: 1 },
            { score: closure ? 80 : 40, weight: 2 },
            { score: processScore(summaries, 1), weight: 1 },
          ],
          50,
        ),
        evidence: [
          emptyEvidence(
            `Closure present: ${closure}; summaries: ${summaries}.`,
            "transcript",
            "session_structure",
          ),
        ],
        notes: [],
      };
    },
    treatment_planning: () => {
      const r = rubricScore(input.items, ["intervention", "treatment"]);
      const ace = aceScore(input.aceCompetencies, ["treatment_planning"]);
      const cite = citeTurn(
        input.messages,
        (l) =>
          /\b(next steps|homework|plan|between (now|sessions)|would you be willing)\b/.test(
            l,
          ),
        "treatment_planning",
      );
      return {
        score: blend([{ score: r.score, weight: 2 }, { score: ace, weight: 2 }], cite ? 70 : 45),
        evidence: [
          cite ??
            emptyEvidence(
              r.feedback ?? "Limited treatment-planning language in transcript.",
              "assessment",
              "treatment_planning",
            ),
        ],
        notes: [],
      };
    },
    termination: () => {
      const closure = process?.closure_present ?? false;
      const cite = citeTurn(
        input.messages,
        (l) =>
          /\b(before we (finish|end|stop)|to close|see you next|until next)\b/.test(l),
        "termination",
      );
      return {
        score: closure ? 82 : 35,
        evidence: [
          cite ??
            emptyEvidence(
              closure
                ? "Session closure markers present."
                : "No termination/closure language observed.",
              "transcript",
              "termination",
            ),
        ],
        notes: closure ? [] : ["Close with summary, next steps, and safety check."],
      };
    },
  };

  return THERAPIST_SKILL_DEFINITIONS.map((def) => {
    const built = builders[def.id]();
    return {
      id: def.id,
      score: built.score,
      level: levelFromScore(built.score),
      weight: def.weight,
      evidence: built.evidence,
      notes: built.notes,
    };
  });
}

export function weightedTherapistOverall(scores: TherapistSkillScore[]): number {
  const defWeight = (id: TherapistSkillId) =>
    skillDefinitionById(id)?.weight ?? 1;
  const num = scores.reduce((a, s) => a + s.score * defWeight(s.id), 0);
  const den = scores.reduce((a, s) => a + defWeight(s.id), 0);
  return clamp(num / Math.max(1, den));
}
