import { z } from "zod";

/** Strict schema for AI SDK structured output (Gateway). */
export const assessmentStructuredSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      status: z.enum(["scored", "cannot_score"]),
      // null only with status "cannot_score".
      score: z.number().min(0).max(5).nullable(),
      feedback: z.string(),
      evidence: z.array(z.object({ turn: z.number().int(), quote: z.string() })),
      reason: z.string().nullable(),
    }),
  ),
  narrative: z.string(),
  excerpts: z.array(z.string()),
});

/**
 * Lenient model schema for OpenAI text JSON.
 * GPT often returns >5 excerpts or out-of-range / string scores; rejecting those
 * previously forced heuristicAssessment for every report.
 */
/** "cannot_score" in the spellings models use; anything else is "scored". */
function normalizeItemStatus(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const t = v.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (/^(cannot_score|can_?not_be_scored|not_scorable|unscorable|insufficient_evidence)$/.test(t)) {
    return "cannot_score";
  }
  return t;
}

export const assessmentSchema = z.object({
  items: z.array(
    z
      .object({
        id: z.string(),
        // "cannot_score": the transcript gave no fair basis for this item.
        status: z
          .preprocess(normalizeItemStatus, z.enum(["scored", "cannot_score"]))
          .catch("scored"),
        // A null or blank score is a missing score, not a 0: Number(null) === 0
        // would otherwise turn it into a real-looking failing mark. It is
        // allowed only on a "cannot_score" item (refined below).
        score: z
          .preprocess(
            (v) => (v === null || (typeof v === "string" && !v.trim()) ? undefined : v),
            z.union([z.undefined(), z.coerce.number()]),
          )
          .transform((n) => (n === undefined ? undefined : Math.min(5, Math.max(0, n)))),
        feedback: z.string().catch(""),
        // Citations, checked against the transcript by verifyEvidence().
        evidence: z.unknown().optional(),
        reason: z.string().optional().catch(undefined),
      })
      .superRefine((item, ctx) => {
        if (item.status === "scored" && item.score === undefined) {
          ctx.addIssue({ code: "custom", path: ["score"], message: "score is required" });
        }
      }),
  ),
  narrative: z.string(),
  // Do not .max(5) here — that rejected valid AI JSON. Truncate after parse.
  excerpts: z.array(z.string()).catch([]),
  // Words for the trainee (no scores). Optional and never fatal: shaped and
  // filtered by normalizeTraineeFeedback() before it is stored.
  trainee_feedback: z.unknown().optional(),
});

export type AssessmentModelOutput = z.infer<typeof assessmentSchema>;

/**
 * Extract a JSON object from model text. Handles markdown fences and leading prose
 * (common GPT-5 failure modes that previously forced heuristicAssessment).
 */
export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("empty assessment model response");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // continue
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return JSON.parse(fenced[1]!.trim());
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }

  throw new Error("assessment model response is not valid JSON");
}

/**
 * GPT often returns `items` as an object keyed by rubric id instead of an array:
 * `{ "alliance": { score, feedback }, ... }`. That shape previously failed Zod
 * and forced heuristicAssessment even when narrative/scores were present.
 */
export function normalizeAssessmentPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const obj = { ...(raw as Record<string, unknown>) };
  const items = obj.items;
  if (items && !Array.isArray(items) && typeof items === "object") {
    obj.items = Object.entries(items as Record<string, unknown>).map(
      ([key, value]) => {
        if (value && typeof value === "object" && !Array.isArray(value)) {
          const v = value as Record<string, unknown>;
          return {
            ...v,
            id: typeof v.id === "string" && v.id.trim() ? v.id : key,
            score: v.score,
            feedback: typeof v.feedback === "string" ? v.feedback : "",
          };
        }
        return { id: key, score: value, feedback: "" };
      },
    );
  }
  return obj;
}

export function parseAssessmentModelText(text: string): AssessmentModelOutput {
  const parsed = normalizeAssessmentPayload(extractJsonObject(text));
  const validated = assessmentSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `assessment JSON schema mismatch: ${validated.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  return {
    ...validated.data,
    excerpts: validated.data.excerpts.slice(0, 5),
  };
}
