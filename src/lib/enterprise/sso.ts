/**
 * SSO readiness — configuration contract for institutional IdP integration.
 * Implementation uses Supabase Auth SSO when enabled per institution.
 */

export type SsoProviderKind = "oidc" | "saml" | "none";

export type InstitutionSsoConfig = {
  enabled: boolean;
  provider: SsoProviderKind;
  issuer?: string;
  client_id?: string;
  domains?: string[];
  enforce_sso_for_members?: boolean;
  jit_provisioning?: boolean;
  default_membership_role?: string;
};

export type SsoReadiness = {
  score: number;
  ready: boolean;
  checklist: Array<{ id: string; pass: boolean; note: string }>;
};

export function evaluateSsoReadiness(
  config: InstitutionSsoConfig | null | undefined,
  env: {
    supabaseUrlConfigured: boolean;
    authExternalProvidersDocumented: boolean;
  },
): SsoReadiness {
  const cfg = config ?? { enabled: false, provider: "none" as const };
  const checklist = [
    {
      id: "supabase_auth",
      pass: env.supabaseUrlConfigured,
      note: "Supabase Auth project available for SSO federation",
    },
    {
      id: "provider_contract",
      pass: env.authExternalProvidersDocumented,
      note: "OIDC/SAML provider contract documented in enterprise module",
    },
    {
      id: "per_institution_flag",
      pass: typeof cfg.enabled === "boolean",
      note: "institutions.sso_enabled + sso_metadata columns exist",
    },
    {
      id: "issuer_when_enabled",
      pass: !cfg.enabled || Boolean(cfg.issuer && cfg.client_id),
      note: "When SSO enabled, issuer and client_id required",
    },
    {
      id: "domain_allowlist",
      pass: !cfg.enabled || (cfg.domains?.length ?? 0) > 0,
      note: "Email domain allowlist recommended for JIT provisioning",
    },
  ];
  const passed = checklist.filter((c) => c.pass).length;
  const score = Math.round((passed / checklist.length) * 100);
  return {
    score,
    ready: score >= 80 && (!cfg.enabled || Boolean(cfg.issuer)),
    checklist,
  };
}

/** Default documented SSO contract for enterprise onboarding. */
export const SSO_INTEGRATION_CONTRACT = {
  supported: ["oidc", "saml"] as const,
  platform: "Supabase Auth (external providers / SSO)",
  jit_provisioning: true,
  role_mapping: "Map IdP groups → enterprise_membership_role",
  tenant_claim: "Custom claim or domain → institutions.id",
  notes: [
    "Platform Super Administrator remains profiles.role=admin",
    "Institution Admin is membership role institution_admin",
    "Password auth remains available unless enforce_sso_for_members",
  ],
};
