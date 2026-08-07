/**
 * Clinical Educator scoring engine — multi-dimension feedback with transcript examples.
 */

import type { RubricItem, ScoreEntry, SessionMessage } from "@/lib/types";
import {
  CLINICAL_EDUCATOR_RUBRIC,
  CLINICAL_EDUCATOR_RUBRIC_VERSION,
  CLINICAL_EDUCATOR_VERSION,
  localizeDimensionLabel,
  toAssessmentRubricItems,
} from "@/lib/clinical-educator/rubrics";
import type {
  ClinicalEducatorDimensionId,
  ClinicalEducatorDimensionScore,
  ClinicalEducatorReport,
} from "@/lib/clinical-educator/types";
import { CLINICAL_EDUCATOR_DIMENSION_IDS } from "@/lib/clinical-educator/types";

function clampScore(n: number, max = 5): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(max, Math.max(0, Math.round(n)));
}

function therapistTurns(
  messages: Pick<SessionMessage, "role" | "content">[],
): string[] {
  return messages.filter((m) => m.role === "user").map((m) => m.content.trim()).filter(Boolean);
}

function countHits(text: string, cues: string[]): number {
  const lower = text.toLowerCase();
  return cues.filter((c) => lower.includes(c.toLowerCase())).length;
}

/** Pull transcript quotes that match dimension cues (max 3). */
export function extractTranscriptExamples(
  messages: Pick<SessionMessage, "role" | "content">[],
  cues: string[],
  limit = 3,
): string[] {
  const turns = therapistTurns(messages);
  const scored = turns
    .map((content) => ({
      content,
      hits: countHits(content, cues),
    }))
    .filter((t) => t.hits > 0)
    .sort((a, b) => b.hits - a.hits || b.content.length - a.content.length);

  const out: string[] = [];
  for (const t of scored) {
    if (out.length >= limit) break;
    const snippet =
      t.content.length > 220 ? `${t.content.slice(0, 217).trim()}…` : t.content;
    if (!out.includes(snippet)) out.push(snippet);
  }
  return out;
}

function compositeFromDimensions(
  dimensions: ClinicalEducatorDimensionScore[],
): number {
  const totalWeight = dimensions.reduce((s, d) => s + d.weight, 0) || 1;
  const sum = dimensions.reduce(
    (s, d) => s + (d.score / d.max) * 100 * (d.weight / totalWeight),
    0,
  );
  return Math.round(sum);
}

function educationalCopy(
  language: "en" | "ar",
  id: ClinicalEducatorDimensionId,
  score: number,
  examples: string[],
): Pick<
  ClinicalEducatorDimensionScore,
  "feedback" | "strengths" | "growth_areas" | "next_practice"
> {
  const rubric = CLINICAL_EDUCATOR_RUBRIC.find((r) => r.id === id)!;
  const label = language === "ar" ? rubric.label_ar : rubric.label_en;
  const hasExamples = examples.length > 0;

  if (language === "ar") {
    if (score >= 4) {
      return {
        feedback: `أداء قوي في «${label}». حافظ على العمق السريري نفسه مع مزيد من التحديد.`,
        strengths: [
          hasExamples
            ? "ظهرت أدلة واضحة في نص المحادثة تدعم هذا البُعد."
            : "مستوى الكفاءة مرتفع نسبياً في هذا البُعد.",
        ],
        growth_areas: ["اربط المهارة صراحةً بأهداف الجلسة التالية."],
        next_practice: `تمرين قصير: سجّل مقطعاً مدته دقيقتان يركّز فقط على «${label}» ثم راجع الاقتباسات.`,
      };
    }
    if (score >= 3) {
      return {
        feedback: `مستوى كافٍ في «${label}» مع فرص واضحة للتعميق.`,
        strengths: hasExamples
          ? ["ظهرت محاولات ذات صلة في النص."]
          : ["تحقّق الحد الأدنى المتوقع لمتدرّب تحت إشراف."],
        growth_areas: [
          "اجعل الاستفسارات أكثر تحديداً واربطها بالأدلة الواردة من المريض.",
        ],
        next_practice: `أعد صياغة ردّين من الجلسة لتحسين «${label}» ثم قارن.`,
      };
    }
    return {
      feedback: `«${label}» يحتاج علاجاً تعليمياً موجّهاً — الأدلة في النص محدودة أو غير كافية.`,
      strengths: hasExamples
        ? ["وُجدت بدايات يمكن البناء عليها."]
        : ["الفرصة موجودة في الجلسات القادمة."],
      growth_areas: [
        "أدرج أسئلة/تدخلات صريحة لهذا البُعد في أول ثلث الجلسة.",
        "تجنّب الانتقال للموضوع التالي قبل إغلاق حلقة الاستكشاف.",
      ],
      next_practice: `جلسة محاكاة قصيرة (5 دقائق) تُقيَّم فقط على «${label}».`,
    };
  }

  if (score >= 4) {
    return {
      feedback: `Strong work on ${label}. Keep the same clinical depth while naming the skill more explicitly for coaching transfer.`,
      strengths: [
        hasExamples
          ? "Transcript evidence clearly supports this dimension."
          : "Competency level is relatively high on this dimension.",
      ],
      growth_areas: ["Link the skill explicitly to the next session goal."],
      next_practice: `Drill: record a 2-minute segment focused only on ${label}, then review quotes.`,
    };
  }
  if (score >= 3) {
    return {
      feedback: `Adequate ${label} with clear room to deepen specificity.`,
      strengths: hasExamples
        ? ["Relevant attempts appear in the transcript."]
        : ["Meets the basic bar for a supervised trainee."],
      growth_areas: [
        "Make inquiries more specific and tether them to patient-offered evidence.",
      ],
      next_practice: `Rewrite two session turns to improve ${label}, then compare.`,
    };
  }
  return {
    feedback: `${label} needs targeted coaching — transcript evidence is thin or insufficient.`,
    strengths: hasExamples
      ? ["Early attempts exist to build on."]
      : ["Opportunity remains in upcoming sessions."],
    growth_areas: [
      "Place explicit questions/interventions for this dimension in the first third of the session.",
      "Avoid topic-hopping before closing the exploration loop.",
    ],
    next_practice: `Run a 5-minute micro-simulation scored only on ${label}.`,
  };
}

/**
 * Heuristic multi-dimension scorer used when the LLM examiner is unavailable.
 * Keyword evidence only — disclosed as formative fallback.
 */
export function heuristicClinicalEducatorScores(
  messages: Pick<SessionMessage, "role" | "content">[],
  language: "en" | "ar",
): ScoreEntry[] {
  const turns = therapistTurns(messages);
  const joined = turns.join("\n").toLowerCase();
  const turnCount = turns.length;
  const base = Math.min(5, Math.max(1, Math.round(turnCount / 3)));

  return CLINICAL_EDUCATOR_RUBRIC.map((r) => {
    const hits = countHits(joined, r.example_cues);
    let score = base;
    if (r.id === "rapport" || r.id === "empathy" || r.id === "therapeutic_alliance") {
      score = Math.min(5, base + Math.min(2, hits));
    } else if (r.id === "risk_assessment") {
      score = hits > 0 ? Math.min(5, 3 + Math.min(2, hits)) : Math.max(1, base - 1);
    } else if (r.id === "history_taking" || r.id === "dsm_reasoning") {
      score = Math.min(
        5,
        Math.max(1, base - 1 + Math.min(2, hits) + (turnCount > 4 ? 1 : 0)),
      );
    } else if (r.id === "session_structure" || r.id === "treatment_planning") {
      score = Math.min(5, Math.max(1, base - 1 + Math.min(2, hits)));
    } else if (r.id === "communication") {
      score = Math.min(5, Math.max(2, turnCount > 3 ? 3 + Math.min(1, hits) : 2));
    } else if (r.id === "professionalism") {
      score = Math.min(5, Math.max(2, hits > 0 ? 4 : turnCount > 2 ? 3 : 2));
    }

    const examples = extractTranscriptExamples(messages, r.example_cues);
    const copy = educationalCopy(language, r.id, score, examples);
    return {
      id: r.id,
      label: language === "ar" ? r.label_ar : r.label_en,
      score: clampScore(score),
      max: r.max,
      weight: r.weight,
      feedback: copy.feedback,
      examples,
    };
  });
}

export function buildClinicalEducatorReport(opts: {
  items: ScoreEntry[];
  messages: Pick<SessionMessage, "role" | "content">[];
  language: "en" | "ar";
  narrative?: string;
  excerpts?: string[];
  assessment_mode: "llm_examiner" | "heuristic_fallback";
}): ClinicalEducatorReport {
  const { language, messages, assessment_mode } = opts;
  const byId = new Map(opts.items.map((i) => [i.id, i]));

  const dimensions: ClinicalEducatorDimensionScore[] =
    CLINICAL_EDUCATOR_DIMENSION_IDS.map((id) => {
      const rubric = CLINICAL_EDUCATOR_RUBRIC.find((r) => r.id === id)!;
      const found = byId.get(id);
      const score = clampScore(found?.score ?? 0, rubric.max);
      const examplesFromItem =
        found?.examples?.filter((e) => typeof e === "string" && e.trim()) ?? [];
      const examples =
        examplesFromItem.length > 0
          ? examplesFromItem.slice(0, 3)
          : extractTranscriptExamples(messages, rubric.example_cues);
      const copy = educationalCopy(language, id, score, examples);
      // Prefer model feedback when present and non-empty; enrich with educational copy.
      const feedback =
        found?.feedback?.trim() &&
        !/^heuristic score/i.test(found.feedback) &&
        !/^درجة تقديرية/i.test(found.feedback)
          ? found.feedback.trim()
          : copy.feedback;

      return {
        id,
        label: localizeDimensionLabel(id, language),
        score,
        max: rubric.max,
        weight: rubric.weight,
        percent: Math.round((score / rubric.max) * 100),
        feedback,
        strengths: copy.strengths,
        growth_areas: copy.growth_areas,
        next_practice: copy.next_practice,
        examples,
      };
    });

  const composite = compositeFromDimensions(dimensions);
  const weak = [...dimensions]
    .sort((a, b) => a.percent - b.percent)
    .slice(0, 3)
    .map((d) => d.label);
  const strong = [...dimensions]
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 3)
    .map((d) => d.label);

  const coaching_excerpts = Array.from(
    new Set([
      ...(opts.excerpts ?? []).slice(0, 5),
      ...dimensions.flatMap((d) => d.examples).slice(0, 5),
    ]),
  ).slice(0, 8);

  const educational_summary =
    language === "ar"
      ? [
          opts.narrative?.trim() ||
            `تقرير المعلّم السريري عبر ${dimensions.length} أبعاد كفاءة.`,
          `نقاط القوة النسبية: ${strong.join("، ")}.`,
          `أولويات التطوير: ${weak.join("، ")}.`,
          "هذه إشارات تعليمية تكوينية وليست اعتماداً سريرياً معتمداً.",
        ].join(" ")
      : [
          opts.narrative?.trim() ||
            `Clinical Educator report across ${dimensions.length} competency dimensions.`,
          `Relative strengths: ${strong.join(", ")}.`,
          `Development priorities: ${weak.join(", ")}.`,
          "These are formative educational signals — not validated clinical credentials.",
        ].join(" ");

  const disclaimer =
    language === "ar"
      ? "درجات المعلّم السريري تكوينية لأغراض التدريب فقط، وغير معتمدة كمقياس كفاءات عالي المخاطر."
      : "Clinical Educator scores are formative training signals only and are not validated high-stakes competency measures.";

  return {
    version: CLINICAL_EDUCATOR_VERSION,
    rubric_version: CLINICAL_EDUCATOR_RUBRIC_VERSION,
    language,
    composite,
    dimensions,
    educational_summary,
    coaching_excerpts,
    assessment_mode,
    disclaimer,
  };
}

/** Default assessment rubric used by assessSession when avatar has none. */
export function clinicalEducatorDefaultRubric(
  language: "en" | "ar",
): RubricItem[] {
  return toAssessmentRubricItems(language);
}

export function isClinicalEducatorDimensionId(
  id: string,
): id is ClinicalEducatorDimensionId {
  return (CLINICAL_EDUCATOR_DIMENSION_IDS as readonly string[]).includes(id);
}
