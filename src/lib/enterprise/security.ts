/**
 * Enterprise security — Stage 10.
 * Tenant isolation audits · SSO/SAML/OAuth/MFA abstractions · session policy.
 * Complements existing security-audit + profiles.role — does not replace them.
 */

import { createHash, randomBytes } from "node:crypto";
import { assertTenantAccess } from "@/lib/enterprise/tenant";
import { hasPermission } from "@/lib/enterprise/rbac";
import type {
  EnterpriseAuditEvent,
  EnterpriseRole,
  Permission,
} from "@/lib/enterprise/types";

export type SsoProviderKind = "saml" | "oidc" | "oauth2" | "none";

export type EnterpriseAuthPolicy = {
  organization_id: string;
  sso_provider: SsoProviderKind;
  mfa_required: boolean;
  session_max_hours: number;
  allow_password_fallback: boolean;
};

export function defaultAuthPolicy(organizationId: string): EnterpriseAuthPolicy {
  return {
    organization_id: organizationId,
    sso_provider: "none",
    mfa_required: false,
    session_max_hours: 12,
    allow_password_fallback: true,
  };
}

export function enableSso(
  policy: EnterpriseAuthPolicy,
  provider: Exclude<SsoProviderKind, "none">,
): EnterpriseAuthPolicy {
  return {
    ...policy,
    sso_provider: provider,
    mfa_required: true,
    allow_password_fallback: false,
  };
}

export function sessionStillValid(opts: {
  issued_at: string;
  policy: EnterpriseAuthPolicy;
  now?: Date;
}): boolean {
  const now = opts.now ?? new Date();
  const issued = new Date(opts.issued_at).getTime();
  const maxMs = opts.policy.session_max_hours * 60 * 60 * 1000;
  return now.getTime() - issued <= maxMs;
}

export function recordAudit(input: {
  organization_id: string | null;
  actor_user_id: string | null;
  action: string;
  outcome: EnterpriseAuditEvent["outcome"];
  resource_type: string;
  resource_id?: string | null;
  metadata?: Record<string, unknown>;
}): EnterpriseAuditEvent {
  return {
    id: `audit_${randomBytes(8).toString("hex")}`,
    organization_id: input.organization_id,
    actor_user_id: input.actor_user_id,
    action: input.action,
    outcome: input.outcome,
    resource_type: input.resource_type,
    resource_id: input.resource_id ?? null,
    at: new Date().toISOString(),
    metadata: input.metadata ?? {},
  };
}

export function authorizeTenantAction(opts: {
  actorRole: EnterpriseRole;
  actorOrganizationId: string | null;
  resourceOrganizationId: string | null;
  permission: Permission;
  actorUserId?: string | null;
}): { allowed: boolean; audit: EnterpriseAuditEvent } {
  const check = assertTenantAccess({
    actorRole: opts.actorRole,
    actorOrganizationId: opts.actorOrganizationId,
    resourceOrganizationId: opts.resourceOrganizationId,
    permission: opts.permission,
  });
  const allowed = check.ok && hasPermission(opts.actorRole, opts.permission);
  const audit = recordAudit({
    organization_id: opts.actorOrganizationId,
    actor_user_id: opts.actorUserId ?? null,
    action: opts.permission,
    outcome: allowed ? "allowed" : "denied",
    resource_type: "tenant_resource",
    resource_id: opts.resourceOrganizationId,
    metadata: { violations: check.violations },
  });
  return { allowed, audit };
}

/** Secret reference helper — never stores raw secrets in rows. */
export function secretRef(name: string, organizationId: string): string {
  const digest = createHash("sha256")
    .update(`${organizationId}:${name}`)
    .digest("hex")
    .slice(0, 16);
  return `vault:org/${organizationId}/${name}#${digest}`;
}

export type SecurityDashboard = {
  organization_id: string;
  sso_enabled: boolean;
  mfa_required: boolean;
  recent_denies: number;
  recent_allows: number;
  isolation_ok: boolean;
};

export function buildSecurityDashboard(opts: {
  organization_id: string;
  policy: EnterpriseAuthPolicy;
  audits: EnterpriseAuditEvent[];
  isolation_ok: boolean;
}): SecurityDashboard {
  const recent = opts.audits.filter(
    (a) => a.organization_id === opts.organization_id,
  );
  return {
    organization_id: opts.organization_id,
    sso_enabled: opts.policy.sso_provider !== "none",
    mfa_required: opts.policy.mfa_required,
    recent_denies: recent.filter((a) => a.outcome === "denied").length,
    recent_allows: recent.filter((a) => a.outcome === "allowed").length,
    isolation_ok: opts.isolation_ok,
  };
}
