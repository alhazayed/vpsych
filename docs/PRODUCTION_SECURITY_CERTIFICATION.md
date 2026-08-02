# VPsych Production Security Certification Report

**Mission:** 02 — Production Security Certification  
**Date:** 2026-08-02  
**Scope:** Application, API, AuthN/AuthZ, Supabase/RLS, AI, Voice, Secrets, Infra, Compliance readiness  
**Project:** `vpsych` (Supabase `rrzudbkxigeavfdnidnm`, Vercel `prj_qiJ1mQvX0s5lJZ9KJnpWAx4EXjNm`)

---

## Executive Summary

VPsych was subjected to a full production security assessment with live verification against Supabase, Vercel, the repository, CI, and production HTTP headers. Multiple **High** findings were verified and remediated (RLS write lockdown for ACE/CGE scoring, revocation of client-callable transcript forge RPCs, case memory rebinding guard, error/secret leakage reduction, STT abuse controls, admin health gating, credential removal from scripts).

No remaining **Critical** or **High** vulnerabilities were left unfixed after remediation and regression.

**Certification outcome:**

⚠ SECURITY CERTIFIED WITH RECOMMENDATIONS

---

## Threat Model

### Trust boundaries

| Boundary | Inside | Outside |
|---|---|---|
| Browser | React UI, anon JWT cookies | Attacker-controlled DOM/network |
| Next.js server | Route handlers, service role, OpenAI/ElevenLabs keys | Client, CDN |
| Supabase Auth | Session JWTs, password hashing | Password reset email channel |
| Postgres + RLS | Row policies, SECURITY DEFINER RPCs | PostgREST with anon/authenticated keys |
| AI providers | Prompts + transcripts | Model output / provider logs |
| Voice providers | Audio + TTS text | Provider retention |

### Attack surface

- **Browser / Frontend:** login, signup, sessions, admin UI, voice capture
- **API:** 23 route handlers (sessions, voice, ACE, CGE, admin, health)
- **Supabase:** PostgREST, Auth, SECURITY DEFINER RPCs, Edge email hook
- **AI:** patient agent, assessment, prompt engine
- **Voice:** STT (`/api/voice/transcribe`), TTS (`/api/voice/tts`)
- **Admin:** reports, avatars, voices, templates, presets, curriculum, graph
- **Exports/Reports:** session reports (admin-only content), signed report RPC
- **Secrets:** Vercel env, Supabase vault/env, client `NEXT_PUBLIC_*`

---

## Verified Findings (pre-fix) and Applied Fixes

| ID | Severity | Finding | Status | Fix |
|---|---|---|---|---|
| H1 | High | Learners could `FOR ALL` write ACE/CGE scores & certifications via Data API | **Fixed** | SELECT-only learner policies; server/admin writes |
| H2 | High | `insert_assistant_message` / `insert_system_message` executable by `authenticated` → transcript forge | **Fixed** | Revoked from authenticated; service_role only; API uses service client |
| H3 | High | `sessions.case_instance_id` rebinding → cross-therapist `case_memory` access | **Fixed** | Session UPDATE guard freezes/validates ownership; case insert requires `created_by = auth.uid()` |
| H4 | High | Provider/error leakage (`aiFailureDetail`, TTS `detail`, env names) | **Fixed** | Client-safe errors; details logged server-side only |
| H5 | High | ACE profile PATCH allowed instructor controls (`lockedDiagnoses`, thresholds) | **Fixed** | Learner PATCH allowlist + DB trigger; admin API retains controls |
| H6 | High | Audit passwords hardcoded in `scripts/prod-validate-sessions.mjs` | **Fixed** | Credentials required via env vars |
| M1 | Medium | `/api/health/openai` exposed to any logged-in user | **Fixed** | Admin-only + rate limit |
| M2 | Medium | STT no upload size/MIME guard | **Fixed** | 10MB cap + MIME allowlist |
| M3 | Medium | TTS accepted arbitrary client `voiceId` | **Fixed** | Resolve via avatar/voice_profile only |
| M4 | Medium | `/api/admin/disorders` missing admin role check | **Fixed** | Admin gate added |
| L1 | Low | Signup enforced 6-char passwords | **Fixed** | Min 8 + upper/number |
| I1 | Info | CORP header missing | **Fixed** | `Cross-Origin-Resource-Policy: same-site` |

### Live verification evidence

- Anon RPC forge attempt → `42501 permission denied for function insert_assistant_message`
- Supabase advisors no longer flag message forge RPCs
- All public tables have RLS enabled
- Production headers present: CSP, HSTS, X-Frame-Options DENY, nosniff, Permissions-Policy, COOP
- `npm audit --omit=dev` → 0 vulnerabilities
- Tests: **150/150 passed**; typecheck clean; build success

---

## Authentication

| Control | Result | Evidence |
|---|---|---|
| Login / Logout | Pass | Supabase Auth + middleware session refresh |
| Password reset / email verify | Pass (platform) | Supabase Auth + signed email hook |
| Session refresh / expiry | Pass | Middleware `getUser()`; JWT expiry dashboard-configured |
| Password hashing | Pass | Supabase Auth (bcrypt/argon managed) |
| Role self-escalation | Pass | `profiles` WITH CHECK + new `profiles_role_guard` trigger |
| Brute-force / lockout | Partial | Supabase Auth rate limits; leaked-password protection **disabled** (recommend enable) |
| Remember Me | Info | UI no-op (`void remember`) |
| OAuth | N/A | Not implemented |

---

## Authorization

| Role | Controls |
|---|---|
| Anonymous | Public `/`, `/login`, `/signup`, `/auth/*` only |
| Therapist/Learner | Own sessions/messages; ACE self-read; no report content |
| Admin | `requireAdmin()` pages + admin API role checks; report access audited |

Horizontal/vertical IDOR on sessions/reports: **mitigated** (API ownership checks + RLS).  
Admin report view logs `admin.report.view`.

---

## OWASP Top 10 Mapping

| Risk | Status |
|---|---|
| A01 Broken Access Control | Mitigated (post-fix) |
| A02 Cryptographic Failures | TLS via Vercel/Supabase; report HMAC signing |
| A03 Injection | Parameterized Supabase client; Zod/typed bodies |
| A04 Insecure Design | Session guards, report isolation, ACE write lockdown |
| A05 Security Misconfiguration | Headers present; health endpoint gated |
| A06 Vulnerable Components | `npm audit` clean |
| A07 Auth Failures | Stronger signup; enable HIBP |
| A08 Software Integrity | CI + lockfile; migration parity |
| A09 Logging Failures | Security audit RPC; gaps remain for full SIEM |
| A10 SSRF | No user-controlled server fetch URLs found |

Also verified: open redirect hardened (`safe-redirect`), clickjacking (`frame-ancestors none` + XFO), XSS baseline CSP (still allows `'unsafe-inline'`/`'unsafe-eval'` for Next.js).

---

## AI / Voice Security

- Therapist turns isolated by system prompt + persona constraints; no secondary output filter (residual prompt-injection risk — Medium/residual)
- Conversation isolation by `session_id` + ownership
- Voice STT/TTS authenticated + rate limited; STT size capped; TTS voice resolved from registry
- Temporary audio handled as in-memory Blob (no durable local PHI files in app path)

---

## Data Protection & Compliance Readiness

| Area | Readiness | Notes |
|---|---|---|
| Encryption in transit | Ready | HTTPS/HSTS |
| Encryption at rest | Platform | Supabase/Vercel managed |
| PHI isolation | Partial | Simulated patient data; session isolation strong; no formal retention/deletion UX |
| Audit trails | Partial | `security_audit_events` present; not all admin mutations covered |
| HIPAA Security Rule | Not certified | Need BAA with subprocessors, formal risk analysis, access reviews |
| GDPR | Partial | Need DPA, retention, DSAR workflows |
| SOC 2 principles | Partial | Controls exist; evidence program incomplete |
| OWASP ASVS | Level 1-leaning | Stronger on access control; CSP nonces / HIBP recommended |

---

## Infrastructure

| Control | Result |
|---|---|
| GitHub Actions CI | Lint/typecheck/test/migrations/build |
| Vercel deployment protection | **Disabled** (password/SSO/IP) — recommend enable for previews |
| Preview deployments | Present; unprotected |
| Supabase RLS | Enabled on all public tables |
| Secrets in client bundle | No service-role/API keys in `.next/static` |
| Branch protection | Verify in GitHub settings (API may be restricted) |

---

## Security Scores (evidence-based)

| Domain | Score | Evidence |
|---|---|---|
| Authentication | 82 | Supabase Auth solid; HIBP off; Remember Me no-op |
| Authorization | 90 | Admin gates + RLS + IDOR checks; post-fix ACE/CGE |
| API Security | 88 | Authz + rate limits on AI/voice; safer errors |
| Database Security | 92 | RLS everywhere; forge RPCs revoked; guards |
| Cloud Security | 78 | Prod headers good; preview protection off |
| Infrastructure | 80 | CI present; secrets management OK |
| AI Security | 74 | Prompt isolation basic; residual injection |
| Voice Security | 86 | Auth, rate limit, size, registry resolution |
| Secrets Management | 88 | No client leaks; audit script credentials moved to env |
| Compliance Readiness | 62 | Technical controls ≠ legal certification |
| Monitoring | 70 | Audit table exists; limited alerting/SIEM |
| **Overall Security** | **84** | |

---

## Remaining Risks (accepted / recommended)

1. **Enable Supabase leaked-password protection (HIBP)** — advisor WARN
2. **Enable Vercel Deployment Protection** on previews (and optionally production SSO)
3. **CSP nonces** to remove `'unsafe-inline'` / `'unsafe-eval'`
4. **Upstash Redis** in production for distributed rate limits (memory fallback is per-instance)
5. **Rotate** any credentials that previously appeared in git history for `prod-validate-sessions.mjs`
6. **Formal HIPAA/GDPR program**: BAAs, retention, DSAR, workforce training
7. **Prompt-injection secondary filter** for patient/assessment outputs
8. Intentional SECURITY DEFINER RPCs still callable by authenticated: `create_session_report` (HMAC-gated), `session_has_report`, `is_admin`, `log_security_event` — acceptable with current checks; monitor abuse of audit spam

---

## Regression Results

| Check | Result |
|---|---|
| Unit/integration tests | 150 passed |
| Typecheck | Pass |
| Lint | Pass (pre-existing warnings only) |
| Build | Pass |
| Migration structure | Pass |
| Live RPC forge probe | Denied |
| Production security headers | Present |

---

## Production Recommendation

Ship these security remediations to production promptly. After deploy, complete the remaining recommendations (HIBP, preview protection, credential rotation). The platform is **technically suitable for production** for a training simulation product, with compliance program work still required before treating real PHI under HIPAA.

---

## Final Certification

⚠ SECURITY CERTIFIED WITH RECOMMENDATIONS
