/**
 * Scientific version locks for reproducibility (Mission 19).
 */

/** Patient-avatar system prompt template version (see prompt-engine.ts header). */
export const PROMPT_ENGINE_VERSION = "2.0.0";

/** Examiner assessment structured output / scoring schema version. */
export const ASSESSMENT_SCHEMA_VERSION = "1.1.0";

/** CaseInstance snapshot schema version (types.CaseInstanceSnapshot.version). */
export const CASE_SNAPSHOT_VERSION = 2 as const;

/** Adaptive Curriculum Engine scientific contract version. */
export const ACE_ENGINE_VERSION = "3.0.0";

/** Competency Graph Engine scientific contract version. */
export const CGE_ENGINE_VERSION = "3.0.0";

/** Default rubric schema id for examiner scoring. */
export const RUBRIC_SCHEMA_VERSION = "default-v1";

export type ScientificProvenance = {
  prompt_engine_version: string;
  assessment_schema_version: string;
  case_snapshot_version: number;
  ace_engine_version: string;
  cge_engine_version: string;
  rubric_schema_version: string;
  /** Set at assessment time */
  ai_source?: string;
  ai_model?: string | null;
  assessed_at?: string;
  /** Heuristic fallback is NOT a validated psychometric instrument */
  assessment_mode?: "llm_examiner" | "heuristic_fallback";
  scientific_limitations?: string[];
};

export function buildGenerationScientificMeta(extra?: {
  template_version?: number | null;
  preset_version?: number | null;
  graph_version?: string | null;
  disorder_package_version?: string;
}): Record<string, unknown> {
  return {
    prompt_engine_version: PROMPT_ENGINE_VERSION,
    assessment_schema_version: ASSESSMENT_SCHEMA_VERSION,
    case_snapshot_version: CASE_SNAPSHOT_VERSION,
    ace_engine_version: ACE_ENGINE_VERSION,
    cge_engine_version: CGE_ENGINE_VERSION,
    rubric_schema_version: RUBRIC_SCHEMA_VERSION,
    template_version: extra?.template_version ?? null,
    preset_version: extra?.preset_version ?? null,
    graph_version: extra?.graph_version ?? null,
    disorder_package_version: extra?.disorder_package_version ?? "catalog-builtin-1",
  };
}

export function buildAssessmentProvenance(input: {
  aiSource: string;
  model?: string | null;
}): ScientificProvenance {
  const heuristic = input.aiSource === "persona_fallback";
  return {
    prompt_engine_version: PROMPT_ENGINE_VERSION,
    assessment_schema_version: ASSESSMENT_SCHEMA_VERSION,
    case_snapshot_version: CASE_SNAPSHOT_VERSION,
    ace_engine_version: ACE_ENGINE_VERSION,
    cge_engine_version: CGE_ENGINE_VERSION,
    rubric_schema_version: RUBRIC_SCHEMA_VERSION,
    ai_source: input.aiSource,
    ai_model: input.model ?? null,
    assessed_at: new Date().toISOString(),
    assessment_mode: heuristic ? "heuristic_fallback" : "llm_examiner",
    scientific_limitations: heuristic
      ? [
          "Heuristic keyword scoring is a degradation path, not a validated OSCE instrument",
          "Do not use persona_fallback scores for high-stakes educational research without disclosure",
        ]
      : [
          "LLM examiner scores require human OSCE co-validation before high-stakes claims",
        ],
  };
}
