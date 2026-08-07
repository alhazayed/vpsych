/**
 * Modality recognition — identify what actually occurred.
 * Never force a modality onto the case or patient.
 */

import type { TherapyModality } from "@/lib/case-engine/types";
import { emptyEvidence } from "@/lib/supervisor/competency-engine";
import type {
  EvidenceCitation,
  ModalityDetection,
  RecognizedModality,
} from "@/lib/supervisor/types";

type ModalityPattern = {
  modality: RecognizedModality;
  patterns: RegExp[];
};

const PATTERNS: ModalityPattern[] = [
  {
    modality: "cbt",
    patterns: [
      /\b(thought record|cognitive (distortion|restructuring)|automatic thought|behavioural experiment|homework)\b/i,
      /\b(what's the evidence|alternative thought|thinking trap)\b/i,
    ],
  },
  {
    modality: "dbt",
    patterns: [
      /\b(dialectical|opposite action|distress tolerance|wise mind|interpersonal effectiveness)\b/i,
      /\b(validation\s+(level|strategy)|urge surfing)\b/i,
    ],
  },
  {
    modality: "act",
    patterns: [
      /\b(acceptance and commitment|defusion|values[- ]based|psychological flexibility|committed action)\b/i,
      /\b(notice that thought|as a thought)\b/i,
    ],
  },
  {
    modality: "mi",
    patterns: [
      /\b(change talk|sustain talk|on a scale of|how ready|rolling with resistance)\b/i,
      /\b(what would you like to change|pros and cons)\b/i,
    ],
  },
  {
    modality: "psychodynamic",
    patterns: [
      /\b(transference|unconscious|early relationship|defence|defense mechanism|interpretation)\b/i,
      /\b(pattern with (me|others)|what comes up for you)\b/i,
    ],
  },
  {
    modality: "supportive",
    patterns: [
      /\b(support(ive)?|reassure|you're not alone|we can face this)\b/i,
    ],
  },
  {
    modality: "behavioral",
    patterns: [
      /\b(behavioural activation|activity scheduling|exposure hierarchy|reinforcement)\b/i,
      /\b(behavioral activation|graded exposure)\b/i,
    ],
  },
  {
    modality: "solution_focused",
    patterns: [
      /\b(miracle question|exception question|scaling question|what's already working)\b/i,
    ],
  },
  {
    modality: "family_therapy",
    patterns: [
      /\b(family (session|system|dynamics)|genogram|how does your (partner|parent|family))\b/i,
    ],
  },
  {
    modality: "trauma_focused",
    patterns: [
      /\b(trauma(-focused)?|grounding|flashback|trigger|safety first|ptsd)\b/i,
    ],
  },
  {
    modality: "acceptance",
    patterns: [
      /\b(making room for|willingness|accept(ing)? (the feeling|this pain))\b/i,
    ],
  },
  {
    modality: "schema_therapy",
    patterns: [
      /\b(schema|mode work|limited reparenting|early maladaptive)\b/i,
    ],
  },
  {
    modality: "ipt",
    patterns: [
      /\b(interpersonal (therapy|inventory)|role transition|grief work|dispute)\b/i,
    ],
  },
];

function caseModalityToRecognized(
  m: TherapyModality | undefined | null,
): RecognizedModality | null {
  if (!m) return null;
  const map: Partial<Record<TherapyModality, RecognizedModality>> = {
    cbt: "cbt",
    dbt: "dbt",
    act: "act",
    psychodynamic: "psychodynamic",
    supportive: "supportive",
    motivational_interviewing: "mi",
    family_therapy: "family_therapy",
    crisis_intervention: "trauma_focused",
    exposure_therapy: "behavioral",
  };
  return map[m] ?? null;
}

/**
 * Detect modalities from therapist turns only.
 * Returns empty/unknown rather than inventing a forced modality.
 */
export function detectModalities(input: {
  messages: Array<{ role: string; content: string }>;
  caseModality?: TherapyModality | null;
}): ModalityDetection[] {
  const therapist = input.messages.filter((m) => m.role === "user");
  const hits = new Map<
    RecognizedModality,
    { count: number; evidence: EvidenceCitation[] }
  >();

  for (let i = 0; i < therapist.length; i++) {
    const turn = therapist[i]!;
    const text = turn.content;
    for (const { modality, patterns } of PATTERNS) {
      for (const re of patterns) {
        if (re.test(text)) {
          const cur = hits.get(modality) ?? { count: 0, evidence: [] };
          cur.count += 1;
          if (cur.evidence.length < 3) {
            cur.evidence.push({
              source: "transcript",
              excerpt: text.slice(0, 160),
              message_index: i,
            });
          }
          hits.set(modality, cur);
          break;
        }
      }
    }
  }

  const caseRec = caseModalityToRecognized(input.caseModality);
  const detections: ModalityDetection[] = [...hits.entries()]
    .map(([modality, v]) => ({
      modality,
      confidence: Math.min(0.95, 0.35 + v.count * 0.15),
      evidence: v.evidence,
      matches_case_modality: caseRec === modality,
    }))
    .sort((a, b) => b.confidence - a.confidence);

  if (detections.length === 0) {
    return [
      {
        modality: "unknown",
        confidence: 0,
        evidence: [
          emptyEvidence(
            "No modality-specific therapist language detected in this transcript.",
            "transcript",
          ),
        ],
        matches_case_modality: false,
      },
    ];
  }

  return detections;
}

/** Map case TherapyModality → RecognizedModality for portfolio logs (no forcing). */
export function recognizedFromCase(
  m: TherapyModality | null | undefined,
): RecognizedModality {
  return caseModalityToRecognized(m) ?? "unknown";
}
