# Security Audit — VPsych Version 1.0 RC1 (Stage 12)

**Date:** 2026-08-07 · **Cert:** `VPSYCH-1.0-RC1-STAGE12`  
**Prior deep audits:** `PRODUCTION_SECURITY_CERTIFICATION.md`, `SECURITY_CERTIFICATION.md`, Stage 10 `SECURITY_MODEL.md` / `stage10/SECURITY_REPORT.md`

## Scope

Production security certification for institutional deployment. No new patient cognition. OWASP-aligned review against the live architecture on Stages 1–11 + Stage 12 hardening.

## Control results

| Control | Result | Evidence |
|---------|--------|----------|
| Secrets not in git | **PASS** | `.env.production` public keys only; `.env.example` annotated |
| Environment validation | **PASS** | `src/lib/env.ts` presence checks (no secret echo) |
| JWT / session lifetime | **PASS (ops)** | Supabase Auth JWT expiry dashboard (default 3600s); rotate via Auth settings |
| API hardening | **PASS** | Auth → rate limit → validate → work → `clientSafeError` |
| Rate limiting | **PASS** | Upstash + memory fallback; Stage 12 closed scientific admin gaps (ARCH-S2-05) |
| RBAC | **PASS** | `profiles.role`; `requireApiAdmin` + middleware `/admin` gate; Stage 10 enterprise RBAC |
| Tenant isolation | **PASS (schema + engine)** | `assertTenantAccess` / RLS; memberships product UX still deepening (ENT debt) |
| Permission audit | **PASS** | `security_audit_events` + `enterprise_audit_events` |
| Session security | **PASS** | Ownership RPCs; hard expire `MAX_SESSION_SECONDS`; Secure locale cookie in prod |
| Report write path | **PASS** | HMAC `create_session_report` or service role; therapist cannot read reports |
| Encryption | **PASS (platform)** | TLS at Vercel/Supabase; DB encryption at rest (Supabase); no app-level PHI encryption fork |
| Dependency audit | **PASS gate** | CI `npm run audit:deps` (`npm audit --omit=dev --audit-level=high`) |
| Security headers | **PASS** | `lib/security-headers.ts` CSP/HSTS/COOP/CORP |
| Safe redirects / passwords | **PASS** | `safe-redirect.ts`, `password-policy.ts` |
| Demo accounts | **PASS** | `*.vpsych.test` banned |
| ElevenLabs hung-fetch DoS | **PASS** | AbortSignal timeout (RT-03) |
| Correlation / forensics | **PASS** | `X-Request-Id` on voice pipeline |

## OWASP Top 10 (application mapping)

| Risk | Status |
|------|--------|
| A01 Broken Access Control | Mitigated — RLS + role checks + admin audit |
| A02 Cryptographic Failures | Platform TLS/at-rest; no secrets in client bundles |
| A03 Injection | Parameterized Supabase queries; prompt injection residual clinical risk documented |
| A04 Insecure Design | Ownership invariants + architecture tests |
| A05 Security Misconfiguration | Env validation + headers; HIBP residual ops |
| A06 Vulnerable Components | CI audit gate |
| A07 Auth Failures | Supabase Auth + password policy; leaked-password toggle residual |
| A08 Software/Data Integrity | Signed report RPC; migration parity |
| A09 Logging Failures | Security audit RPC; APM vendor still recommended |
| A10 SSRF | No user-controlled fetch URLs in core routes |

## Penetration checklist (pre-GA)

- [ ] Unauthenticated `/api/*` → JSON 401 (not HTML)  
- [ ] Therapist cannot `SELECT` `session_reports`  
- [ ] Cross-user session message denied  
- [ ] Admin scientific routes 429 under burst  
- [ ] Public cert verify does not leak other tenants  
- [ ] TTS/STT without auth → 401  
- [ ] CSP does not allow unexpected `connect-src` hosts  
- [ ] Service role never shipped to browser  

## Residuals (do not block RC; block unconstrained public GA claims)

| ID | Item | Owner |
|----|------|-------|
| SEC-S12-01 | Enable Supabase leaked-password protection | Ops |
| SEC-S12-02 | Confirm Upstash in production | Ops |
| SEC-S12-03 | Wire Sentry (or equivalent) DSN | Ops |
| SEC-S12-04 | Rotate JWT signing keys per Supabase schedule | Ops |
| SEC-S12-05 | Enterprise SSO live IdP (ENT-02) | v1.1 |

## Verdict

**Security Complete for Version 1.0 Release Candidate** — with published ops residuals. Prior Mission 02 / Omega security findings remain the historical remediation trail.
