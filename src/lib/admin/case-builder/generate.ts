/**
 * Phase 9 — server-side AI assistants for Guided Case Builder.
 * Suggestions only; never persist. Fail closed on invalid output.
 */

import { generateText } from "ai";
import {
  gatewayModelId,
  hasAnyAiKey,
  preferOpenAiSdk,
} from "@/lib/ai/provider";
import { openAIService } from "@/lib/ai/openai/service";
import type { AiSource } from "@/lib/ai/provider";
import type { TherapyModality } from "@/lib/case-engine/types";
import type { SymptomProfileItem } from "@/lib/types";
import {
  THERAPY_FRAMEWORKS,
  listLibrarySymptoms,
  type TrainingPresentation,
} from "./catalogues";
import type { GeneratedCaseBundle, GuidedCaseDraft, StructuredContext } from "./draft";
import { validateAiSymptomSuggestions } from "./validation";

export type CaseBuilderGenerateKind =
  | "symptoms"
  | "context"
  | "framework"
  | "case";

export type CaseBuilderGenerateResult =
  | {
      ok: true;
      kind: "symptoms";
      suggestions: SymptomProfileItem[];
      aiSource: AiSource;
      model?: string;
    }
  | {
      ok: true;
      kind: "context";
      structured: StructuredContext;
      aiSource: AiSource;
      model?: string;
    }
  | {
      ok: true;
      kind: "framework";
      primary: TherapyModality;
      supporting: TherapyModality[];
      rationale: string;
      aiSource: AiSource;
      model?: string;
    }
  | {
      ok: true;
      kind: "case";
      generated: GeneratedCaseBundle;
      aiSource: AiSource;
      model?: string;
    }
  | { ok: false; error: string; code: string };

const SYSTEM = `You assist educators authoring FICTIONAL psychiatric training simulations for VPsych.
Rules:
- Output JSON only matching the requested schema.
- Never invent real patient identifiers, phone numbers, national IDs, or MRNs.
- Never dump proprietary DSM/ICD criterion text.
- Stay within the provided training presentation and controlled libraries.
- Educational simulation only — not real clinical advice.
- If uncertain, omit a field rather than inventing medical facts.`;

async function completeJson(
  userPrompt: string,
): Promise<
  | { ok: true; text: string; aiSource: AiSource; model?: string }
  | { ok: false; error: string; code: string }
> {
  if (!hasAnyAiKey()) {
    return {
      ok: false,
      error: "AI generation is temporarily unavailable.",
      code: "AI_UNAVAILABLE",
    };
  }

  try {
    if (preferOpenAiSdk()) {
      const result = await openAIService.chat({
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        maxCompletionTokens: 1200,
        json: true,
      });
      if (!result.text.trim()) {
        return {
          ok: false,
          error: "AI returned empty output.",
          code: "AI_EMPTY",
        };
      }
      return {
        ok: true,
        text: result.text,
        aiSource: "gpt",
        model: result.model,
      };
    }

    const model = gatewayModelId();
    const { text } = await generateText({
      model,
      system: SYSTEM,
      prompt: userPrompt,
      temperature: 0.4,
      maxOutputTokens: 1200,
    });
    if (!text.trim()) {
      return {
        ok: false,
        error: "AI returned empty output.",
        code: "AI_EMPTY",
      };
    }
    return { ok: true, text, aiSource: "gateway", model };
  } catch {
    return {
      ok: false,
      error: "AI generation is temporarily unavailable.",
      code: "AI_PROVIDER_ERROR",
    };
  }
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function draftContextSummary(draft: GuidedCaseDraft): string {
  return JSON.stringify(
    {
      case_type: "training_simulation",
      presentation: {
        slug: draft.presentationSlug,
        name: draft.presentationName,
        dsm5_code: draft.dsm5Code,
        icd11_code: draft.icd11Code,
      },
      profile: draft.profile,
      goals: draft.goals.map((g) => g.label),
      symptoms: draft.symptoms.map((s) => ({
        id: s.id,
        description: s.description,
        salience: s.salience,
      })),
      contextNarrative: draft.contextNarrative,
      structuredContext: draft.structuredContext,
      primaryFramework: draft.primaryFramework,
      supportingFrameworks: draft.supportingFrameworks,
      communicationStyle: draft.communicationStyle,
      therapeuticChallenges: draft.therapeuticChallenges,
      risk: draft.riskProfile,
    },
    null,
    2,
  );
}

export async function generateCaseBuilderSuggestions(params: {
  kind: CaseBuilderGenerateKind;
  draft: GuidedCaseDraft;
  presentation?: TrainingPresentation | null;
}): Promise<CaseBuilderGenerateResult> {
  const { kind, draft, presentation } = params;

  if (kind === "symptoms") {
    const library = listLibrarySymptoms()
      .slice(0, 80)
      .map((s) => ({
        id: s.id,
        description: s.description,
        domain: s.domain,
        salience: s.salience,
      }));
    const packageSymptoms = presentation?.symptoms ?? [];
    const prompt = `Suggest symptoms for this FICTIONAL training case.
Prefer IDs from the library or package list. You may propose custom_* ids if needed.
Return JSON: { "symptoms": [ { "id", "description", "domain", "salience" } ] }
salience ∈ presenting|elicited|hidden. domain ∈ mood|anxiety|sleep|appetite|cognition|somatic|social|behavioral|psychotic|trauma.
Package symptoms: ${JSON.stringify(packageSymptoms)}
Library sample: ${JSON.stringify(library)}
Case: ${draftContextSummary(draft)}`;

    const raw = await completeJson(prompt);
    if (!raw.ok) return raw;
    const obj = parseJsonObject(raw.text);
    if (!obj) {
      return { ok: false, error: "Invalid AI JSON.", code: "AI_INVALID" };
    }
    const validated = validateAiSymptomSuggestions(obj.symptoms);
    if (!validated.ok) {
      return { ok: false, error: validated.error, code: "AI_INVALID" };
    }
    return {
      ok: true,
      kind: "symptoms",
      suggestions: validated.symptoms,
      aiSource: raw.aiSource,
      model: raw.model,
    };
  }

  if (kind === "context") {
    const prompt = `Structure this educator narrative into training fields.
Return JSON: {
  "education": string,
  "stressors": string[],
  "familyHistory": string,
  "previousTreatment": string,
  "medications": string,
  "medicalHistory": string,
  "occupation": string,
  "livingSituation": string
}
Do not invent medications or diagnoses not implied by the narrative.
Narrative: ${JSON.stringify(draft.contextNarrative)}
Case: ${draftContextSummary(draft)}`;

    const raw = await completeJson(prompt);
    if (!raw.ok) return raw;
    const obj = parseJsonObject(raw.text);
    if (!obj) {
      return { ok: false, error: "Invalid AI JSON.", code: "AI_INVALID" };
    }
    const stressors = Array.isArray(obj.stressors)
      ? obj.stressors.filter((s): s is string => typeof s === "string").slice(0, 12)
      : [];
    const structured: StructuredContext = {
      education: typeof obj.education === "string" ? obj.education : undefined,
      stressors,
      familyHistory:
        typeof obj.familyHistory === "string" ? obj.familyHistory : undefined,
      previousTreatment:
        typeof obj.previousTreatment === "string"
          ? obj.previousTreatment
          : undefined,
      medications:
        typeof obj.medications === "string" ? obj.medications : undefined,
      medicalHistory:
        typeof obj.medicalHistory === "string" ? obj.medicalHistory : undefined,
      occupation:
        typeof obj.occupation === "string" ? obj.occupation : undefined,
      livingSituation:
        typeof obj.livingSituation === "string"
          ? obj.livingSituation
          : undefined,
    };
    return {
      ok: true,
      kind: "context",
      structured,
      aiSource: raw.aiSource,
      model: raw.model,
    };
  }

  if (kind === "framework") {
    const allowed = THERAPY_FRAMEWORKS.map((f) => f.modality);
    const prompt = `Recommend a primary therapeutic framework from this controlled list only: ${allowed.join(", ")}.
Return JSON: { "primary": string, "supporting": string[], "rationale": string }
supporting ⊆ list, max 2. rationale must explain educational simulation fit (not real treatment advice).
Case: ${draftContextSummary(draft)}`;

    const raw = await completeJson(prompt);
    if (!raw.ok) return raw;
    const obj = parseJsonObject(raw.text);
    if (!obj || typeof obj.primary !== "string") {
      return { ok: false, error: "Invalid AI JSON.", code: "AI_INVALID" };
    }
    if (!allowed.includes(obj.primary as TherapyModality)) {
      return {
        ok: false,
        error: "AI recommended an unsupported framework.",
        code: "AI_INVALID",
      };
    }
    const supporting = Array.isArray(obj.supporting)
      ? obj.supporting
          .filter(
            (m): m is TherapyModality =>
              typeof m === "string" && allowed.includes(m as TherapyModality),
          )
          .filter((m) => m !== obj.primary)
          .slice(0, 2)
      : [];
    const rationale =
      typeof obj.rationale === "string" ? obj.rationale.trim() : "";
    if (!rationale || rationale.length > 800) {
      return {
        ok: false,
        error: "AI rationale missing or invalid.",
        code: "AI_INVALID",
      };
    }
    return {
      ok: true,
      kind: "framework",
      primary: obj.primary as TherapyModality,
      supporting,
      rationale,
      aiSource: raw.aiSource,
      model: raw.model,
    };
  }

  // kind === "case"
  const prompt = `Synthesize a FICTIONAL training patient narrative bundle.
Return JSON with optional string fields:
presentingComplaint, historyNarrative, symptomNarrative, timeline, psychosocialContext,
medicalHistory, psychiatricHistory, familyHistory, substanceContext, mentalStatePresentation,
riskNarrative, sessionBehaviour, expectedTherapeuticResponses, hiddenInformationNotes,
personaPromptEn, displayNameEn, cityEn, countryEn, occupationEn
Keep displayNameEn fictional. Do not invent real identifiers.
Case: ${draftContextSummary(draft)}`;

  const raw = await completeJson(prompt);
  if (!raw.ok) return raw;
  const obj = parseJsonObject(raw.text);
  if (!obj) {
    return { ok: false, error: "Invalid AI JSON.", code: "AI_INVALID" };
  }
  const stringFields = [
    "presentingComplaint",
    "historyNarrative",
    "symptomNarrative",
    "timeline",
    "psychosocialContext",
    "medicalHistory",
    "psychiatricHistory",
    "familyHistory",
    "substanceContext",
    "mentalStatePresentation",
    "riskNarrative",
    "sessionBehaviour",
    "expectedTherapeuticResponses",
    "hiddenInformationNotes",
    "personaPromptEn",
    "displayNameEn",
    "cityEn",
    "countryEn",
    "occupationEn",
  ] as const;
  const generated: GeneratedCaseBundle = {};
  let filled = 0;
  for (const key of stringFields) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) {
      generated[key] = v.trim().slice(0, 2000);
      filled += 1;
    }
  }
  if (filled < 3) {
    return {
      ok: false,
      error: "AI case output incomplete.",
      code: "AI_INVALID",
    };
  }
  return {
    ok: true,
    kind: "case",
    generated,
    aiSource: raw.aiSource,
    model: raw.model,
  };
}
