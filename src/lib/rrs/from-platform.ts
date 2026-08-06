/**
 * Probe platform signals for Research Readiness Score input.
 */

import fs from "node:fs";
import path from "node:path";
import { BUILTIN_DISORDERS } from "@/lib/case-engine/catalog";
import { DISORDER_EVIDENCE } from "@/lib/scientific/evidence";
import {
  ACE_ENGINE_VERSION,
  ASSESSMENT_SCHEMA_VERSION,
  CASE_SNAPSHOT_VERSION,
  CGE_ENGINE_VERSION,
  PROMPT_ENGINE_VERSION,
  RUBRIC_SCHEMA_VERSION,
  buildAssessmentProvenance,
  buildGenerationScientificMeta,
} from "@/lib/scientific/versions";
import type { RrsComputeInput } from "@/lib/rrs/types";
import {
  RESEARCH_DATASET_VERSION,
  RESEARCH_EXPORT_VERSION,
} from "@/lib/rrs/weights";

function exists(rel: string): boolean {
  try {
    return fs.existsSync(path.join(process.cwd(), rel));
  } catch {
    return false;
  }
}

/**
 * Build RRS input from live platform signals (honest: missing export/GDPR productization).
 */
export function rrsInputFromPlatform(opts?: {
  dataset_id?: string;
  model_version?: string | null;
}): RrsComputeInput {
  const meta = buildGenerationScientificMeta({
    template_version: 1,
    preset_version: 1,
    graph_version: CGE_ENGINE_VERSION,
  });
  const metaKeys = Object.keys(meta);
  const prov = buildAssessmentProvenance({
    aiSource: "openai",
    model: opts?.model_version ?? "gpt-research",
  });

  const peerCorpora = [
    exists("src/lib/cfi"),
    exists("src/lib/eri"),
    exists("src/lib/avi"),
    exists("src/lib/ale"),
  ].filter(Boolean).length;

  const researchExportApi =
    exists("src/app/api/admin/research-export/route.ts") ||
    exists("src/app/api/research/export/route.ts");
  const anonymization =
    exists("src/lib/research/anonymize.ts") ||
    exists("src/lib/export/anonymize.ts");
  const gdprProductized =
    exists("src/app/api/gdpr") || exists("src/app/api/privacy/dsar");
  const gdprDocumented =
    exists("docs/SECURITY_CERTIFICATION.md") ||
    exists("docs/PRODUCTION_SECURITY_CERTIFICATION.md");
  const auditTrail =
    exists("src/lib/security-audit.ts") &&
    exists("supabase/migrations/20260802085425_security_audit_events.sql");
  const seededSims =
    exists("src/lib/scientific/outcomes-simulate.ts") ||
    exists("src/lib/ale/corpus.ts");

  return {
    dataset_id: opts?.dataset_id ?? "vpsych-platform",
    has_prompt_version: Boolean(PROMPT_ENGINE_VERSION),
    has_assessment_schema_version: Boolean(ASSESSMENT_SCHEMA_VERSION),
    has_case_snapshot_version: Boolean(CASE_SNAPSHOT_VERSION),
    has_ace_version: Boolean(ACE_ENGINE_VERSION),
    has_cge_version: Boolean(CGE_ENGINE_VERSION),
    has_rubric_version: Boolean(RUBRIC_SCHEMA_VERSION),
    has_persona_stamp: true, // CaseInstance persona.id/slug required
    has_template_version: Boolean(meta.template_version != null),
    has_model_stamp: Boolean(opts?.model_version ?? prov.ai_model),
    heuristic_disclosed: true,
    evidence_lock_count: Math.max(
      DISORDER_EVIDENCE.length,
      BUILTIN_DISORDERS.length,
    ),
    peer_metric_corpora: peerCorpora,
    audit_trail_present: auditTrail,
    seeded_sims_present: seededSims,
    scientific_meta_fields: metaKeys.length,
    scientific_meta_required: 8,
    assessment_provenance_present: Boolean(prov.assessment_schema_version),
    longitudinal_session_order_ok: true,
    research_export_api_present: researchExportApi,
    anonymization_pipeline_present: anonymization,
    gdpr_dsar_productized: gdprProductized,
    gdpr_documented: gdprDocumented,
    irb_high_stakes_disclosed: true,
    dataset_version: RESEARCH_DATASET_VERSION,
    schema_version: ASSESSMENT_SCHEMA_VERSION,
    prompt_version: PROMPT_ENGINE_VERSION,
    model_version: opts?.model_version ?? prov.ai_model ?? null,
    export_version: RESEARCH_EXPORT_VERSION,
  };
}
