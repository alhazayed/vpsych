import { z } from "zod";

/** Strict schema for AI SDK structured output (Gateway). */
export const assessmentStructuredSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      score: z.number().min(0).max(5),
      feedback: z.string(),
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
export const assessmentSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      score: z.coerce.number().transform((n) => {
        if (Number.isNaN(n)) return 0;
        return Math.min(5, Math.max(0, n));
      }),
      feedback: z.string().catch(""),
    }),
  ),
  narrative: z.string(),
  // Do not .max(5) here — that rejected valid AI JSON. Truncate after parse.
  excerpts: z.array(z.string()).catch([]),
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

export function parseAssessmentModelText(text: string): AssessmentModelOutput {
  const parsed = extractJsonObject(text);
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
