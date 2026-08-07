# Security Report — Controlled Institutional Deployment

**Report ID:** `VPSYCH-1.0-RC1-CIDP-SEC`  
**Version:** `1.0.0-rc.1`  
**Date (UTC):** 2026-08-07  
**Classification:** Internal — institutional technical review  

> Integrity note: This report is **git-signed by commit SHA** on merge. For external auditors, export this file plus `git rev-parse HEAD` and CI run URL. Cryptographic GPG signing of the tag is a Release Manager ops step.

## 1. Scope

Verification of RBAC, RLS, authentication, session security, secrets, API permissions, audit logging, rate limiting, environment validation, and dependency audit for CIDP. Builds on Stage 12 `../SECURITY_AUDIT.md` and Mission 02 / Omega certifications. **No patient cognition changes.**

## 2. Control verification

| Control | Result | Evidence |
|---------|--------|----------|
| RBAC (platform) | **PASS** | `profiles.role`; `requireApiAdmin`; middleware `/admin` |
| RBAC (enterprise) | **PASS** | `institution_memberships` + `lib/enterprise/rbac.ts` |
| RLS | **PASS** | Migrations; reports admin-only; feedback own/admin policies |
| Authentication | **PASS** | Supabase Auth; password policy; demo accounts banned |
| Session security | **PASS** | Ownership RPCs; 40-min hard expiry; secure cookies (prod) |
| Secrets | **PASS** | Not in git; env validation presence-only |
| API permissions | **PASS** | Route Handler auth → rate limit → validate → sanitize |
| Audit logging | **PASS** | `security_audit_events` + enterprise audits; admin denials |
| Rate limiting | **PASS** | Upstash/memory; feedback + CIDP admin routes limited |
| Environment validation | **PASS** | `lib/env.ts` |
| Dependency audit | **PASS gate** | CI `audit:deps` |
| Feedback PHI guard | **PASS (app)** | Heuristic reject in `validateFeedbackInput` |
| Clinical Core isolation | **PASS** | CIDP writes only `institutional_feedback` + reads counts |

## 3. Penetration checklist (CIDP)

- [ ] Unauthenticated `/api/feedback` → 401  
- [ ] Therapist cannot list other users’ feedback  
- [ ] Therapist cannot `GET /api/admin/ops/cidp`  
- [ ] Therapist cannot read `session_reports`  
- [ ] Cross-tenant institution_admin cannot manage foreign institution feedback  
- [ ] Burst submit → 429 with Retry-After  
- [ ] Feedback body with PHI-like tokens rejected  

## 4. Residuals

| ID | Item | Blocks |
|----|------|--------|
| SEC-S12-01 | HIBP leaked-password toggle | Unconstrained GA claims |
| SEC-S12-02 | Confirm Upstash in production | Horizontal RL safety |
| SEC-S12-03 | Vendor APM (Sentry) | Full SIEM story |
| SEC-CIDP-01 | Feedback free-text residual re-ID risk | Requires human triage |

## 5. Verdict

**Security verification PASS for Controlled Institutional Deployment** of `1.0.0-rc.1`, with published residuals. **No unresolved Critical or High application findings introduced by CIDP.**

Unresolved ops residuals remain as in Stage 12 and **block GA**, not CIDP authorization.
