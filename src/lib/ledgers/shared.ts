/**
 * Shared Multi-Ledger infrastructure — IDs, correlation, integrity.
 */

import { createHash, randomUUID } from "crypto";

export const MULTI_LEDGER_VERSION = "1.0.0";
export const OPERATIONAL_LEDGER_VERSION = "1.0.0";
export const EDUCATIONAL_LEDGER_VERSION = "1.0.0";
export const SCIENTIFIC_LEDGER_VERSION = "1.0.0";

export type LedgerLayer = "operational" | "education" | "quality";

export function newEventId(prefix: "op" | "edu" | "corr"): string {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

export function newCorrelationId(): string {
  return newEventId("corr");
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

export function sealContent(value: unknown): string {
  return sha256Hex(stableStringify(value));
}

export type CrossLedgerRefs = {
  assessment_id?: string | null;
  session_id?: string | null;
  learner_id?: string | null;
  instructor_id?: string | null;
  institution_id?: string | null;
  program_id?: string | null;
  clinical_template_id?: string | null;
  persona_id?: string | null;
  release_id?: string | null;
  deployment_id?: string | null;
  ai_model_id?: string | null;
  prompt_version_id?: string | null;
  operational_event_id?: string | null;
  educational_event_id?: string | null;
  scientific_ledger_id?: string | null;
};

export type LedgerCorrelation = CrossLedgerRefs & {
  id: string;
  correlation_id: string;
  created_at: string;
  metadata: Record<string, unknown>;
};

export function buildCorrelation(
  refs: CrossLedgerRefs,
  correlationId?: string,
): LedgerCorrelation {
  return {
    id: randomUUID(),
    correlation_id: correlationId ?? newCorrelationId(),
    assessment_id: refs.assessment_id ?? null,
    session_id: refs.session_id ?? null,
    learner_id: refs.learner_id ?? null,
    instructor_id: refs.instructor_id ?? null,
    institution_id: refs.institution_id ?? null,
    program_id: refs.program_id ?? null,
    clinical_template_id: refs.clinical_template_id ?? null,
    persona_id: refs.persona_id ?? null,
    release_id: refs.release_id ?? null,
    deployment_id:
      refs.deployment_id ?? process.env.VERCEL_DEPLOYMENT_ID ?? null,
    ai_model_id: refs.ai_model_id ?? null,
    prompt_version_id: refs.prompt_version_id ?? null,
    operational_event_id: refs.operational_event_id ?? null,
    educational_event_id: refs.educational_event_id ?? null,
    scientific_ledger_id: refs.scientific_ledger_id ?? null,
    created_at: new Date().toISOString(),
    metadata: {},
  };
}

export function deploymentContext(): {
  deployment_id: string | null;
  git_commit_sha: string | null;
  environment: string | null;
} {
  return {
    deployment_id: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    git_commit_sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    environment:
      process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null,
  };
}
