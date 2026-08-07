# Security Model — Stage 10

**Code:** `src/lib/enterprise/security.ts`  
**Complements:** `lib/security-audit.ts`, `lib/api-auth.ts`, Mission 20 hardening

## Controls

| Control | Mechanism |
|---------|-----------|
| Tenant isolation | `assertTenantAccess` + RLS on `enterprise_*` |
| Encryption | Platform TLS + Supabase at-rest; secrets via `secretRef` (vault pointer, not raw) |
| Audit | `enterprise_audit_events` + existing `security_audit_events` |
| SSO | `institutions.sso_*` + `enableSso(policy, saml\|oidc\|oauth2)` |
| SAML / OAuth | Integration descriptors `ready` |
| MFA | Required when SSO enabled in enterprise policy |
| Session management | `session_max_hours` on `EnterpriseAuthPolicy` |
| Security dashboard | SSO / MFA / deny counts / isolation flag |

## Forbidden

- Returning raw provider/DB errors (use `clientSafeError`)  
- Exposing `session_reports` on therapist enterprise summary  
- Cross-tenant reads for non-global roles
