/**
 * Enterprise engine orchestrator — Stage 10.
 */

import { buildAnalyticsDashboard } from "@/lib/enterprise/analytics";
import { issueCertificate } from "@/lib/enterprise/certification";
import { buildLongitudinalTrack } from "@/lib/enterprise/longitudinal";
import { buildObservabilitySnapshot } from "@/lib/enterprise/observability";
import { platformRoleToEnterprise } from "@/lib/enterprise/rbac";
import { storeCertificate, storeEnterpriseBundle } from "@/lib/enterprise/store";
import {
  ENTERPRISE_OWNERSHIP_RULE,
  buildEnterpriseVersionLock,
} from "@/lib/enterprise/versions";
import type {
  AnalyticsScope,
  EnterpriseBundle,
  EnterpriseSessionContext,
} from "@/lib/enterprise/types";

export type EnterpriseRunInput = {
  organization_id: string | null;
  user_id: string;
  profile_role: "therapist" | "admin";
  membership_role?: string | null;
  campus_id?: string | null;
  program_id?: string | null;
  session_count?: number;
  overall?: number;
  active_learners?: number;
  analytics_scope?: AnalyticsScope;
  issue_course_certificate?: boolean;
  course_title?: string | null;
  latencies_ms?: number[];
};

export function buildEnterpriseContext(
  input: EnterpriseRunInput,
): EnterpriseSessionContext {
  return {
    organization_id: input.organization_id,
    membership_role: platformRoleToEnterprise(
      input.profile_role,
      input.membership_role,
    ),
    campus_id: input.campus_id ?? null,
    program_id: input.program_id ?? null,
  };
}

export function runEnterpriseEngine(input: EnterpriseRunInput): EnterpriseBundle {
  const context = buildEnterpriseContext(input);
  const orgId = input.organization_id;

  const dashboard =
    orgId != null
      ? buildAnalyticsDashboard({
          organization_id: orgId,
          scope: input.analytics_scope ?? "organization",
          session_count: input.session_count ?? 1,
          active_learners: input.active_learners ?? 1,
          mean_overall: input.overall ?? 0,
          completion_rate: 1,
          history: [
            {
              t: new Date().toISOString(),
              v: input.overall ?? 0,
            },
          ],
        })
      : null;

  const certificates_issued = [];
  if (
    orgId &&
    input.issue_course_certificate &&
    (input.overall ?? 0) >= 70
  ) {
    const cert = issueCertificate({
      organization_id: orgId,
      user_id: input.user_id,
      kind: "course",
      title: input.course_title ?? "Simulation course credit",
      metadata: { formative_overall: input.overall ?? 0 },
    });
    storeCertificate(cert);
    certificates_issued.push(cert);
  }

  const longitudinal =
    orgId != null
      ? buildLongitudinalTrack({
          user_id: input.user_id,
          organization_id: orgId,
          horizon: "months",
          session_count: input.session_count ?? 1,
          overall_ema: input.overall ?? 0,
        })
      : null;

  const observability = buildObservabilitySnapshot({
    latencies_ms: input.latencies_ms ?? [120, 180, 240],
    requests: 3,
    failures: 0,
    active_sessions: 1,
  });

  const bundle: EnterpriseBundle = {
    version_lock: buildEnterpriseVersionLock(),
    context,
    dashboard,
    certificates_issued,
    longitudinal,
    observability,
    ownership: ENTERPRISE_OWNERSHIP_RULE,
  };

  if (orgId) storeEnterpriseBundle(orgId, bundle);
  return bundle;
}

export function buildEnterpriseAdminOverview(opts: {
  organization_id: string;
  bundles?: EnterpriseBundle[];
}) {
  const bundles = opts.bundles ?? [];
  const latest = bundles[bundles.length - 1] ?? null;
  return {
    organization_id: opts.organization_id,
    n_bundles: bundles.length,
    latest,
    ownership: ENTERPRISE_OWNERSHIP_RULE,
    version_lock: buildEnterpriseVersionLock(),
  };
}
