# Security Audit — Section H (SSI)

**Audit:** VEA-2026-08-05 · Production SHA `5aae138` · Observational only  
**Prior cert:** `docs/PRODUCTION_SECURITY_CERTIFICATION.md` — Certified with Recommendations (score ~84)

## Live production verification (this audit)

| Check | Result |
|---|---|
| Security headers on `/` | CSP, HSTS (`max-age=63072000; includeSubDomains; preload`), XFO DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP, CORP |
| Locale cookie | `Secure; SameSite=lax` observed |
| Unauth API | `/api/sessions` POST → 401 JSON |
| Unauth admin API | `/api/admin/*` → 401 JSON |
| Unauth app pages | 307 to `/login?next=…` |
| Health | Public `/api/health` 200; OpenAI health admin-gated (code/cert) |

---

## Control inventory (code + cert evidence)

| Domain | Status | Notes |
|---|---|---|
| Authentication | Strong | Supabase Auth; password policy ≥8+complexity |
| Authorization | Strong | Edge admin gate + `requireApiAdmin` + RLS; roles in `profiles.role` |
| RLS | Strong | Initplan wraps; ACE/CGE write lockdown; report admin-read |
| API security | Strong | Rate limits; clientSafeError; no raw provider leakage |
| Rate limiting | Conditional | Upstash if configured; else in-memory (not horizontally safe) |
| Secrets | Strong pattern | `.env.production` public anon only; service role server-only |
| Report integrity | Strong | HMAC-signed insert-once RPC |
| Audit logging | Partial | `security_audit_events`; not all admin mutations |
| OWASP residual | Medium | CSP `unsafe-inline`/`unsafe-eval`; prompt injection residual |
| Privacy / PHI | Partial | Legal pages + consent columns; HIPAA not certified; DSAR UX incomplete |
| Demo accounts | Hardened | `*.vpsych.test` banned |

---

## Security Excellence Index (SSI)

**SSI = 84 / 100**

Aligned with prior production security certification. Not a clean-sheet re-penetration test; this audit re-verified headers/auth gates on live production and cross-checked residual risks from certification docs + current code patterns on `main`.

---

## Findings

| ID | Sev | Finding | Root cause | Impact | Priority |
|---|---|---|---|---|---|
| SEC-H1 | High | In-memory rate-limit fallback under multi-instance Vercel | Upstash optional | Abuse bursts across instances | P1 |
| SEC-H2 | High | Compliance program incomplete (BAA/DSAR/SIEM) | Process lag vs technical controls | Enterprise blocker | P1 |
| SEC-M1 | Medium | CSP unsafe-inline/eval | Next.js without nonces | XSS residual | P2 |
| SEC-M2 | Medium | Prompt-injection residual | System prompt isolation only | Transcript contamination | P2 |
| SEC-M3 | Medium | Incomplete admin mutation audit coverage | Best-effort logging | Forensics gaps | P2 |
| SEC-L1 | Low | HIBP leaked-password check disabled (ops) | Dashboard config | Credential stuffing residual | P3 |

---

## Recommendations

| Rec | Impact | Priority |
|---|---|---|
| Require Upstash in production | Horizontal rate-limit integrity | P1 |
| CSP nonce migration plan | XSS posture | P2 |
| Formal privacy ops (retention UX, DSAR) | Enterprise/compliance | P1 |
| Expand security_audit_events coverage | Detectability | P2 |

**No Critical open vuln asserted by prior cert after remediation; this audit did not re-exploit historical findings.**
