# VPsych Production Security Certification Report
## Mission 02 — Production Security Certification

**Date:** 2026-08-02  
**Scope:** Application, API, Supabase, AuthZ/AuthN, AI, Voice, secrets, headers, dependencies, CI/CD readiness  
**Branch:** `cursor/security-certification-8acf`  
**Includes:** Mission 01 architecture hardening (cherry-picked) + Mission 02 security fixes

---

## Executive summary

VPsych handles simulated mental-health training data (session transcripts, assessments, competency scores). Controls were verified against OWASP Top 10 / ASVS-oriented checks, Supabase advisors, dependency audit, and controlled API abuse review.

**Verified Critical/High defects were fixed, regression-tested, and retested.**

Remaining items are **Medium** or **operational** (dashboard configuration) and do not block a conditional production certification.

**Overall Security Score: 86 / 100**

---

## Threat model (attack surfaces)

| Surface | Trust boundary | Primary risks |
|---------|----------------|---------------|
| Browser / App Router | Internet → Vercel Edge | XSS, session theft, open redirect |
| API Route Handlers | Authenticated users / admins | IDOR, abuse, error leakage |
| Supabase Auth + RLS | Anon/authenticated JWTs | Privilege escalation, RPC abuse |
| Service role | Server-only | Full DB compromise if leaked |
| OpenAI / AI Gateway | Server egress | Prompt injection, cost abuse |
| ElevenLabs TTS | Server egress | Unauthorized synthesis / cost abuse |
| Admin dashboard | Admin role | Vertical escalation |
| Reports | Admin-only read | PHI/training-data exposure |
| Voice STT upload | Authenticated multipart | Oversized/malicious uploads |
| Preview deployments | Vercel | Weaker secrets if misconfigured |

Trust model: **browser is untrusted**; **therapist JWT is semi-trusted** (own sessions only); **admin JWT is privileged**; **service role is break-glass**.

---

## Attack surface / API auth matrix (verified)

| Route class | Auth | Notes |
|-------------|------|-------|
| `/api/sessions*` | Owner user | Rate limited |
| `/api/voice/*` | User | Rate limited; STT size/MIME capped |
| `/api/ace/*`, `/api/cge/*` | User | Rate limited; admin `userId` gated |
| `/api/admin/*` | Admin (middleware + `requireApiAdmin`) | Preview routes rate limited |
| `/api/health/openai` | **Admin only** | Sanitized probe response |
| `/auth/callback` | Anon (code exchange) | Safe redirect |

---

## Verified findings & fixes

| ID | Severity | Finding | Fix |
|----|----------|---------|-----|
| S-C1 | Critical | `/api/health/openai` callable by any logged-in user; leaked provider errors | Admin gate + sanitized response |
| S-H1 | High | Admin APIs / UI lacked edge enforcement | Middleware `/admin` + `/api/admin` role gate; shared `requireApiAdmin` |
| S-H2 | High | Signup enforced only `length >= 6` despite UI policy | Shared `password-policy` (8+ upper+number+special) enforced on submit |
| S-H3 | High | STT upload unbounded size/type | 10 MiB cap + audio MIME allowlist |
| S-H4 | High | Provider/DB/`aiFailureDetail` leaked to clients | Sanitized errors; removed `aiFailureDetail` from session-end JSON |
| S-H5 | High | ACE/CGE/admin preview routes unthrottled | Per-user hourly rate limits |
| S-H6 | High | Assessment examiner prompt lacked injection guardrails | Untrusted-transcript integrity rules (EN/AR) |
| S-M1 | Medium | CSP allows `unsafe-inline`/`unsafe-eval` | Documented Next.js constraint; tracked |
| S-M2 | Medium | Supabase Auth leaked-password protection disabled | Ops recommendation (dashboard) |
| S-M3 | Medium | SECURITY DEFINER RPCs executable by `authenticated` | Intentional with ownership/HMAC checks |
| S-M4 | Medium | Service-role report path | Prefer `REPORT_WRITE_KEY`; documented |

---

## OWASP Top 10 mapping

| Category | Status |
|----------|--------|
| A01 Broken Access Control | Mitigated — ownership checks, RLS, admin edge gate |
| A02 Cryptographic Failures | TLS via Vercel/Supabase; HMAC report signing |
| A03 Injection | Parameterized Supabase client; prompt isolation improved |
| A04 Insecure Design | Report insert-once + role in `profiles` not metadata |
| A05 Security Misconfiguration | Headers present; health locked; Cache-Control on `/api` |
| A06 Vulnerable Components | `npm audit` → **0** vulnerabilities |
| A07 Auth Failures | Password policy hardened; leaked-password ops gap |
| A08 Software Integrity | CI verify; migrations parity tests |
| A09 Logging Failures | Security audit RPC; sensitive provider errors logged server-side |
| A10 SSRF | No user-controlled fetch URLs found |

Also verified: open-redirect helper, no `dangerouslySetInnerHTML`, clickjacking denied (`frame-ancestors`/`X-Frame-Options`).

---

## HIPAA / GDPR readiness notes (not legal certification)

| Control theme | Readiness |
|---------------|-----------|
| Access control | Strong for single-tenant training app |
| Audit controls | `security_audit_events` + admin deny logging |
| Transmission security | HTTPS + HSTS |
| Encryption at rest | Supabase-managed (verify in project settings) |
| Minimum necessary | Therapists cannot SELECT reports (RLS) |
| Retention / deletion | Needs formal policy + job (gap) |
| DPIA / BAA | Organizational — not in repo |
| Data subject export/erase | Not fully productized |

---

## Regression results

| Check | Result |
|-------|--------|
| `npm run lint` | 0 errors |
| `npm run typecheck` | Pass |
| `npm test` | All passing (includes password/STT/safe-error/architecture tests) |
| `npm run build` | Pass |
| `npm audit` | 0 vulnerabilities |

---

## Security scoring (evidence-based)

| Dimension | Score | Evidence |
|-----------|------:|----------|
| Authentication | 84 | Policy enforced; HIBP still ops |
| Authorization | 90 | Owner + admin + middleware |
| API Security | 88 | Rate limits, sanitized errors, Cache-Control |
| Database Security | 88 | RLS everywhere; signed report RPC |
| Cloud Security | 82 | Vercel/Supabase defaults; preview hygiene |
| Infrastructure | 80 | CI present; branch protection not verified here |
| AI Security | 84 | Patient + examiner injection controls |
| Voice Security | 86 | Auth + rate limit + upload caps |
| Secrets Management | 85 | No service key in git; anon public by design |
| Compliance Readiness | 72 | Technical controls yes; policies/BAA ops |
| Monitoring | 78 | Audit events; limited SIEM integration |
| **Overall** | **86** | |

---

## Remaining risks

1. Enable **leaked password protection** in Supabase Auth dashboard.  
2. Provision **Upstash Redis** in production for distributed rate limits.  
3. Prefer **`REPORT_WRITE_KEY`** over service-role report writes.  
4. Plan CSP nonce migration to remove `unsafe-eval`.  
5. Formalize retention/deletion + BAAs for healthcare deployments.  
6. Confirm GitHub branch protection / required reviews on `main`.

---

## Production recommendation

Deployable for production training environments after completing operational items (1)–(3) above.

---

## Conclusion

⚠ SECURITY CERTIFIED WITH RECOMMENDATIONS
