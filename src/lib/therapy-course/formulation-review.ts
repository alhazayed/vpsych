/**
 * Compare a trainee's 5 Ps formulation with the case's own 5 Ps.
 *
 * Admin-only and on demand: nothing is persisted, and the trainee never sees
 * the case key or the rating. The rating says how well each P matches what
 * this simulated case was built with; it is not a validated measure.
 */

import { generateText } from "ai";
import { gatewayModelId, hasAnyAiKey, preferOpenAiSdk } from "@/lib/ai/provider";
import type { AiSource } from "@/lib/ai/provider";
import { openAIService } from "@/lib/ai/openai/service";
import { FIVE_PS, type FivePKey, type FivePsFormulation } from "@/lib/types";
import type { CaseFormulationKey } from "./formulation-key";

export const FORMULATION_REVIEW_VERSION = "formulation-review.v1" as const;

export const FORMULATION_RATINGS = [
  "matches",
  "partial",
  "missing",
  "contradicts",
] as const;
export type FormulationRating = (typeof FORMULATION_RATINGS)[number];

export type FivePReview = {
  p: FivePKey;
  rating: FormulationRating;
  /** One or two sentences: what was captured or missed. */
  note: string;
};

export type FormulationReview = {
  version: typeof FORMULATION_REVIEW_VERSION;
  items: FivePReview[];
  aiSource: Exclude<AiSource, "persona_fallback" | "cbe_direct">;
  model?: string;
};

export type FormulationReviewResult =
  | { ok: true; review: FormulationReview }
  | { ok: false; code: "AI_UNAVAILABLE" | "AI_INVALID_OUTPUT" };

const MAX_NOTE = 400;

const P_LABELS: Record<FivePKey, string> = {
  presenting: "Presenting problem",
  predisposing: "Predisposing factors",
  precipitating: "Precipitating factors",
  perpetuating: "Perpetuating factors",
  protective: "Protective factors",
};

export function buildFormulationReviewPrompt(input: {
  trainee: FivePsFormulation;
  key: CaseFormulationKey;
  language: "en" | "ar";
}): { system: string; user: string } {
  const system = [
    "You are a clinical supervisor marking a trainee's 5 Ps case formulation for a FICTIONAL training patient.",
    "You are given, for each P, the facts the simulated case was built with (the answer key) and what the trainee wrote.",
    "For each P choose one rating:",
    '- "matches": the trainee captured the key facts for this P (wording may differ; credit clinically equivalent paraphrase).',
    '- "partial": some key facts captured, important ones missed or vague.',
    '- "missing": nothing relevant to the key for this P.',
    '- "contradicts": the trainee states something the key contradicts.',
    "If the key for a P is empty, rate it \"partial\" unless the trainee's text is clinically implausible, and say the case does not specify this P.",
    "Judge only against the key; do not reward facts the key does not contain, and do not penalise sensible extra hypotheses unless they contradict it.",
    input.language === "ar"
      ? "Write each note in Arabic (Modern Standard Arabic), one or two sentences, addressed to the supervisor."
      : "Write each note in English, one or two sentences, addressed to the supervisor.",
    'Respond with a single JSON object only: {"items":[{"p":"presenting","rating":"matches","note":"..."}, ...]} with exactly one item per P: presenting, predisposing, precipitating, perpetuating, protective.',
  ].join("\n");

  const sections = FIVE_PS.map((p) => {
    const key = input.key[p];
    return [
      `## ${P_LABELS[p]} (${p})`,
      "Case key:",
      key.length ? key.map((k) => `- ${k}`).join("\n") : "- (not specified by the case)",
      "Trainee wrote:",
      input.trainee[p].replace(/\s+/g, " ").trim(),
    ].join("\n");
  });
  return { system, user: sections.join("\n\n") };
}

/** Strict parse of the model's JSON. Null when any P is missing or invalid. */
export function parseFormulationReview(text: string): FivePReview[] | null {
  let parsed: unknown;
  try {
    const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const items = (parsed as { items?: unknown }).items;
  if (!Array.isArray(items)) return null;

  const byP = new Map<FivePKey, FivePReview>();
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const p = r.p as FivePKey;
    const rating = r.rating as FormulationRating;
    if (!FIVE_PS.includes(p) || byP.has(p)) continue;
    if (!FORMULATION_RATINGS.includes(rating)) return null;
    const note = typeof r.note === "string" ? r.note.trim().slice(0, MAX_NOTE) : "";
    byP.set(p, { p, rating, note });
  }
  if (byP.size !== FIVE_PS.length) return null;
  return FIVE_PS.map((p) => byP.get(p)!);
}

export async function reviewFormulation(input: {
  trainee: FivePsFormulation;
  key: CaseFormulationKey;
  language: "en" | "ar";
}): Promise<FormulationReviewResult> {
  if (!hasAnyAiKey()) return { ok: false, code: "AI_UNAVAILABLE" };
  const prompt = buildFormulationReviewPrompt(input);

  let text: string;
  let aiSource: FormulationReview["aiSource"];
  let model: string | undefined;
  try {
    if (preferOpenAiSdk()) {
      const result = await openAIService.chat({
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
        temperature: 0.2,
        maxCompletionTokens: 1500,
        json: true,
      });
      text = result.text;
      aiSource = "gpt";
      model = result.model;
    } else {
      model = gatewayModelId();
      const generated = await generateText({
        model,
        system: prompt.system,
        prompt: prompt.user,
        temperature: 0.2,
        maxOutputTokens: 1500,
      });
      text = generated.text;
      aiSource = "gateway";
    }
  } catch (err) {
    console.warn("[formulation-review]", {
      event: "provider_failed",
      message: err instanceof Error ? err.message.slice(0, 200) : "unknown",
    });
    return { ok: false, code: "AI_UNAVAILABLE" };
  }

  const items = parseFormulationReview(text);
  if (!items) {
    console.warn("[formulation-review]", { event: "invalid_output", model });
    return { ok: false, code: "AI_INVALID_OUTPUT" };
  }
  return {
    ok: true,
    review: { version: FORMULATION_REVIEW_VERSION, items, aiSource, model },
  };
}
