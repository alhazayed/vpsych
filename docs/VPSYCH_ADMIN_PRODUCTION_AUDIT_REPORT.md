# VPsych ADMIN / PRODUCTION AUDIT REPORT

**Audit type:** Phase 1 — read-only, evidence-based (no code or schema changes)  
**Repository:** `alhazayed/vpsych`  
**Baseline commit:** `2c124d501dae6aac9dc67cd8b717b688a4d9157e` (`main`)  
**Audit date (UTC):** 2026-09-08  
**Package version:** `1.0.0-rc.1`  
**Scope note:** VPsych is a **therapist-training** platform (AI standardized patients + admin performance reports). It is **not** a patient-facing psychometric battery (PHQ-9 / GAD-7 / C-SSRS as scored clinical instruments). Those instruments appear only as **authored vignette content** inside fictional cases. Findings below are judged against both: (a) the product’s stated Limited Professional Preview / CIDP scope, and (b) the broader “production clinical assessment platform” bar implied by this audit charter.

**Verification method:** Static analysis of `src/`, `supabase/migrations/`, `messages/`, CI, deps; local `npm test` (841/841 pass); `npm audit --omit=dev` (1 critical advisory). Live production HTTP / live PostgREST exploit attempts were **not** executed in this cloud environment → marked **PARTIALLY VERIFIED** where live confirmation would be required.

---

## A. Executive Summary

| Dimension | Verdict |
| --- | --- |
| Overall risk (Limited Preview / fictional SP training) | **High residuals; operable under strict governance** |
| Overall risk (GA as real-patient clinical assessment) | **Unacceptable — wrong product model + integrity gaps** |
| Production readiness | **Limited Professional Preview / CIDP only** (`docs/KNOWN_LIMITATIONS.md`) — **not GA** |
| Security posture | Strong layered admin AuthZ; **confirmed regression** of transcript-forge control; XSS→session risk elevated by non-HttpOnly cookies + CSP `unsafe-inline`/`unsafe-eval` |
| Clinical safety posture | Prompt-only patient safety; EN-biased risk heuristics; no runtime crisis escalation for trainees; disclaimers mostly present but incomplete in admin ReportView / AR curriculum copy |
| Administrative control posture | Multi-layer gates (middleware + page + API + RLS); weak deny-audit path; no MFA; no first-class user/role admin UI |

### Most important findings (TOP)

1. **P0/P1 — Assessment integrity:** `insert_assistant_message` / `insert_system_message` are again `GRANT … TO authenticated` with **no HMAC verification** of `p_sig` (`20260806143023_…`), regressing the H2 fix claimed in `docs/PRODUCTION_SECURITY_CERTIFICATION.md`. Session owners can forge assistant/system turns via PostgREST and bias scores / ACE.
2. **P1 — Client error leakage:** `clientSafeError` returns short Postgres messages that do not match its keyword denylist (`src/lib/api-errors.ts:13–21`); SSE stream returns raw `err.message` (`sessions/[id]/message/stream/route.ts:187–190`).
3. **P1 — No real MFA** for admins; enterprise MFA is an in-memory policy stub (`src/lib/enterprise/security.ts`).
4. **P1 — Clinical/education safety bias:** risk-inquiry detection is English-regex-only and always emits a **critical** “missed risk” finding when absent (`session-evaluation.ts:83–88`, `179–188`); Arabic examiner prompt omits Wave-3 dimension coaching present in EN (`report-locale.ts:74–98` vs `125–129`).
5. **P1 — Dependency:** `next@16.2.12` flagged critical by `npm audit` (GHSA-p293-qw3h-jr36; advisory scope Windows RCE — still breaks CI `audit:deps` gate and must be patched).
6. **P2 — Admin deny audits silently fail** because `log_security_event` requires `is_admin()` or `service_role` (`20260806130513`), while deny paths call it as the denied therapist (`auth.ts:33–38`, `api-auth.ts:67–74`, `security-audit.ts:59–61`).
7. **P2 — Rate limits not horizontally safe** without Upstash; fail-open to per-instance memory (`rate-limit.ts:123–144`).
8. **P2 — Admin reports UI** loads **all** reports without pagination (`admin/reports/page.tsx:10–29`); `ReportView` omits `aiSource` / “not validated” disclosure.
9. **P2 — Institution managers** can SELECT tenant `sessions` including `clinical_snapshot` (PHI-adjacent training data).
10. **P3 — CAPTCHA absent**; invite/cert public endpoints rely on rate limits only.

### GO / NO-GO (see §33)

**CONDITIONAL GO** for Limited Professional Preview / Controlled Institutional Deployment **only**, with Stage-1 mitigations required before expanding trust, enrollment, or GA claims.

**NO-GO** for General Availability, real-patient assessment, high-stakes credentialing, or any claim that competency scores are validated clinical measurements.

---

## B. Architecture Assessment

### Current architecture (VERIFIED)

```text
Browser (Next.js 16 App Router / React 19 / next-intl)
  │  cookies: Supabase SSR auth (sameSite=lax, httpOnly=false by SSR default)
  ▼
src/middleware.ts → lib/supabase/middleware.ts
  │  getUser(); public allowlist; /admin|/api/admin role gate
  ▼
Server Components / Route Handlers (71 API routes)
  │  requireProfile / requireAdmin / requireApiUser / requireApiAdmin
  │  rateLimit(); inline validation; clientSafeError / sanitize*
  ▼
Supabase Auth + PostgREST
  │  anon key in browser; service role server-only (optional)
  ▼
PostgreSQL + RLS (100 public tables, all RLS ON in migrations)
  │  is_admin(); SECURITY DEFINER RPCs; Vault HMAC for reports
  ▼
External: OpenAI / Vercel AI Gateway · ElevenLabs · Upstash (optional) · Edge email hook
```

### Major components

| Layer | Evidence |
| --- | --- |
| Frontend | `src/app/(app)/` authenticated shell; 20 admin pages; sessions/clinic/learning |
| AuthN | Supabase Auth; `getUser()` in middleware + guards |
| AuthZ | `profiles.role` ∈ {`therapist`,`admin`}; never JWT `user_metadata` |
| Session lifecycle | `POST /api/sessions` → message → end → `assessSession` → `create_session_report` / service insert → ACE best-effort |
| Engines | case / scenario / presets / ACE / CGE / personality / clinical-voice |
| Reports | Admin-only RLS + HMAC or service-role write |
| i18n | Cookie locale `en`/`ar`; native avatar personalities `en-US`/`ar-JO` |

### Trust boundaries

1. Browser ↔ Next.js server (anon JWT, no service role in client — VERIFIED `lib/supabase/client.ts`, `admin.ts`)
2. Next.js ↔ Supabase Auth / Postgres (RLS + DEFINER RPCs)
3. Next.js ↔ AI / TTS providers (transcripts leave the trust boundary)
4. Admin privilege boundary (`profiles.role`, middleware, API, RLS)
5. Fictional SP content vs any future real PHI (product currently fictional-only by policy)

### Critical data flows

| Flow | Privilege | Notes |
| --- | --- | --- |
| Therapist chat / voice | Owner session | Ownership checked in API + RLS |
| Session end assessment | Owner write report via HMAC/service | Therapist **cannot SELECT** `session_reports` |
| Admin report view | Admin | Audited `admin.report.view` (success path) |
| Admin exports | Admin APIs | CSV/JSON/Excel/PDF research/quality |
| ACE progress | Soft-fail post-assessment | Never blocks report |

---

## C. Admin Security Assessment

### Authentication (VERIFIED)

| Control | Status | Evidence |
| --- | --- | --- |
| Login / logout | Pass | `login/page-client.tsx`, `AppShell` `signOut` |
| Password policy | Pass (min complexity) | `password-policy.ts` |
| Password reset | Pass (pattern) | reset email → confirm → `updateUser` → `signOut` |
| Session refresh | Pass | middleware `getUser()` |
| Role source | Pass | `profiles.role` only |
| Self-escalation | Pass | RLS WITH CHECK + `profiles_role_guard` trigger |
| MFA | **Fail / not implemented** | Policy stub only |
| Remember me | Info | UI no-op |
| Cookie HttpOnly | **Weak** | `@supabase/ssr` default `httpOnly: false` |
| Cookie Secure | **Weak in app config** | Not set in SSR defaults; relies on HTTPS |

### Authorization matrix (admin capabilities)

| Capability | UI | API | DB | Evidence | Risk |
| --- | --- | --- | --- | --- | --- |
| View all session reports | Y `/admin/reports` | via RSC + RLS | SELECT admin-only | `admin/reports/page.tsx`, migrations | Low if admin trusted |
| View report detail | Y | RSC | admin SELECT | `admin/reports/[sessionId]/page.tsx` | Low |
| Export research/QL/VQI | Y panels | `/api/admin/*` + `requireApiAdmin` | admin | export routes | Med — linkable UUIDs |
| Manage avatars/voices/templates/presets | Y | admin CRUD | admin policies / INVOKER RPCs | admin routes | Low |
| View ACE learners / CGE | Y | admin | admin | | Low |
| Manage user roles | **No dedicated UI** | No dedicated API found | Admin can UPDATE any profile via RLS | SQL / service role path | Med — opaque ops |
| View security audit log | Partial (ops/CIDP) | admin | admin SELECT | | Med — deny events missing |
| Delete sessions/messages | Limited | Limited | No client DELETE on messages | | Info |
| OpenAI health | N/A | `requireApiAdmin` (not under `/api/admin` prefix) | N/A | `health/openai/route.ts` | Low (thinner edge gate) |

### Privilege escalation

| Attack | Result | Confidence |
| --- | --- | --- |
| Client role / localStorage | Not used for AuthZ | VERIFIED |
| JWT `user_metadata.role` | Ignored; signup forces therapist | VERIFIED |
| Call `/api/admin/*` as therapist | Middleware + `requireApiAdmin` → 403 | VERIFIED (static) |
| Direct PostgREST SELECT `session_reports` | RLS admin-only | VERIFIED (SQL) |
| Horizontal session IDOR | API `therapist_id !== user.id` → 403 + RLS | VERIFIED |
| Forge assistant messages on **own** session | **Possible** via DEFINER RPC as authenticated owner | **CONFIRMED VULNERABILITY** (integrity) |
| Forge admin_test marker | Insert guard + architecture tests | VERIFIED mitigated |

### Admin API findings

- **42+** `/api/admin/*` handlers use `requireApiAdmin` (architecture tests enforce many).
- Dual gate: middleware role load + handler.
- Deny audit soft-fails for non-admins (**P2**).

---

## D. Database / Supabase Assessment

### RLS assessment

| Check | Result |
| --- | --- |
| Public tables with RLS | **100/100** ENABLE in migrations — VERIFIED |
| Anon table grants | Revoked in certification hardening — VERIFIED (SQL) |
| `session_reports` SELECT | Admin only — VERIFIED |
| `session_messages` INSERT | User-role only for `role='user'` — VERIFIED |
| Learner ACE score self-write | Hardened — VERIFIED (prior H1 fix retained in later migrations) |
| Storage buckets | **None in-repo** — NOT VERIFIED live |
| Realtime publications | None in migrations |
| Cron | None in migrations |

### Sensitive tables (summary)

| Table | RLS | SELECT | Write | Notes |
| --- | --- | --- | --- | --- |
| `profiles` | ON | own/admin | own (role frozen) / admin any | Role guard trigger |
| `sessions` | ON | owner/admin (+ institution managers) | owner/admin; snapshot frozen | Managers see `clinical_snapshot` |
| `session_messages` | ON | owner/admin | user inserts + DEFINER RPCs | Forge path via RPC |
| `session_reports` | ON | admin | DEFINER/HMAC or service | Therapist cannot read |
| `security_audit_events` | ON | admin | DEFINER gated | Deny path broken |
| `avatars` | ON | all authenticated if active | admin | Full prompts exposed |
| Quality / VQI / scientific | ON | admin | service/admin | |

### RPC assessment

| RPC | DEFINER | Authz | EXECUTE | Issue |
| --- | --- | --- | --- | --- |
| `is_admin` | Y | `auth.uid()` | auth+service | OK |
| `create_session_report` | Y | owner/admin + HMAC unless service | auth+service | OK if key secret |
| `insert_assistant_message` | Y | owner/admin/service; **no HMAC** | **authenticated+service** | **Integrity regression** |
| `insert_system_message` | Y | same | authenticated+service | same |
| `log_security_event` | Y | admin\|service | auth+service | Blocks therapist deny logs |
| `append_quality_ledger` | Y | service only | service | OK |
| `apply_ace_session_progress` | Y | service | service | OK |

### Storage assessment

No Storage bucket policies in migrations. Avatars use static `/public` paths. **Live project Storage outside git: UNKNOWN.**

---

## E. PHI / Privacy Assessment

### Product data model (important)

Training transcripts, competency scores, therapist display names, and fictional patient vignettes are **educational simulation data**. They are still **sensitive** (trainee performance, possible accidental real PHI if users paste it).

### Data collected / stored

| Data | Stored | Who sees |
| --- | --- | --- |
| Email / auth | Supabase Auth | Self; admins via Auth dashboard (ops) |
| `profiles.display_name`, role, language | Postgres | Self / admin |
| Session transcripts | `session_messages` | Owner / admin |
| Clinical snapshot (fictional diagnosis/risk) | `sessions.clinical_snapshot` | Owner / admin / institution managers |
| Scores / narrative | `session_reports` | **Admin only** |
| Private notes | `session_private_notes` | Owner / admin |
| Feedback | institutional feedback tables | Admin |

### Data exported

Admin research / quality-ledger / VQI / validation exports (CSV/JSON/Excel/PDF/FHIR-shaped). Contain `session_id` / `learner_id` UUIDs — linkable inside tenant.

### Data logged

Generally careful (sessionId, aiSource, model — not full transcripts in assessment logs). Residual: raw errors to clients; server `console.warn` on failures.

### Third-party flows

| Party | Data | Risk |
| --- | --- | --- |
| OpenAI / AI Gateway | Prompts + transcripts | Provider retention / DPA required |
| ElevenLabs | TTS text / STT audio | Provider retention |
| Upstash | Rate-limit keys (user ids) | Low |
| Email hook | Auth emails | Hook secret required |
| Sentry/Analytics SDKs | **Not present** | Reduces log PHI; weakens detection |

### Privacy risks

| ID | Risk | Severity |
| --- | --- | --- |
| PRIV-1 | Trainees may paste real PHI into chat (policy-only control) | P1 governance |
| PRIV-2 | Institution manager session SELECT includes clinical_snapshot | P2 |
| PRIV-3 | Active avatar prompts readable by any authenticated user | P2–P3 IP / exam integrity |
| PRIV-4 | `clientSafeError` / SSE schema/error leakage | P1 |
| PRIV-5 | Non-HttpOnly auth cookies → XSS session theft | P1 (with CSP weakness) |

---

## F. Assessment Engine Assessment

**Nature of “assessment” here:** LLM examiner + keyword heuristic scoring a **trainee therapist** against a Wave-3 educational rubric (`weightedOverall` in `lib/ai/assessment.ts`). **Not** instrument-normed patient psychometrics.

| Assessment / instrument | Implemented | Scoring verified | Interpretation verified | AR/EN parity | Risk |
| --- | --- | --- | ---: | ---: | --- |
| Wave-3 competency rubric (alliance…safety…structure + DSM/ICD dims) | Yes | Formula unit-tested; LLM non-deterministic | Narrative LLM; heuristic fallback | Partial — AR examiner prompt thinner | P1 |
| `weightedOverall` | Yes (single private helper) | Yes (tests + architecture ownership) | N/A | N/A | Low |
| Heuristic fallback | Yes | Keyword lists EN+some AR | Discloses in narrative text | Partial | P1 if UI hides `aiSource` |
| AVI synthetic retest jitter | Yes | Intentional synthetic | Must not claim validity | N/A | P2 claim risk |
| Reliability harness | Synthetic only | Internal consistency only | Explicitly not validation | N/A | Info |
| PHQ-9 / GAD-7 / C-SSRS **scored instruments** | **No** | N/A | Vignette numbers only in personas | N/A | **Mis-scope if claimed** |
| Education `evaluateSession` risk gate | Yes | EN regex only | Always critical if miss | **Fail for AR** | P1 |

---

## G. Clinical Safety Assessment

### Screening vs diagnosis

| Control | Status |
| --- | --- |
| Case mint: persona does not permanently own disorder | VERIFIED (`case-engine`, snapshot freeze) |
| UI still shows `avatars.disorder` on complete/report meta | PARTIAL — can look persona-owned |
| Disclaimers: not for real-patient diagnosis | Present in consent / known limitations / many admin strings |
| Marketing “diagnostic accuracy” language | Over-strong in landing copy (`messages/en.json`) |
| Admin ReportView validation disclosure | **Missing** |

### Crisis / C-SSRS

| Question | Finding |
| --- | --- |
| Patient SI behavior | Prompt Module 4 + canonical facts; **no runtime enforcer** |
| High-risk trainee miss | Education layer flags EN keywords only; silent for Arabic probes |
| Automatic escalation to humans | **No** — training product; consent says do not run real crisis protocols for avatar |
| Can client bypass safety | Trainee can omit risk questions; scoring may or may not reflect it (LLM/heuristic) |
| Failure mode | Soft-fail ACE/education; session still “succeeds” |

**Safety-critical pathway verdict:** Acceptable only because patients are **fictional** and scope forbids real-patient CDS. **Unsafe to reuse** as real-patient crisis tooling without a redesigned fail-closed pathway.

---

## H. Admin Dashboard Assessment

| Area | Rating (0–5) | Notes |
| --- | --- | --- |
| Data visibility | 4 | Reports, sessions, scientific dashboards present |
| Search/filter | 2 | Reports list unpaginated; limited server filters on list page |
| User management | 1 | No first-class role/user admin UX |
| Reports | 3 | Detail works; missing provenance/`aiSource` |
| Exports | 4 | Multiple admin export formats; authz OK |
| Operational controls | 3 | CIDP/ops/phase panels; MFA/SSO stubs |
| Auditability | 2 | Success views logged; deny path broken; no SIEM |

---

## I. Performance Assessment

Highest-impact bottlenecks / risks:

1. **Admin reports** `select` all reports + joins — no `.limit` / pagination (`admin/reports/page.tsx`) → degrades as corpus grows.
2. **Quality ledger / research exports** up to large row caps (e.g. 2000) in request path.
3. **Voice E2E** depends on STT + LLM + TTS serial path; budgets documented but CI perf-smoke only checks doc markers (`scripts/perf-smoke.mjs`) — **not** live latency.
4. **N+1 risk** in some admin completeness loops over avatars (home page loads full avatar fields for all patients).
5. In-memory rate limit under multi-instance → uneven throttling / hotspot instances.

---

## J. Testing Assessment

| Area | Tests exist | Meaningful | Passing (local) | Coverage risk |
| --- | --- | ---: | ---: | --- |
| Unit / architecture guards | Yes (96 files) | High for invariants | 841/841 | Medium — static string guards |
| Assessment scoring helpers | Yes | High for formula/heuristic | Pass | LLM path under-mocked for prod drift |
| AuthZ requireApiAdmin presence | Many architecture tests | Medium (presence ≠ behavior) | Pass | No live RLS suite in CI without `SUPABASE_DB_URL` |
| RLS / PostgREST exploit | Mostly migration + prior cert docs | Partial | N/A here | **High** — H2 regression shows docs drift |
| Bilingual scoring parity | Sparse | Low | — | **High** |
| E2E browser | Not in CI | — | — | High |
| Export auth | Architecture + unit | Medium | Pass | Medium |
| Crisis/safety runtime | Docs admit gap | Low | — | **High** |
| Dependency audit in CI | Yes | High | **Would fail now** (`next` advisory) | P1 |

---

## K. Findings Register

| ID | Severity | Area | Finding | Evidence | Recommended Action |
| --- | --- | --- | --- | --- | --- |
| F-01 | P0 | Assessment integrity | Authenticated owners can call `insert_assistant_message` / `insert_system_message` without HMAC; forge transcript turns | `supabase/migrations/20260806143023_restore_session_message_rpc_owner_auth_qa.sql` (GRANT authenticated; `p_sig` unused); contradicts `docs/PRODUCTION_SECURITY_CERTIFICATION.md` H2 | Re-revoke authenticated EXECUTE **or** re-enable HMAC with service-role/HMAC-only writers; add regression test + live PostgREST negative test |
| F-02 | P1 | API / privacy | `clientSafeError` returns ≤120-char DB messages lacking denylist keywords | `src/lib/api-errors.ts:13–21` | Default-deny: only allowlist known product strings; use `sanitizeDbError` everywhere |
| F-03 | P1 | API / privacy | SSE stream emits raw exception messages | `src/app/api/sessions/[id]/message/stream/route.ts:187–190` | Send stable client code only |
| F-04 | P1 | Auth | No MFA for admin accounts | Login password-only; `enterprise/security.ts` stub | Enforce AAL2/MFA for `role=admin` before GA |
| F-05 | P1 | Session | Auth cookies HttpOnly=false + CSP unsafe-inline/eval | `@supabase/ssr` defaults; `security-headers.ts:41–42` | Prefer HttpOnly cookie strategy; tighten CSP as Next allows; XSS = admin takeover |
| F-06 | P1 | Clinical education | Risk inquiry detector EN-only; critical false negatives for Arabic | `session-evaluation.ts:83–88`, `179–188` | Locale-aware detectors; case-conditioned severity when SI=`none` |
| F-07 | P1 | Assessment bilingual | AR examiner system prompt omits Wave-3 dimension coaching present in EN | `report-locale.ts:74–98` vs `125–129` | Parity both prompts; add bilingual golden tests |
| F-08 | P1 | Dependencies / CI | `next@16.2.12` critical advisory; CI `audit:deps` fails | `npm audit`; `package.json` pins `16.2.12` | Upgrade to patched Next (≥16.3.4 per advisory) |
| F-09 | P2 | Audit logging | Denied admin access cannot write `log_security_event` | `api-auth.ts:67–74`; migration CQG `log_security_event` admin\|service only; soft-fail in `security-audit.ts` | Service-role audit writer for deny path or allow authenticated insert of **denied** events only |
| F-10 | P2 | Abuse | Rate limit memory fallback / fail-open; cert-verify key not per-IP | `rate-limit.ts:123–144`; `certificates/verify/route.ts` | Require Upstash in production; fix keying; alert on fallback |
| F-11 | P2 | Admin UX / integrity | ReportView omits `aiSource` / not-validated banner | `ReportView.tsx`; `KNOWN_LIMITATIONS.md:14` | Surface provenance on every report |
| F-12 | P2 | i18n | AR curriculum subtitle missing “not validated” disclaimer | `messages/en.json:915` vs `messages/ar.json:915` | Fix AR copy parity |
| F-13 | P2 | Multi-tenant | Institution managers SELECT sessions incl. clinical_snapshot | migration `20260803202534` | Metadata view without snapshot / column privilege |
| F-14 | P2 | Admin scale | Reports page loads entire corpus | `admin/reports/page.tsx:10–29` | Paginate + server filters |
| F-15 | P2 | Clinical UI | Complete/report meta uses avatar.disorder not snapshot diagnosis | `sessions/[id]/complete/page.tsx`; admin report meta | Bind to `clinical_snapshot.primary_diagnosis` |
| F-16 | P2 | Bot protection | No CAPTCHA/Turnstile | repo-wide absence | Add server-verified Turnstile on signup/invite |
| F-17 | P2 | Ops | Leaked-password protection disabled (documented residual) | `KNOWN_LIMITATIONS.md:41` | Enable in Supabase Auth |
| F-18 | P3 | Auth UX | Remember-me no-op | `login/page-client.tsx` | Remove or implement |
| F-19 | P3 | Observability | No APM/Sentry | `package.json`, phase15 residual | Add PHI-scrubbed APM |
| F-20 | P3 | ACE semantics | Empty competencies baseline score 70 | `ace/engine.ts:35–42` | Use null/unassessed distinct from mid score |
| F-21 | P3 | IP / exam | Full avatar prompts to all authenticated users | avatars SELECT policy | Project safe columns for therapists |
| F-22 | P4 | Docs drift | Security cert claims H2 fixed; later migration restored grants | cert doc vs `20260806143023` | Re-certify after F-01 |

---

## L. Threat Model (Admin-focused)

| Actor | Assets | Attack surface | Exploit | Impact | Existing control | Missing |
| --- | --- | --- | --- | --- | --- | --- |
| Anonymous | Public pages, invite, cert verify | Auth endpoints, invite brute | Credential stuffing / invite guess | Account or preview access | Rate limits, password policy | CAPTCHA, HIBP |
| Registered therapist | Own sessions | APIs, PostgREST RPC | Forge assistant msgs; paste PHI | Score integrity; privacy incident | Ownership RLS; insert guards | HMAC/service-only msgs |
| Malicious therapist | Reports (denied), admin APIs | Direct API | IDOR / admin call | Blocked if layers hold | Middleware+API+RLS | Live RLS CI |
| Admin | All reports/exports | XSS, session cookie | Steal non-HttpOnly cookie | Full PHI-adjacent dump | CSP (weak), role gates | MFA, HttpOnly |
| Compromised admin | Everything admin | Exports, role SQL | Insider exfil | Severe | Audit success events | Deny/SIEM, break-glass |
| Bot | Signup/invite/AI | Unauthenticated + AI quotas | Cost abuse | $$ / DoS | Per-user rate limits | CAPTCHA, Upstash required |
| Provider compromise | Transcripts | OpenAI/ElevenLabs | Leak | Confidentiality | DPA/ops | Retention controls evidence |
| External attacker | RCE via Next advisory | Deploy platform | Windows-specific RCE per GHSA | Depends on host | Vercel Linux (mitigates this GHSA) | Still patch |

---

## M. Prioritized Remediation Plan

### Stage 1 — MUST FIX BEFORE broadening production trust

1. **F-01** Restore message-RPC integrity (HMAC or service_role-only EXECUTE); regression + live negative test.  
2. **F-02/F-03** Harden client error surfaces (default-deny).  
3. **F-08** Patch Next.js; restore green `audit:deps`.  
4. **F-11/F-12/F-15** Provenance + bilingual disclaimer + snapshot diagnosis in admin/trainee surfaces.  
5. **F-06/F-07** Arabic risk/scoring parity for education + examiner prompts.  
6. **F-09** Fix security deny auditing (service writer).  
7. **F-10** Require Upstash in production; fail closed or page ops.  
8. Governance: keep **fictional SP only**; block real-patient workflows in policy + UI.

### Stage 2 — FIX SOON AFTER limited release

- MFA for admins (F-04), HttpOnly/CSP hardening (F-05), CAPTCHA (F-16), HIBP (F-17).  
- Admin reports pagination/filters (F-14); manager snapshot minimization (F-13).  
- User/role admin UI with audited promotions.  
- E2E + live RLS CI job.  
- PHI-scrubbed APM (F-19).

### Stage 3 — TECHNICAL IMPROVEMENT

- ACE unassessed semantics (F-20); avatar column projection (F-21).  
- Re-certify security docs (F-22).  
- Reduce admin dashboard N+1; real perf drills beyond marker smoke.  
- Unify error helpers; trim duplicate enterprise stubs vs real Auth.

---

## N. Second-Phase Remediation Backlog (do not implement in Phase 1)

| Item | Files / DB | Migration? | Tests | Security | Regression risk | Verify |
| --- | --- | --- | --- | --- | --- | --- |
| Message RPC HMAC or revoke authenticated | `insert_*` functions; `messageRpcClient` callers; end/start/message routes | **Yes** | Architecture + SQL grant test + manual PostgREST forge attempt | Closes F-01 | Session start without service role must still work | Anon/auth forge → deny; happy path message OK |
| `clientSafeError` default-deny | `api-errors.ts` + call sites; stream route | No | Expand `api-errors.test.ts` | Closes F-02/03 | UX less specific errors | Inject fake PG error → fallback string |
| Next upgrade | `package.json` / lockfile | No | CI full | Closes F-08 | Next 16 minor | `npm audit` clean; build |
| ReportView provenance | `ReportView.tsx`, report types, end payload persistence of `aiSource` if needed | Maybe column | Component/logic tests | Transparency | Layout | Heuristic report shows banner |
| AR education risk parity | `session-evaluation.ts`, `report-locale.ts`, `messages/ar.json` | No | Bilingual fixtures | Clinical fairness | Heuristic score shifts | AR risk phrase → detected |
| Audit deny path | `security-audit.ts` + `log_security_event` or service client | Maybe | security-audit tests | Detection | Noise | Therapist hits `/api/admin` → row written |
| Upstash required in prod | `rate-limit.ts`, ops runbook | No | Unit | Abuse | Local/dev still memory | Prod without Upstash fails health/ops gate |
| Admin MFA | Auth UI + middleware AAL check | No (Auth settings) | E2E | Admin takeover | Login UX | Admin without MFA blocked |

---

## O. GO / NO-GO Decision

### CONDITIONAL GO

**Allowed:** Limited Professional Preview / Controlled Institutional Deployment with **fictional standardized patients only**, invited evaluators, admin-supervised reporting, and explicit “scores not validated” governance — **after Stage-1 F-01/F-02/F-03/F-08 are scheduled immediately** and communications continue to forbid real-patient use / high-stakes credentialing.

**Not allowed without Stage-1 completion + re-audit:** GA marketing, unrestricted enrollment, real-patient assessment, crisis CDS, or validated-score claims.

**Rationale:** Core admin AuthZ and report isolation are real and multi-layered. However, a **confirmed assessment-integrity regression** (F-01), **error leakage**, **no MFA**, **bilingual safety/scoring skew**, and **dependency/CI breakage** are material. The product’s own `KNOWN_LIMITATIONS.md` already constrains scope to Limited Preview — this audit agrees and tightens the bar.

---

## P. TOP 10 RISKS

1. **Risk:** Transcript forge via authenticated message RPCs  
   **Severity:** P0 · **Likelihood:** High (PostgREST + owner token) · **Impact:** Corrupt scores/ACE/ledger  
   **Evidence:** `20260806143023_…` · **Action:** HMAC or service-only EXECUTE  

2. **Risk:** XSS → admin session theft (non-HttpOnly cookies + weak CSP)  
   **Severity:** P1 · **Likelihood:** Med · **Impact:** Full admin data exfil  
   **Evidence:** SSR cookie defaults; `security-headers.ts` · **Action:** Cookie/CSP/MFA  

3. **Risk:** Schema/error leakage to clients  
   **Severity:** P1 · **Likelihood:** High · **Impact:** Recon / support abuse  
   **Evidence:** `api-errors.ts`; stream route · **Action:** Default-deny sanitization  

4. **Risk:** Arabic sessions systematically mis-scored on risk/Wave-3 dims  
   **Severity:** P1 · **Likelihood:** High for AR users · **Impact:** Unfair education signals; false safety confidence  
   **Evidence:** `session-evaluation.ts`; `report-locale.ts` · **Action:** Parity + tests  

5. **Risk:** Admin account compromise without MFA  
   **Severity:** P1 · **Likelihood:** Med · **Impact:** All reports/exports  
   **Evidence:** password-only login · **Action:** Enforce MFA  

6. **Risk:** Next.js critical advisory / CI audit gate red  
   **Severity:** P1 · **Likelihood:** Tooling certain; exploit host-dependent · **Impact:** Supply-chain / blocked CI  
   **Evidence:** `npm audit` · **Action:** Upgrade  

7. **Risk:** Silent success despite heuristic assessment / ACE failure  
   **Severity:** P2 · **Likelihood:** Med · **Impact:** Operators trust bad scores  
   **Evidence:** `ace/session-hook.ts`; ReportView gap · **Action:** Surface `aiSource` everywhere  

8. **Risk:** Horizontal rate-limit bypass without Upstash  
   **Severity:** P2 · **Likelihood:** Med on Vercel multi-instance · **Impact:** Cost/DoS  
   **Evidence:** `rate-limit.ts` · **Action:** Require Redis  

9. **Risk:** Institution manager over-read of clinical_snapshot  
   **Severity:** P2 · **Likelihood:** Med if faculty roles used · **Impact:** Excess training-data exposure  
   **Evidence:** tenant session SELECT policy · **Action:** Narrow columns  

10. **Risk:** Accidental real PHI in fictional training transcripts  
    **Severity:** P1 governance · **Likelihood:** Med · **Impact:** Regulatory incident  
    **Evidence:** policy/consent only · **Action:** DLP warnings, retention, export review  

---

## Q. FINAL VPsych AUDIT SCORE

Scores justified by findings above (0 = unacceptable, 100 = exemplary for GA clinical platform). Limited Preview lowers some bars but **does not** erase integrity/privacy defects.

| Domain | Score | Justification |
| --- | ---: | --- |
| Authentication | 72 | Solid Supabase Auth + password policy; no MFA; cookie flags weak |
| Authorization | 86 | Excellent layered admin gates; role not client-settable; deny-audit gap |
| Database Security | 78 | RLS universal; report isolation strong; **message RPC regression** |
| PHI Privacy | 70 | Admin report isolation good; error leaks; provider egress; manager SELECT |
| Assessment Integrity | 55 | Single formula OK; forge path + LLM/heuristic opacity + AVI synthetic jitter |
| Clinical Safety | 58 | Appropriate for fictional SP only; prompt-only; EN-biased risk heuristics |
| Admin Dashboard | 64 | Broad surfaces; weak user mgmt, pagination, provenance, auditability |
| API Security | 74 | Auth+rate limits widespread; sanitization holes; no CAPTCHA |
| Testing | 73 | 841 unit/architecture tests pass; weak live RLS/E2E/bilingual safety |
| Performance | 68 | Budgets documented; admin unbounded queries; CI smoke is marker-only |
| DevOps | 70 | Solid CI pipeline shape; currently fails dep audit; migration parity optional remote |
| **Overall** | **70** | Fit for **governed Limited Preview** after Stage-1; **not** GA clinical platform |

---

## R. Evidence appendix (this run)

- Commit: `2c124d501dae6aac9dc67cd8b717b688a4d9157e`  
- `npm test`: **841 passed / 96 files**  
- `npm audit --omit=dev`: **1 critical** (`next` GHSA-p293-qw3h-jr36)  
- Migrations on disk: **78**  
- API `route.ts` count: **71**  
- Admin pages: **20**  
- Artifacts: `/opt/cursor/artifacts/audit-evidence-summary.txt`, `npm-audit-omit-dev.log`, `vitest-summary.log`

### Verification legend used throughout

| Label | Meaning |
| --- | --- |
| VERIFIED | Confirmed in repository code/SQL/tests this run |
| PARTIALLY VERIFIED | Code reviewed; live exploit/prod config not executed |
| NOT VERIFIED | Requires live project / ops evidence |
| UNKNOWN | Insufficient evidence |
| POTENTIAL RISK | Compensating controls may exist; not fully traced |
| CONFIRMED VULNERABILITY | Exploit path traced with compensating controls checked and insufficient |

---

*End of Phase 1 audit. No application source, schema, RLS, env, auth, or scoring logic was modified as part of this audit. Remediation is backlog-only until explicitly authorized for Phase 2.*
