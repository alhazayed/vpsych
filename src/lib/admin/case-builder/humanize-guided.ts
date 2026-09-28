/**
 * Phase 10D — human-readable summaries for Guided AI / review surfaces.
 * Does not change persistence; presentation only.
 */

import type { GeneratedCaseBundle, StructuredContext } from "./draft";

export type SummaryRow = { label: string; value: string };

const STRUCTURED_KEYS: {
  key: keyof StructuredContext;
  label: string;
}[] = [
  { key: "occupation", label: "Occupation" },
  { key: "education", label: "Education" },
  { key: "livingSituation", label: "Living situation" },
  { key: "stressors", label: "Stressors" },
  { key: "familyHistory", label: "Family history" },
  { key: "previousTreatment", label: "Previous treatment" },
  { key: "medications", label: "Medications" },
  { key: "medicalHistory", label: "Medical history" },
];

const GENERATED_KEYS: {
  key: keyof GeneratedCaseBundle;
  label: string;
}[] = [
  { key: "displayNameEn", label: "Display name (English)" },
  { key: "presentingComplaint", label: "Presenting complaint" },
  { key: "historyNarrative", label: "History" },
  { key: "symptomNarrative", label: "Symptom narrative" },
  { key: "timeline", label: "Timeline" },
  { key: "psychosocialContext", label: "Psychosocial context" },
  { key: "medicalHistory", label: "Medical history" },
  { key: "psychiatricHistory", label: "Psychiatric history" },
  { key: "familyHistory", label: "Family history" },
  { key: "substanceContext", label: "Substance context" },
  { key: "mentalStatePresentation", label: "Mental state" },
  { key: "riskNarrative", label: "Risk narrative" },
  { key: "sessionBehaviour", label: "Session behaviour" },
  { key: "expectedTherapeuticResponses", label: "Expected therapeutic responses" },
  { key: "hiddenInformationNotes", label: "Hidden information notes" },
  { key: "cityEn", label: "City (English)" },
  { key: "countryEn", label: "Country (English)" },
  { key: "occupationEn", label: "Occupation (English)" },
];

function asText(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const parts = value
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter(Boolean);
    return parts.length ? parts.join("; ") : null;
  }
  return null;
}

export function summarizeStructuredContext(
  ctx: StructuredContext | null | undefined,
  labels?: Partial<Record<keyof StructuredContext, string>>,
): SummaryRow[] {
  if (!ctx) return [];
  const rows: SummaryRow[] = [];
  for (const { key, label } of STRUCTURED_KEYS) {
    const text = asText(ctx[key]);
    if (!text) continue;
    rows.push({ label: labels?.[key] ?? label, value: text });
  }
  return rows;
}

export function summarizeGeneratedBundle(
  bundle: GeneratedCaseBundle | null | undefined,
  labels?: Partial<Record<keyof GeneratedCaseBundle, string>>,
): SummaryRow[] {
  if (!bundle) return [];
  const rows: SummaryRow[] = [];
  for (const { key, label } of GENERATED_KEYS) {
    const text = asText(bundle[key]);
    if (!text) continue;
    // Persona prompt is long technical content — keep out of primary summary.
    if (key === "personaPromptEn") continue;
    rows.push({ label: labels?.[key] ?? label, value: text });
  }
  return rows;
}

export function truncateSummary(value: string, max = 220): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}
