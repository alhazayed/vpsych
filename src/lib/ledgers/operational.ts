/**
 * Layer 1 — Operational Ledger (technical / security / infrastructure).
 */

import { randomUUID } from "crypto";
import {
  OPERATIONAL_LEDGER_VERSION,
  deploymentContext,
  newEventId,
  sealContent,
} from "@/lib/ledgers/shared";

export type OperationalCategory =
  | "auth"
  | "authorization"
  | "deployment"
  | "infrastructure"
  | "security"
  | "api"
  | "runtime"
  | "ai"
  | "voice"
  | "database"
  | "jobs"
  | "admin"
  | "feature_flag"
  | "other";

export type OperationalSeverity =
  | "debug"
  | "info"
  | "warning"
  | "error"
  | "critical";

export type OperationalOutcome =
  | "success"
  | "failure"
  | "denied"
  | "partial";

export type OperationalEvent = {
  id: string;
  event_id: string;
  correlation_id: string | null;
  event_type: string;
  category: OperationalCategory;
  severity: OperationalSeverity;
  actor_id: string | null;
  actor_role: string | null;
  ip: string | null;
  user_agent: string | null;
  request_id: string | null;
  deployment_id: string | null;
  git_commit_sha: string | null;
  environment: string | null;
  resource_type: string | null;
  resource_id: string | null;
  outcome: OperationalOutcome;
  latency_ms: number | null;
  error_classification: string | null;
  previous_value: unknown;
  new_value: unknown;
  payload: Record<string, unknown>;
  content_hash: string;
  schema_version: string;
  created_at: string;
};

export type OperationalEventInput = {
  event_type: string;
  category?: OperationalCategory;
  severity?: OperationalSeverity;
  correlation_id?: string | null;
  actor_id?: string | null;
  actor_role?: string | null;
  ip?: string | null;
  user_agent?: string | null;
  request_id?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  outcome?: OperationalOutcome;
  latency_ms?: number | null;
  error_classification?: string | null;
  previous_value?: unknown;
  new_value?: unknown;
  payload?: Record<string, unknown>;
};

export function buildOperationalEvent(
  input: OperationalEventInput,
): OperationalEvent {
  const ctx = deploymentContext();
  const id = randomUUID();
  const event_id = newEventId("op");
  const created_at = new Date().toISOString();
  const core = {
    event_type: input.event_type,
    category: input.category ?? "other",
    outcome: input.outcome ?? "success",
    resource_type: input.resource_type ?? null,
    resource_id: input.resource_id ?? null,
    actor_id: input.actor_id ?? null,
    correlation_id: input.correlation_id ?? null,
  };
  return {
    id,
    event_id,
    correlation_id: input.correlation_id ?? null,
    event_type: input.event_type,
    category: input.category ?? "other",
    severity: input.severity ?? "info",
    actor_id: input.actor_id ?? null,
    actor_role: input.actor_role ?? null,
    ip: input.ip ?? null,
    user_agent: input.user_agent ?? null,
    request_id: input.request_id ?? null,
    deployment_id: ctx.deployment_id,
    git_commit_sha: ctx.git_commit_sha,
    environment: ctx.environment,
    resource_type: input.resource_type ?? null,
    resource_id: input.resource_id ?? null,
    outcome: input.outcome ?? "success",
    latency_ms: input.latency_ms ?? null,
    error_classification: input.error_classification ?? null,
    previous_value: input.previous_value ?? null,
    new_value: input.new_value ?? null,
    payload: input.payload ?? {},
    content_hash: sealContent(core),
    schema_version: OPERATIONAL_LEDGER_VERSION,
    created_at,
  };
}

export function operationalEventToRpc(
  e: OperationalEvent,
): Record<string, unknown> {
  return { ...e };
}
