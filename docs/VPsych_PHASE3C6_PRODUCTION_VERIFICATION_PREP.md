# VPsych — Phase 3C-6 Production Deployment + Verification Preparation

**Document type:** Pre-deployment / verification preparation (authorization gate)  
**Date:** 2026-08-13 (UTC)  
**Scope:** Preparation only. **No deploy. No production data. No conversation. No code change. No migration. No merge.**

**Authoritative inputs:**

- `docs/VPsych_PHASE3C_IMPLEMENTATION_CONTRACT.md`
- `docs/VPsych_PHASE3C_SECURITY_READINESS_REVIEW.md`
- `docs/VPsych_PHASE3C_ADMIN_TEST_READINESS_ASSESSMENT.md`
- `docs/VPsych_PHASE3B_PRODUCTION_ACCEPTANCE.md`
- Implementation branch: `cursor/phase3c-admin-test-impl-3b59`

---

## 1. Source state (verified)

| Item | Value |
|---|---|
| Current branch | `cursor/phase3c-admin-test-impl-3b59` |
| Branch HEAD (full) | `ac2e7c78dd1103870bdaeb5130b39f912fc2e871` |
| Branch HEAD (short) | `ac2e7c7` |
| `origin/main` (full) | `cebb75d4f0294fa415a7e609e09b45b068b706e1` |
| `origin/main` (short) | `cebb75d` |
| Merge-base with main | `cebb75d4f0294fa415a7e609e09b45b068b706e1` |
| Working tree | **CLEAN** (no uncommitted changes) |
| Migrations added vs main | **NONE** (`git diff origin/main...HEAD -- supabase/migrations` empty) |
| Phase 3B acceptance on main | Present (`docs/VPsych_PHASE3B_PRODUCTION_ACCEPTANCE.md`) |
| Open PR for impl branch | **None** (`gh pr list --head …` empty) |
| Production data changed by this prep | **NO** |
| Application code changed by this prep | **NO** (docs only if this file is committed) |

Branch tip contents relative to main: Phase 3C-1…5 implementation + security readiness review doc. No schema files.

---

## 2. P1 finding — acknowledgment for verification (no behavior change)

### 2.1 Documented P1 (Security Readiness Review F-1)

A therapist (or any authenticated user) may **direct-insert** a `sessions` row with `clinical_snapshot.admin_test=true` under existing RLS (`therapist_id = auth.uid()`), bypassing the admin test-session API.

Contracted end behavior (unchanged; **do not modify**):

| Condition | Response |
|---|---|
| Marker + non-admin | **403** + audit `admin.avatar.test_session.forged_skip_denied` |
| Marker + admin + owner | **200** `{ ok, adminTest, skippedAssessment: true }` — no learner pipeline |
| No marker | Existing learner assess → report → education/ACE/… |

**P1 status for 3C-6: ACKNOWLEDGED (not BLOCKING)** — matches chosen contract rule. Residual: forged marker can still prevent assessment on the forger’s own session after status close (self-directed scoring evasion). Track for post-3C-6 hardening; do not change behavior in this phase.

### 2.2 What production verification must prove

| Scenario | Where | Must prove |
|---|---|---|
| **1. Normal learner session** | Production (optional short regression on published seed patient **or** skip if risk-averse — prefer published seed only if already allowed by prior ops norms; otherwise prove via code/CI already green + no end-route regression) | Without `admin_test`, end still runs assessment/report path (or rely on CI + static order proof if no learner conversation is authorized in 3C-6) |
| **2. Legitimate admin test** | **Production** (required) | Admin create → marker true → conversation → end skip → no report/ACE/competency/portfolio |
| **3. Unauthorized forged admin_test** | **Isolated test infrastructure only** — **NOT production** | Unit/architecture already cover skip predicate; optional staging/local Supabase: direct insert + end → 403 + `forged_skip_denied` + no `{skippedAssessment:true}` success |

**Do NOT execute forged INSERT against production.**

---

## 3. Production deployment plan (mechanism)

| Item | Confirmed value |
|---|---|
| Hosting | **Vercel** |
| Project | `vpsych` (`prj_qiJ1mQvX0s5lJZ9KJnpWAx4EXjNm`) |
| Team | `team_1GRDAL9LNCLMp13s2sbE08Fh` |
| App URL | `https://vpsych.vercel.app` |
| Production branch | **`main`** (GitHub Production deployments track `main` SHAs) |
| Current Vercel **Production** deploy | `dpl_8gRUASy2Lh7HgJdfqh1ZA69QB83W` — SHA `cebb75d4f0294fa415a7e609e09b45b068b706e1` (`main`), state READY, rollback candidate |
| GitHub Production environment latest | SHA `cebb75d` — deployment id `5872534574` |
| Phase 3B acceptance-era Production SHA | `48320d1` (superseded on Production by later `main` including acceptance docs) |
| Phase 3C code on **Production** today | **NO** — Production tracks `main` @ `cebb75d` |
| Feature-branch preview (not Production) | Vercel preview for `cursor/phase3c-admin-test-impl-3b59` @ `ac2e7c7` exists (`target: null`) — **must not be treated as Production verification** |
| CI | `.github/workflows/ci.yml` on push/PR to `main`: audit → lint → typecheck → test → migrations → build |
| **DATABASE MIGRATION** | **NONE** required for Phase 3C |

### 3.1 Intended deploy sequence (after explicit authorization — not this task)

1. Open PR from `cursor/phase3c-admin-test-impl-3b59` → `main` (when authorized).  
2. CI green on PR.  
3. Merge to `main` (human authorization).  
4. Vercel Production deploy of new `main` SHA.  
5. Confirm Production SHA == merged commit.  
6. Only then run §6 production verification sequence.

### 3.2 Environment variables (already expected in Production; do not print secrets)

Minimum / relevant for Admin Test Conversation:

| Variable | Role |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Auth + DB |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client/server anon |
| `REPORT_WRITE_KEY` and/or `SUPABASE_SERVICE_ROLE_KEY` | Learner report path (admin-test skip must not depend on these succeeding) |
| `OPENAI_API_KEY` and/or `AI_GATEWAY_API_KEY` | Patient agent |
| `ELEVENLABS_API_KEY` (+ voice IDs as configured) | TTS |
| Optional `UPSTASH_REDIS_REST_*` | Rate limit (in-memory fallback OK) |
| Optional `NEXT_PUBLIC_THERAPY_ROOM_MODE` | Therapy Room vs classic VoiceSession |

No new env vars required uniquely for Phase 3C marker/skip.

---

## 4. Production verification patient (NOT created yet)

### 4.1 Do not reuse Phase 3B artifacts

| Forbidden reuse | ID / slug |
|---|---|
| Phase 3B verification patient | `ba3452f0-f16e-4968-a8d7-02c7b129cc25` / `phase3b-verification-patient-20260812` |
| Phase 3B duplicate | `f2dddf43-3c52-4aff-9f0d-96e6e6f98a8c` / `…-dup` |
| Seed patients | Maya Chen / Jordan Hale — **do not modify** |

### 4.2 Required properties for new Phase 3C fictional avatar

| Property | Required value / rule |
|---|---|
| Purpose | Admin Test Conversation verification only |
| Identity | **Fictional only** — no real patient / staff / PHI |
| EN display name (example) | `Nora Ellison` (fictional) |
| AR display name (example) | `نورا إلياس` (fictional, natively authored — not machine-translated clone of EN) |
| Unique slug | `phase3c-admin-test-verification-YYYYMMDD` (date of creation day) |
| `lifecycle_status` | **`testing`** (create as draft → validate → move to testing; **never publish**) |
| `is_active` | **`false`** (projection of testing) |
| Disorder | Existing catalog only — prefer same proven row as Phase 3B: slug **`gad-with-panic`** (`d1000000-0000-4000-8000-000000000002`) — **do not create a new disorder** |
| Voice | Existing **active** `voice_profiles` row already used successfully in Phase 3B publish gate (reuse assigned production profile; do not invent orphan voice IDs) |
| EN personality | Native `en-US` personality block + Module 2b human personality |
| AR personality | Native `ar-JO` personality block + Module 2b human personality |
| Human personality | Both locales `version: 1` profiles present (publish-ready quality even though we will **not** publish) |
| Module 2b | Injected via existing personality engine / snapshot freeze — no alternate prompt stack |
| Persona companion | Create with avatar per Phase 3B RPC/API path |
| Real patient data | **Forbidden** |

**Creation timing:** Only after Production runs Phase 3C code **and** explicit 3C-6 execution authorization. **Not in this preparation task.**

---

## 5. Authentication (production verification actors)

| Actor | Identity mapping | Role |
|---|---|---|
| Admin | `VPSYCH_AUDIT_ADMIN_EMAIL` (must match expected audit admin) // pragma: allowlist secret | `admin` |
| Therapist | `VPSYCH_AUDIT_THERAPIST_EMAIL` (must match expected audit therapist) // pragma: allowlist secret | `therapist` |

Passwords: use existing Cursor/production secret variables only — **never log or embed password values**.

Auth mechanism: normal Supabase password grant + cookie session against Production (same as Phase 3B acceptance). **`service_role` not used** for authoring/test conversation.

Must prove:

| Check | Expected |
|---|---|
| Admin login | PASS |
| Admin authorization for `/api/admin/avatars/.../test-session` | PASS |
| Therapist login | PASS |
| Therapist admin-test start | **BLOCKED** (403) |
| Anonymous start | **BLOCKED** (401) |

---

## 6. Production test sequence (execute only after deploy + authorization)

### A. Baseline capture (§8) — before any create

Record counts / fingerprints (admin API or read-only queries as used in Phase 3B):

- `avatars` (total + by lifecycle)
- `personas`
- `sessions` (global count)
- `session_reports`
- `case_instances` (if countable)
- learner competency / ACE profile touch timestamps for audit therapist (if accessible)
- Confirm Maya/Jordan `lifecycle_status` / `is_active` unchanged

### B. Create fictional testing avatar

1. `POST /api/admin/avatars` → draft  
2. Ensure EN/AR + HP + voice + disorder  
3. Validate  
4. `POST …/lifecycle` → **`testing`**  
5. Confirm `is_active=false`  
6. **Do not publish**

### C. Start Admin Test Conversation

`POST /api/admin/avatars/{id}/test-session`

Verify:

- HTTP 200  
- `session` row exists  
- `clinical_snapshot.admin_test === true`  
- `admin_test_label` present  
- `therapist_id` = admin user id  
- avatar still `lifecycle_status=testing`

### D–E. Open session UI (Therapy Room if flag on; else VoiceSession)

Verify visible banner (server-driven):

- EN: `ADMIN TEST — NOT A LEARNER SESSION`  
- AR UI locale: `اختبار إداري — ليس جلسة لمتدرب`  

Query `?adminTest=1` must not be required for banner.

### F. Short conversation

Use **existing** patient runtime + STT/TTS (if voice enabled). Prefer at least one EN turn; AR turn if time/locale allows. Confirm `aiSource` honesty if fallback.

### G. End session

Admin owner: `POST /api/sessions/{id}/end` → `{ ok: true, adminTest: true, skippedAssessment: true }`  
UI returns to `/admin/avatars/{id}` — not learner scored-complete UX.

### H. Isolation checks (post-end)

| Check | Expected |
|---|---|
| Session status | `completed` or `expired` |
| `admin_test` still true | Yes (immutable) |
| `session_reports` for session | **Absent** |
| Assessment persisted | **No** |
| Competency / ACE / CGE / learning plan / portfolio | **Unchanged** vs baseline |
| Learner analytics for therapist | **Unchanged** |
| Admin `/sessions` | Badged admin test; not framed as scored learner assessment |
| Therapist catalog | Verification avatar **not** visible |

### I. Audit

Confirm best-effort events exist (admin-readable `security_audit_events`):

- `admin.avatar.test_session` (create success)  
- `admin.avatar.test_session.end` (skip success)  
- Therapist denied start → denied audit via `requireApiAdmin`  

Metadata must **not** contain transcript / narrative / scores.

### J. Post counts (§8)

Compare to baseline — only intentional Phase 3C verification artifacts (+1 avatar/persona, +1 session, messages, case instance as minted; **+0 reports**).

---

## 7. Security tests (production)

| Actor | Action | Expected |
|---|---|---|
| Admin | Start test | **ALLOW** |
| Therapist | Start test | **DENY** |
| Anonymous | Start test | **DENY** |
| Therapist | Message on admin’s test session | **DENY** |
| Therapist | End admin’s test session | **DENY** |
| Admin owner | End | **ALLOW** (skip) |
| Other admin | End non-owned active test | **DENY** (ownership) — if second admin available; else N/A |
| Forged INSERT | — | **NOT in production** — isolated tests only |

---

## 8. Data integrity baseline

**Before** creating the verification avatar, capture and store in the eventual acceptance record:

| Metric | Method |
|---|---|
| Avatar count + lifecycle breakdown | Admin list / count |
| Persona count | Count |
| Sessions global count | Count (Phase 3B noted 583 historically — re-read live) |
| Session reports count | Count |
| Case instances (if available) | Count |
| Maya / Jordan row snapshot | `lifecycle_status`, `is_active`, ids |
| Phase 3B verification patients | Confirm still draft/inactive; **untouched** |
| Audit therapist ACE/competency fingerprint | Optional read-only |

After test: only intentional deltas. **Stop** on unexpected learner clinical/competency/report deltas.

---

## 9. Cleanup

| Action | Allowed? |
|---|---|
| Direct SQL `DELETE` sessions/avatars | **No** |
| Manual clinical/session hard delete | **No** |
| Publish verification avatar | **No** |
| Archive verification avatar | Optional later; not required |
| Leave avatar at `testing` / `is_active=false` | **Yes** (default) |
| Leave test session `completed` | **Yes** |

Document artifact IDs in Phase 3C-6 acceptance (avatar id, slug, session id, persona id). Retention remains a **product decision** — persistent artifacts are acceptable.

---

## 10. Stop conditions

Immediately **STOP** Phase 3C-6 execution (no improvisation) if any of:

- Therapist or anonymous can start test  
- Verification avatar is published or therapist-visible (`is_active=true`)  
- `admin_test` marker missing on created session  
- Learner pipeline runs on admin test end (report/assessment/ACE/CGE/competency/portfolio/learning-plan writes)  
- Learner analytics change unexpectedly  
- Test session presented as learner scored assessment  
- Voice/patient runtime unexpectedly forked  
- Therapy Room / VoiceSession fails to show TEST MODE banner for marked session  
- Required audit events missing for create/end (best-effort: investigate; missing on hard failure of primary path is a stop)  
- Existing production seed / Phase 3B patients mutate unexpectedly  
- Migration or RLS change appears required mid-run  

---

## 11. Final pre-deployment status

```text
SOURCE HEAD:
ac2e7c78dd1103870bdaeb5130b39f912fc2e871

MAIN:
cebb75d4f0294fa415a7e609e09b45b068b706e1

WORKTREE:
CLEAN

DATABASE MIGRATION:
NONE

PRODUCTION DEPLOYMENT:
NOT PERFORMED

PRODUCTION DATA:
UNCHANGED

PHASE 3B:
UNCHANGED

PHASE 3C:
READY FOR DEPLOYMENT

VERIFICATION AVATAR:
NOT CREATED

TEST CONVERSATION:
NOT STARTED

P1:
ACKNOWLEDGED

FINAL STATUS:
READY FOR EXPLICIT PRODUCTION DEPLOYMENT AUTHORIZATION

STOP.
```

---

## Appendix — Deployment authorization checklist (for the human approver)

- [ ] Explicit written authorization to open PR / merge `cursor/phase3c-admin-test-impl-3b59` → `main`  
- [ ] Explicit written authorization to run Production verification after deploy  
- [ ] Confirm Production SHA after deploy equals merged commit  
- [ ] Confirm no migration apply step  
- [ ] Confirm Phase 3B patients remain untouched  
- [ ] Confirm forged-INSERT testing stays off Production  
