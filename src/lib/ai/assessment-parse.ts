import { z } from "zod";

/** Coerce model score strings ("4") and clamp to rubric range. */
export const assessmentSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      score: z.coerce.number().min(0).max(5),
      feedback: z.string(),
    }),
  ),
  narrative: z.string(),
  excerpts: z.array(z.string()).max(5),
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
  return assessmentSchema.parse(parsed);
}
