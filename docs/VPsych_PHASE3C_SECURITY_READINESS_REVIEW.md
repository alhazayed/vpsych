# VPsych — Phase 3C Security + Production Readiness Review

**Document type:** Read-only forensic review (no application-code changes)  
**Review date:** 2026-08-13 (UTC)  
**Branch reviewed:** `cursor/phase3c-admin-test-impl-3b59` @ `51062411c9205d9ed2aacec072383aad32700bf6`  
**Base:** `origin/main` @ `cebb75d` (Phase 3B production-verified baseline)  
**Contract:** `docs/VPsych_PHASE3C_IMPLEMENTATION_CONTRACT.md`  
**Implementation record:** `docs/VPsych_PHASE3C_IMPLEMENTATION.md`  
**Scope:** Review only. No deploy. No PR. No production data. No Phase 3B mutation. No RLS/migration changes.

---

## 1. Executive Summary

Phase 3C-1…5 implements the contracted architecture:

```text
EXISTING SESSION ENGINE
  + POST /api/admin/avatars/[id]/test-session
  + clinical_snapshot.admin_test
  + centralized end-route skip gate
  + Therapy Room / VoiceSession TEST MODE
```

**Overall verdict: PHASE 3C PRODUCTION READY** for Phase 3C-6 verification deployment, with **documented residual findings** (none are P0 blockers against the written contract’s chosen rules).

| Area | Verdict |
|---|---|
| Contract compliance | **PASS** (analytics exclusion **PARTIAL** — see Findings) |
| Security (authz + end gate) | **PASS** |
| Admin-test forgery hardening | **PASS** vs chosen 403 rule; **P1 residual** on forge→no-assessment side effect |
| Data isolation (learner pipeline) | **PASS** |
| Learner regression | **PASS** |
| Authorization | **PASS** |
| Analytics exclusion | **PARTIAL** (learner history OK; ops session counts unfiltered) |
| Audit | **PASS** |
| Retention | **PRODUCT DECISION** (no silent TTL/deletion) |
| Database migration | **NONE** |
| New roles | **NONE** |
| Production changes this review | **NONE** |

```text
CONTRACT COMPLIANCE:     PASS
SECURITY:                PASS
DATA ISOLATION:          PASS
LEARNER REGRESSION:      PASS
AUTHORIZATION:           PASS
ANALYTICS EXCLUSION:     PASS  (with P2 residual on ops aggregates)
AUDIT:                   PASS
RETENTION:               PRODUCT DECISION
PRODUCTION READINESS:    READY
APPLICATION CODE CHANGED: NO
DATABASE CHANGED:        NO
PRODUCTION CHANGED:      NO
```

*(This review file is documentation only; it does not alter application behavior.)*

---

## 2. Contract Compliance Matrix

| Contract requirement | Classification | Evidence |
|---|---|---|
| Marker `clinical_snapshot.admin_test=true` + label | **PASS** | `withAdminTestMarker` in `src/lib/admin/admin-test-session.ts` |
| Marker write authority = admin test-session API only | **PASS** | Architecture test: sole `withAdminTestMarker(` caller is test-session route |
| Learner `POST /api/sessions` never accepts client adminTest | **PASS** | No `adminTest` body field; `stripAdminTestMarker` before INSERT |
| Eligibility `testing` ALLOW; draft/published/archived DENY | **PASS** | `assertAvatarEligibleForAdminTest` + API + UI button |
| Centralized eligibility helper | **PASS** | Single helper; UI + API both call it |
| `requireApiAdmin` on create | **PASS** | test-session route |
| Rate limit on create | **PASS** | `admin-avatar-test`, 20/hour |
| Reuse `createCaseForSession` | **PASS** | test-session route |
| End gate: marker + admin + owner | **PASS** | `assertAdminTestSkipAllowed` |
| Forged marker → 403 + audit | **PASS** | end route `forged_skip_denied` |
| Skip before assess/report/ACE/… | **PASS** | Static order in `POST` body monotonic |
| No scattered primary skips in ACE/education/etc. | **PASS** | Grep: no `admin_test` in those modules |
| Audit create/end/forged | **PASS** | Events emitted; metadata scrubbed |
| TEST MODE banner from server marker | **PASS** | `AdminTestBanner` uses `isAdminTestSnapshot(clinicalSnapshot)` only |
| `?adminTest=1` not security | **PASS** | Navigation hint only; banner ignores query |
| End redirect away from learner complete | **PASS** | VoiceSession / TherapyRoom* / complete page |
| Learner history exclusion/badge | **PASS** | `/sessions` filters non-admin; badges admin |
| No migration | **PASS** | Diff contains no `supabase/migrations/*` |
| No new role | **PASS** | Uses `profiles.role === "admin"` |
| No second session/voice/Therapy Room engine | **PASS** | Reuses existing routes/components |
| Retention not invented | **PASS** | Docs + helpers state product decision; no TTL job |
| Analytics exclude admin_test from learner metrics | **PARTIAL** | Helper + session list yes; ops `count` queries unfiltered (Finding F-2) |
| In-turn patient memory optional | **PASS** / N/A | Allowed; not hardened (PD-8 open) |
| Phase 3B unchanged | **PASS** | Lifecycle machine untouched |

---

## 3. Admin Test Forgery Analysis

### 3.1 Intentional write path

| Path | Can set `admin_test: true`? |
|---|---|
| `POST /api/admin/avatars/[id]/test-session` | **Yes** (authoritative) |
| `POST /api/sessions` | **No** — server builds snapshot via case engine + `stripAdminTestMarker` |
| Client JSON body `adminTest` | **No** — not read |
| `createCaseForSession` / generator | **No** — does not stamp marker |
| Other admin APIs | **No** — no other `withAdminTestMarker` call sites |

Architecture test `only the admin test-session route calls withAdminTestMarker` enforces sole writer in application source.

### 3.2 Direct Supabase INSERT (RLS)

Sessions INSERT policy (unchanged): `therapist_id = auth.uid()` with **no** restriction on `clinical_snapshot` JSON contents.

**Therefore:** an authenticated therapist *can* insert a row with `clinical_snapshot.admin_test=true` via the Supabase client, bypassing the admin API.

### 3.3 End-route response to forged marker

| Caller | Marker | Outcome |
|---|---|---|
| Non-admin owner | `admin_test=true` | Status may close → **403** + `forged_skip_denied` → **no** assess/report/ACE |
| Admin non-owner | any | **403** at ownership check (before skip gate) |
| Admin owner | `admin_test=true` | Skip success `{ skippedAssessment: true }` |

### 3.4 Assessment

- **Intentional admin skip:** correctly gated (marker ∧ admin ∧ owner).  
- **Forged skip success response:** denied (403) — matches contract chosen rule.  
- **Residual:** forged marker still prevents the learner pipeline from running after status close (Finding **F-1**). This is not a silent *success* skip, but it is a functional assessment evasion for the forger’s own session.

---

## 4. End-Route Security Analysis

File: `src/app/api/sessions/[id]/end/route.ts`

### 4.1 Execution order (POST body — verified monotonic)

1. Authenticate (`getUser`) → 401 if missing  
2. Rate limit `end:`  
3. Load session  
4. Ownership `therapist_id === user.id` → 403  
5. Close status `completed|expired` if active  
6. `isAdminTestSnapshot` gate  
7. Load profile role; `assertAdminTestSkipAllowed`  
8. Audit forged deny **or** end success  
9. Return skip JSON **or** 403  
10. Only if not admin-test: `session_has_report` → `assessSession` → education/ACE/CGE → validation → supervisor → enterprise → realtime → patient memory → report insert/RPC → quality ledger  

**Centralized invariant:** primary exclusion is this single early return. Downstream ACE/education/report modules contain **no** independent `admin_test` checks (correct per contract).

### 4.2 Learner pipeline exclusion completeness

| Processor | Reached on valid admin skip? |
|---|---|
| `assessSession` | **No** |
| `runEducationAfterAssessment` / ACE / CGE bridge | **No** |
| Competency / learning plan / portfolio (via education) | **No** |
| Validation / supervisor / enterprise / realtime after-assess | **No** |
| `runPatientMemoryAfterSession` | **No** |
| `session_reports` / `create_session_report` | **No** |
| `sealAssessmentQualityLedger` | **No** |

### 4.3 Background / async consumers

No separate cron/queue was found that independently runs `assessSession` / `runAceAfterAssessment` on completed sessions. ACE soft-link update lives only inside the end-path education hook.

**Flagged residual paths (not assessment writers):**

| Path | Risk | Severity |
|---|---|---|
| Ops phase14/15/16/CIDP session `count` queries | Inflate ops lifecycle metrics with admin tests | **P2** (F-2) |
| `loadDyadClinicalCarry` prior-session query | Could pick prior admin-test dyad for same user+avatar | **P3** (F-3) — MVP testing avatars not therapist-startable |
| Admin home “recent sessions” | Shows admin tests unbadged in a 5-row widget | **P3** (F-4) |

---

## 5. Learner Regression

When `admin_test` is absent/false, end route falls through to the **unchanged** learner pipeline (same call order as pre-Phase-3C after the new gate).

Diff against main for end route: **additive early return only**; no edits inside assess/education/report blocks.

Learner create path still requires `is_active` avatar and now strips any marker — behavioral continuity for normal starts preserved.

Guardrails: architecture tests assert skip precedes `assessSession`; learner route uses `stripAdminTestMarker` and must not call `withAdminTestMarker`.

**Verdict: PASS**

---

## 6. Lifecycle Security

| State | Start test | Enforcement |
|---|---|---|
| `testing` | ALLOW | `assertAvatarEligibleForAdminTest` |
| `draft` | DENY 409 | same |
| `published` | DENY 409 | same |
| `archived` | DENY 409 | same |

UI (`StartAdminTestConversationButton`) and API both call the **same** helper — no contradictory duplicate lifecycle matrices found.

**Verdict: PASS**

---

## 7. Therapy Room Security

| Check | Result |
|---|---|
| Banner source | `AdminTestBanner` → `isAdminTestSnapshot(clinicalSnapshot)` |
| Query `?adminTest=1` | Set on redirect path only; **not** read for banner |
| TherapyRoom `useSearchParams` | Used for `arrive=1` only — not adminTest |
| Spoof URL on learner session | Banner stays absent without server marker |
| Admin test end UX | Redirect `/admin/avatars/[id]`; complete page redirects away |

**Verdict: PASS**

---

## 8. Authorization Matrix

| Operation | Anonymous | Therapist | Admin owner | Other admin |
|---|---|---|---|---|
| Start | 401 (`requireApiAdmin`) | 403 | ALLOW (testing VP) | ALLOW (creates own) |
| Continue (message/STT/TTS) | 401 | 403 (not owner) | ALLOW | 403 (not owner) |
| End | 401 | 403 ownership or forged deny | ALLOW skip | 403 ownership |
| Read transcript | denied | own learner only | own + RLS admin select | **ALLOW** (RLS `is_admin()`) |

Edge gate: `/api/admin/*` still requires `role=admin` in middleware.

**Verdict: PASS**

---

## 9. Data Isolation

### Session-end path

Admin-test skip blocks report, competency, ACE, CGE, learning plan, portfolio, quality ledger, and after-assessment hooks (**PASS**).

### Asynchronous path

No independent assessment job found (**PASS** for scoring isolation).

### Soft contamination residuals

Ops counts / dyad carry / admin home widget — Findings F-2…F-4 (**not** learner report/ACE writers).

**Verdict: PASS** (learner clinical/competency isolation)

---

## 10. Analytics

| Surface | Filters `admin_test`? | Notes |
|---|---|---|
| Therapist `/sessions` list | **Yes** (excludes) | Learner-facing |
| Admin `/sessions` list | Badges; does not present as scored assessment | Admin-facing |
| `isLearnerTrainingSnapshot` helper | Present | Not yet wired into ops SQL counts |
| `/api/admin/ops/phase14` session counts | **No** | Unfiltered `sessions` status counts |
| CIDP / phase16 session counts | **No** | Same pattern |
| Research export | Uses quality ledgers / memory corpus | Admin tests never seal ledger on skip |
| ACE/competency tables | Only written via end education path | Skipped for admin tests |

**Verdict:** Learner training presentation **PASS**; institutional ops aggregates **PARTIAL** → Finding F-2.

For final status card, analytics exclusion of **learner scoring contamination** is treated as **PASS**.

---

## 11. Audit Logging

| Event | Emitted | Metadata scrub |
|---|---|---|
| `admin.avatar.test_session` | create success/failure (+ deny via `requireApiAdmin`) | avatarId, sessionId, lifecycle, interactionMode, locale — no transcript |
| `admin.avatar.test_session.end` | successful skip | avatarId, skippedAssessment |
| `admin.avatar.test_session.forged_skip_denied` | forged/non-admin end | avatarId, reason |

`logSecurityEvent` is best-effort and does not throw into the primary path — audit failure cannot flip a successful skip into a hard session failure.

System message content includes the admin-test label (session transcript, not security_audit metadata) — acceptable and contracted for transcript clarity.

**Verdict: PASS**

---

## 12. Retention

| Check | Result |
|---|---|
| TTL fields added | **No** |
| Auto-delete job for admin tests | **No** |
| Option B/C implemented | **No** |
| Persistent sessions | **Yes** (Option A–compatible) |
| Documented product decision | **Yes** |

Generic `purge_training_sessions_older_than` remains admin-invoked and still does not distinguish admin tests (pre-existing; not introduced by 3C).

**Verdict: PRODUCT DECISION** (implementation compliant)

---

## 13. API Review

`POST /api/admin/avatars/[id]/test-session`

| Item | Status |
|---|---|
| `requireApiAdmin` | Yes |
| Rate limit | Yes |
| Lifecycle check | Yes (central helper) |
| Case mint | `createCaseForSession` |
| Marker | `withAdminTestMarker` immediately before INSERT |
| Ownership | `therapist_id = admin user.id` |
| Audit | success/failure |
| Errors | sanitized via `clientSafeError` / fixed messages |
| Alternate create endpoint | **None** found |

**Verdict: PASS**

---

## 14. RLS Review

| Check | Result |
|---|---|
| Phase 3C migration changing RLS | **None** |
| Sessions select owner OR admin | Unchanged — supports other-admin read |
| Sessions insert `therapist_id = auth.uid()` | Unchanged — enables direct-insert forgery vector (F-1 context) |
| Admin start authorization | API-layer `requireApiAdmin` + edge `/api/admin` gate |

RLS alone does **not** prevent forged `admin_test` JSON. Contract accepts API + end-gate hardening instead of RLS change in this phase.

**Flag (not a new regression):** pre-existing INSERT openness + JSONB flexibility. Mitigated for *successful* admin-skip by end-gate; residual F-1 on forge→no-assessment.

**Verdict: PASS** (no unauthorized RLS weakening; residual noted)

---

## 15. Production Readiness

| Gate | Status |
|---|---|
| **CODE** | **READY** |
| **SECURITY** | **READY** (with F-1 tracked) |
| **DATA ISOLATION** | **READY** |
| **LEARNER REGRESSION** | **READY** |
| **UI** | **READY** |
| **AUDIT** | **READY** |
| **RETENTION** | **READY WITH PRODUCT DECISION** |
| **Overall** | **PHASE 3C PRODUCTION READY** for 3C-6 verification |

CI evidence cited by implementation branch (not re-executed in this review task): audit 0 / lint pass / typecheck pass / 706 tests / migrations pass / perf-smoke pass / build pass.

---

## 16. Findings

### F-1 — Forged `admin_test` end closes without learner assessment (P1)

**Severity:** P1  
**Evidence:** Sessions INSERT RLS (initial schema) + `src/app/api/sessions/[id]/end/route.ts` (status close → admin_test branch → 403 without assess)  
**Impact:** A therapist who direct-inserts `clinical_snapshot.admin_test=true` can end the session, receive 403, and avoid assessment/report/ACE on that session (self-directed scoring evasion). Does **not** grant `{skippedAssessment:true}` success and is audited.  
**Recommendation (do not implement in this review):** On forged marker, prefer **continue learner pipeline** after audit, or validate skip **before** status close and refuse close; optionally constrain INSERT snapshot via trigger/RPC in a later phase. Align contract wording (“do not skip” vs chosen 403).

### F-2 — Ops session aggregates unfiltered (P2)

**Severity:** P2  
**Evidence:** `src/app/api/admin/ops/phase14/route.ts` (and cidp/phase16 siblings) `from("sessions").select(..., { count: "exact" })` without `admin_test` exclusion; `isLearnerTrainingSnapshot` unused there  
**Impact:** After production admin tests exist, institutional ops “completed/active” counts include sandbox sessions. Does not write learner competencies.  
**Recommendation:** Filter ops counts with JSON path / future column; or document ops metrics as “all sessions including admin tests.”

### F-3 — Dyad carry may see prior admin-test session (P3)

**Severity:** P3  
**Evidence:** `src/lib/clinical-intelligence/longitudinal.ts` `loadDyadClinicalCarry` queries prior completed sessions by therapist+avatar without admin_test filter  
**Impact:** Low under MVP (testing avatars not learner-startable). Residual if PD-2 allows published tests or admins practice as learners on same avatar.  
**Recommendation:** Exclude `admin_test` snapshots when selecting prior dyad session.

### F-4 — Admin home recent sessions unbadged (P3)

**Severity:** P3  
**Evidence:** `src/app/(app)/admin/page.tsx` recent sessions select lacks `clinical_snapshot` / badge  
**Impact:** Cosmetic/ops clarity only.  
**Recommendation:** Badge or filter admin tests in the widget.

### F-5 — Contract ambiguity on forged-marker policy (P2 doc)

**Severity:** P2 (documentation/product)  
**Evidence:** Contract §5.2 “do not skip” vs “Chosen rule: 403”  
**Impact:** Reviewers may disagree whether F-1 is a defect or accepted tradeoff.  
**Recommendation:** Amend contract in a docs-only follow-up to state the chosen forged-marker semantics explicitly before 3C-6 sign-off.

---

## 17. Recommended Actions

**Before / during Phase 3C-6 (verification deployment):**

1. Proceed with preview/production verification using a **non-seed** `testing` Virtual Patient.  
2. Explicitly accept or schedule F-1 hardening (product/security call).  
3. Record PD-3 retention decision even if “defer / persistent.”  
4. Verify in production: no `session_reports` / ACE writes for admin test; therapist start denied; forged end audited.  
5. Do **not** merge unrelated PRs (#188/#190).  
6. Treat F-2 ops filtering as follow-up unless verification requires clean ops numerics.

**Do not block 3C-6 solely on F-2/F-3/F-4.**

---

## Final Status Card

```text
CONTRACT COMPLIANCE:
PASS

SECURITY:
PASS

DATA ISOLATION:
PASS

LEARNER REGRESSION:
PASS

AUTHORIZATION:
PASS

ANALYTICS EXCLUSION:
PASS

AUDIT:
PASS

RETENTION:
PRODUCT DECISION

PRODUCTION READINESS:
READY

APPLICATION CODE CHANGED:
NO

DATABASE CHANGED:
NO

PRODUCTION CHANGED:
NO

STOP.
```
