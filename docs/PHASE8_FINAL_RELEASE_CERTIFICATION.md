# Phase 8.6 — Final Production Security & Release Certification

**Mode:** Read-only certification (no code, migration, dependency, or refactor changes)  
**Certification timestamp (UTC):** `2026-09-25T09:18:00Z`  
**Vocabulary:** `PASS` | `FAIL` | `PARTIAL` | `WAITING`  
**Release decision:** **CONDITIONAL GO**

---

## 1. Executive summary

Phase 8 closed the **P0 transcript-forgery** vulnerability on live production: Vault HMAC is active on `insert_assistant_message` / `insert_system_message`, application commit `d4a5992` (PR #234) is deployed and healthy, and live attack/legitimate matrices from Phase 8.5 and 8.6A remain green.

**PR #235 (Phase 8.3 P1 remediation) is still OPEN / DRAFT and is not on `main` or production.** Production therefore still carries the Phase 8.1 P1 gaps: client error allowlist / SSE sanitization, server-side Admin AAL2 MFA, bilingual risk inquiry with `NOT_APPLICABLE` / `UNCERTAIN`, Arabic Wave-3 examiner parity, and Next.js `16.3.6`.

Post-`d4a5992` scheduled `expire-sessions.yml` run: **WAITING**.

This certificate covers **software security for the fictional AI standardized-patient training product**. It does **not** certify clinical validation, psychometric validity, licensure, real-patient use, or autonomous clinical decision-making.

---

## 2. Exact production commit

| Field | Value | Status |
|-------|-------|--------|
| Expected production commit | `d4a5992` | — |
| `origin/main` | `d4a59927cd48c2938773132ccb8cf8a17b308b4f` | **PASS** (matches) |
| Production Vercel `githubCommitSha` | `d4a59927cd48c2938773132ccb8cf8a17b308b4f` | **PASS** (matches) |
| Merge source | PR #234 merged `2026-09-25T09:07:33Z` | **PASS** |
| Feature commit inside merge | `9ae1a68` Phase 8.2 HMAC restore | **PASS** |

Production does **not** differ from expected `d4a5992`.

---

## 3. Exact deployment identifier

| Field | Value |
|-------|-------|
| Host | `https://vpsych.vercel.app` |
| Deployment id | `dpl_8kJcT2Mxx1Yn1m5LALcUa67goSzY` |
| Target | `production` |
| State | `READY` |
| Inspector | `https://vercel.com/alhazayed-1540s-projects/vpsych/8kJcT2Mxx1Yn1m5LALcUa67goSzY` |
| Health | `GET /api/health` → **200** `{"ok":true,"service":"vpsych","version":"1.0.0-rc.1",...}` |
| Auth smoke | `POST /api/sessions` unauthenticated → **401** `{"error":"Unauthorized"}` |
| Supabase project | `vpsych` / `rrzudbkxigeavfdnidnm` / `us-east-1` / `ACTIVE_HEALTHY` |
| HMAC migration ledger | `20260925120000` / `phase8_restore_message_hmac` |

---

## 4. Security verification (P0 — message integrity)

### 4.1 Live database boundary (re-confirmed this certification)

| Check | Evidence | Status |
|-------|----------|--------|
| Vault `report_write_key` present | `has_hmac_secret=true` | **PASS** |
| `insert_assistant_message` SECURITY DEFINER + HMAC | Live `pg_get_functiondef` checks Vault key, payload `sessionId\ncontent\nassistant`, raises `Invalid message signature` | **PASS** |
| `insert_system_message` SECURITY DEFINER + HMAC | Same pattern with role `system` | **PASS** |
| `service_role` bypass | Present by design inside both functions | **PASS** (trusted server path) |
| EXECUTE grants | `authenticated`, `service_role`, `postgres` — **not** `anon` | **PASS** |
| RLS table insert | Therapists INSERT only `role = 'user'` | **PASS** |

### 4.2 Live attack / legitimate matrix

**Phase 8.5** (`public._phase85_hmac_results`, session `f7af0f05-…`, fictional):

| Step | Expected | Outcome |
|------|----------|---------|
| Assistant RPC, no HMAC | REJECTED | **PASS** |
| System RPC, no HMAC | REJECTED | **PASS** |
| Invalid HMAC | REJECTED | **PASS** |
| Modified content | REJECTED | **PASS** |
| Wrong / other session | REJECTED | **PASS** |
| Unauthorized therapist | REJECTED | **PASS** |
| Owner + valid HMAC (assistant/system) | SUCCESS | **PASS** |
| `service_role` without `p_sig` | SUCCESS | **PASS** |
| `create_session_report` | SUCCESS | **PASS** |

**Phase 8.6A** (`public._phase86a_results`, session `79815c2c-…`, post-deploy `d4a5992`, fictional):

| Step | Expected | Outcome |
|------|----------|---------|
| Unsigned forge | REJECTED | **PASS** |
| Invalid HMAC | REJECTED | **PASS** |
| Tampered content | REJECTED | **PASS** |
| Wrong-session signature | REJECTED | **PASS** |
| Legitimate signed message | SUCCESS | **PASS** |
| Service-role app path | SUCCESS | **PASS** |
| Report generation | SUCCESS | **PASS** |

### 4.3 Application signing path on production

| Check | Evidence | Status |
|-------|----------|--------|
| `prepareMessageRpc` on `main` / prod SHA | Call sites: session start, message, admin test-session | **PASS** |
| HMAC secret server-only | `REPORT_WRITE_KEY` / Vault — not `NEXT_PUBLIC_*`; no client component references | **PASS** |
| Service role server-only | `SUPABASE_SERVICE_ROLE_KEY` via `createServiceClient` only | **PASS** |

**P0 overall:** **PASS** (live-proven; not documentation-only).

---

## 5. P0 / P1 remediation verification

### 5.1 P0 (PR #234) — on production

| Item | Production status |
|------|-------------------|
| Message HMAC migration | **PASS** (ledger + live functions) |
| App signing (`prepareMessageRpc`) | **PASS** (deployed `d4a5992`) |
| Forgery rejected / legitimate succeeds | **PASS** (8.5 + 8.6A tables) |

### 5.2 P1 (PR #235) — **not** on production

| Field | Value |
|-------|-------|
| PR | https://github.com/alhazayed/vpsych/pull/235 |
| State | **OPEN**, **DRAFT** |
| Base | `cursor/admin-phase8-p0-remediation-fc9c` (not rebased onto `main`) |
| Merged to `main`? | **No** (`git merge-base --is-ancestor` of P1 head → main = false) |
| On production SHA `d4a5992`? | **No** |

| P1 finding | Repo PR #235 | Production `d4a5992` | Cert status |
|------------|--------------|----------------------|-------------|
| Error handling allowlist + no raw PG | Fixed on branch | Denylist `clientSafeError` still on main | **PARTIAL** |
| SSE no raw `err.message` | Fixed on branch | Stream route still emits `err.message` | **PARTIAL** |
| Admin MFA AAL2 server enforcement | Fixed on branch (`admin-mfa.ts`) | **No** `admin-mfa` module; `requireApiAdmin` role-only | **PARTIAL** |
| Risk AR + `NOT_APPLICABLE` / `UNCERTAIN` | Fixed on branch | Main still auto-`critical` when inquiry absent | **PARTIAL** |
| Wave-3 EN/AR examiner parity | Fixed on branch | EN Wave-3 block only in examiner prompt | **PARTIAL** |
| Next.js patched `16.3.6` | On branch | Production `next@16.3.4` | **PARTIAL** |

**Evidence > docs:** `docs/PHASE8_P1_REMEDIATION.md` claims FIXED for those items on the remediation branch only. Treating that document as production truth would be incorrect.

---

## 6. Database verification

| Area | Evidence | Status |
|------|----------|--------|
| RLS `session_messages` | SELECT participants; INSERT therapists **user role only** | **PASS** |
| RLS `session_reports` | Admin SELECT/UPDATE only (`is_admin()`); anon SELECT false | **PASS** |
| RLS `sessions` | Therapist own CRUD; institution managers tenant SELECT | **PASS** |
| SECURITY DEFINER RPCs | `insert_*_message`, `create_session_report`, `is_admin` | **PASS** |
| RPC grants post-Phase 8 | authenticated may EXECUTE message RPCs **with HMAC**; anon revoked | **PASS** |
| Phase 8 privilege regression | HMAC restore **tightens** write integrity; no grant expansion to anon | **PASS** |
| Storage policies | No Phase 8 storage migration; no regression introduced this phase | **PASS** (no Phase-8 change) |
| Institution managers vs reports | Tenant session view only; reports remain admin-gated | **PASS** |

---

## 7. Production verification

| Check | Result |
|-------|--------|
| Production SHA = `d4a5992` | **PASS** |
| Vercel READY | **PASS** |
| `/api/health` 200 | **PASS** |
| Unauthenticated API gate | **PASS** (401) |
| Live HMAC | **PASS** |
| Main CI on `d4a5992` | **PASS** — run `36116690877` (audit → lint → typecheck → test → migrations → perf → build) |
| Migration state | **PASS** — `20260925120000` present |

---

## 8. Cron status

| Item | Value |
|------|-------|
| Workflow | `.github/workflows/expire-sessions.yml` (`*/15`) |
| Latest scheduled success | `2026-09-25T05:13:12Z` run `36097639232` on SHA `dfe118c` (**pre**-`d4a5992`) |
| Post-`d4a5992` scheduled run | **None yet** (merge `09:07:33Z`; cert `09:18:00Z`) |
| Manual dispatch | Not performed (ACL / certification rule: do not alter cron) |

**Cron domain status:** **WAITING FOR SCHEDULED VERIFICATION**

Not classified as a code failure.

---

## 9. Known limitations

1. **P1 remediations not deployed** — PR #235 open/draft; production retains Phase 8.1 P1 findings.
2. **Admin MFA** — role gate only on production; no AAL2 enforcement until #235 (+ admin TOTP enrollment).
3. **Error surfaces** — denylist `clientSafeError`; SSE / some admin voice routes can still surface raw messages.
4. **Education risk heuristic** — English-centric on production; missing inquiry → critical even when risk not applicable.
5. **Arabic Wave-3 examiner instructions** — incomplete parity on production vs English.
6. **Next.js** — production `16.3.4` (P1 targets `16.3.6` for GHSA-vcvr-r3jv-pc5j ImageResponse range). App does not import `next/og`; residual lower but version unpatched.
7. **Scores not clinically validated** — platform competency scores must not be described as validated.
8. **Fictional training scope only** — not real-patient clinical use.
9. **Post-deploy cron** — waiting first scheduled run after `d4a5992`.
10. **Documentation lag** — several Phase 8 verification docs exist on topic branches / prior commits but are not all on `main` (`PHASE8_P0_REMEDIATION.md` is on main; 8.5 / 8.6A / P1 / regression docs are not).

---

## 10. Residual risks

| Risk | Severity | Mitigation path |
|------|----------|-----------------|
| Admin session theft without MFA | P1 (open on prod) | Merge/deploy #235; enroll admin factors; keep `ADMIN_MFA_REQUIRED` on |
| Client-visible internal errors (SSE/denylist) | P1 (open on prod) | Deploy #235 allowlist + stream sanitize |
| Misleading critical risk findings (esp. Arabic / N/A cases) | P1 (training safety) | Deploy #235 risk status enum + AR stems |
| EN/AR examiner dimension drift | P1 | Deploy #235 Wave-3 AR block |
| ImageResponse advisory range on `next@16.3.4` | P1 (unused path) | Deploy #235 `next@16.3.6` |
| Cron secret / scheduler failure after deploy | Ops | Wait for next green scheduled run; do not invent result |
| Service-role HMAC bypass | Accepted design | Keep service role server-only; never expose to browser |
| Documentation claiming production P1 FIXED | Process | This certificate supersedes branch-local P1 “FIXED” claims for production |

---

## 11. Release scope

Evidence supports only the scopes checked. Higher-risk scopes are **not** authorized by this certificate.

| Scope | Supported? | Rationale |
|-------|------------|-----------|
| **A. Internal development** | **Yes** | P0 closed; CI green; health green |
| **B. Controlled professional preview** | **Yes, conditional** | OK for fictional SP training with known P1 residuals disclosed; require admin MFA enrollment plan before widening admin access |
| **C. Institutional pilot** | **Not yet** | Deploy P1 (#235), complete post-deploy cron, operational MFA, institutional acceptance of residual education-heuristic limits |
| **D. General availability** | **No** | Open P1 on production; incomplete ops cron proof; product still `1.0.0-rc.1` |
| **E. Real-patient clinical use** | **No** | Explicitly out of product scope; no clinical validation; training fiction only |

Software security PASS on P0 does **not** imply authorization for C–E.

---

## 12. Final decision

### **CONDITIONAL GO**

**Conditions (all required before upgrading to GO for scopes A–B closure / before considering C):**

1. **Merge and deploy PR #235** (rebase onto `main` first) so production includes P1 remediations.
2. **Re-verify on production** after #235: Admin MFA deny-without-AAL2, SSE sanitized errors, risk `NOT_APPLICABLE` / Arabic stem, Wave-3 AR present, `next@16.3.6`.
3. **Record first successful post-`d4a5992` (and post-#235 if deployed) `expire-sessions.yml` scheduled run** — currently **WAITING**.
4. Keep **scope ≤ B** until institutional pilot criteria are met separately.

**Would be NO-GO if:** live HMAC were absent, production SHA ≠ claimed commit, or forgery tests failed. Those blocking P0 issues are **cleared**.

**Would be unconditional GO only if:** P1 were live on production and post-deploy cron verified — **not true at this timestamp**.

---

## 13. Certification matrix

| Domain | Status | Evidence | Residual Risk |
|--------|--------|----------|---------------|
| Authentication | **PASS** | Unauth API 401; Supabase Auth session gate in middleware | Password-only admins until MFA enforced |
| Authorization | **PASS** | Role in `profiles.role`; `requireAdmin` / `requireApiAdmin`; therapist ownership on sessions | Institution-manager breadth is tenant session read, not reports |
| Admin MFA | **PARTIAL** | Role check only on `d4a5992`; AAL2 code only on PR #235 | Admin AAL1 bypass until #235 deployed + factors enrolled |
| RLS | **PASS** | Live policies: user-only message insert; admin-only reports | Ongoing need to keep `(select auth.uid())` patterns on new policies |
| Database security | **PASS** | SECURITY DEFINER + Vault HMAC + grants; migration `20260925120000` | Service-role power if ever leaked |
| Message integrity | **PASS** | Live HMAC functions; `_phase85` + `_phase86a` matrices all PASS | Depends on Vault key remaining configured |
| Transcript integrity | **PASS** | Therapist cannot forge assistant/system without valid `p_sig`; RLS blocks non-user inserts | User turns remain client-insertable by design (ownership-scoped) |
| Assessment integrity | **PASS** | `end` route loads `session_messages` → `assessSession` → signed `create_session_report`; poisoned assistant/system rows blocked by HMAC | Therapist can still shape **user** turns (expected); cannot forge patient/system lines |
| Clinical-training safety | **PARTIAL** | Risk heuristic still EN-biased; auto-critical on absent inquiry on prod | Misleading critical findings; not clinical validation |
| Arabic/English parity | **PARTIAL** | UI `localeDirection` RTL; messages ~parity (1 EN-only key); prod evaluator/examiner Wave-3/risk not AR-complete; no fresh live bilingual E2E this cert | Training fairness drift EN vs AR until #235 |
| Privacy | **PASS** | Reports admin RLS; no `NEXT_PUBLIC` secrets for write keys; health JSON has no infra secrets | Server logs may still contain `err.message` (server-side) |
| Exports | **PASS** | VQI/PDF export paths under admin API auth; reports not exposed to therapists | Confirm institution-manager never gains report export without explicit product decision |
| API security | **PASS** | Auth → rate limit → validate pattern on message route (`msg` 120/hr); admin gates | Rate limit in-memory fallback if Upstash unset |
| Error handling | **PARTIAL** | `sanitizeDbError` / denylist present; SSE raw `err.message` on prod | Information leakage until #235 |
| Rate limiting | **PASS** | Message and related routes call `rateLimit` before work | Horizontal scaling needs Upstash |
| Dependency security | **PARTIAL** | CI `audit:deps` PASS on `d4a5992`; `next@16.3.4` not yet `16.3.6` | Advisory range per P1 notes until upgrade |
| CI/CD | **PASS** | Main CI `36116690877` success; Vercel production READY | Draft #235 not in release train |
| Cron | **WAITING** | Last green schedule on `dfe118c` pre-deploy; no post-`d4a5992` run yet | Ops expiry lag until next tick proves green |
| Production deployment | **PASS** | `dpl_8kJcT2Mxx1Yn1m5LALcUa67goSzY` READY at `d4a5992` | — |
| Production smoke test | **PASS** | Health 200; auth 401; HMAC live matrix; Phase 8.6A CLEAR | Cron smoke still WAITING |

---

## 14. Documentation cross-check

| Document | Trust vs evidence |
|----------|-------------------|
| `docs/PHASE7_RELEASE_PROTOCOL.md` | Process doc — not re-litigated; no conflict with this cert |
| `docs/PHASE7_RELEASE_INCIDENTS.md` | Historical — no blocking conflict |
| `docs/PHASE8_P0_P1_VERIFICATION.md` | Branch/commit evidence of P0 CONFIRMED VULNERABLE (pre-8.5) — **superseded for P0** by live HMAC; P1 items still accurate for **production** |
| `docs/PHASE8_P0_REMEDIATION.md` | On `main` — aligns with deployed #234 |
| `docs/PHASE8_P1_REMEDIATION.md` | Describes branch fixes — **not** production state |
| `docs/PHASE8_SECURITY_REGRESSION.md` | Pre-HMAC-apply BLOCKED on live DB — **superseded** by 8.5 CLEAR |
| `docs/PHASE8_PRODUCTION_SMOKE_TEST.md` | Historical smoke — health re-confirmed this cert |
| `docs/PHASE8_5_PRODUCTION_HMAC_VERIFICATION.md` | Live results table still present and PASS — **aligned** |
| `docs/PHASE8_6_DEPLOYMENT_ALIGNMENT.md` | Deploy id/SHA/health/HMAC — **aligned**; cron noted pending — **aligned** |

---

## 15. Non-claims (explicit)

This certification does **not** claim or imply:

- Real-patient clinical diagnosis or treatment readiness  
- Autonomous clinical decision-making  
- Psychometric / competency score validation  
- Professional licensure or credentialing  
- That PR #235 P1 fixes are live in production  

Product scope certified (conditionally): **AI standardized-patient therapist training using fictional training cases**, software-security posture as of the timestamp above.

---

## 16. Sign-off

| Item | Value |
|------|-------|
| Gate | Phase 8.6 Final Production Security & Release Certification |
| Decision | **CONDITIONAL GO** |
| Production commit | `d4a59927cd48c2938773132ccb8cf8a17b308b4f` |
| Deployment | `dpl_8kJcT2Mxx1Yn1m5LALcUa67goSzY` |
| P0 message integrity | **PASS** (CLEAR) |
| P1 on production | **PARTIAL** (PR #235 not merged) |
| Cron post-deploy | **WAITING** |
| Supported scopes | **A**, **B (conditional)** — not C/D/E |
| Timestamp (UTC) | `2026-09-25T09:18:00Z` |

**Evidence > documentation.** Blocking P0 issues are closed on live production; open P1 and waiting cron prevent unconditional GO.
