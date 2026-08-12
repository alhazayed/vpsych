# VPsych — Phase 3C Admin Test Conversation Implementation

**Status:** Implemented locally (3C-1…3C-5). **Not deployed.** Phase 3C-6 production verification **not started**.  
**Branch intent:** `cursor/phase3c-admin-test-impl-*` from Phase 3B-verified `main`.  
**Contract:** `docs/VPsych_PHASE3C_IMPLEMENTATION_CONTRACT.md`  
**Assessment:** `docs/VPsych_PHASE3C_ADMIN_TEST_READINESS_ASSESSMENT.md`  
**Phase 3B:** CLOSED / UNCHANGED  

**Retention policy remains a product decision.** This phase does not add TTL, purge jobs, or Option B/C deletion.

---

## 1. Architecture

```text
EXISTING SESSION ENGINE
  + POST /api/admin/avatars/[id]/test-session
  + clinical_snapshot.admin_test = true
  + VoiceSession / Therapy Room TEST MODE chrome
  + POST /api/sessions/[id]/end early skip (central gate)
```

No second session engine, Therapy Room, voice pipeline, or transcript stack.

---

## 2. Data isolation

| Item | Detail |
|---|---|
| Marker | `sessions.clinical_snapshot.admin_test === true` + `admin_test_label` |
| Writer | **Only** `POST /api/admin/avatars/[id]/test-session` via `withAdminTestMarker` |
| Learner create | `POST /api/sessions` calls `stripAdminTestMarker` — never accepts client `adminTest` |
| Helpers | `src/lib/admin/admin-test-session.ts` |
| Analytics | Use `isLearnerTrainingSnapshot` / `!isAdminTestSnapshot` to exclude from learner metrics |

---

## 3. API

| Method | Path | Role |
|---|---|---|
| `POST` | `/api/admin/avatars/[id]/test-session` | `requireApiAdmin`; testing lifecycle only; rate limit 20/h |
| `POST` | `/api/sessions/[id]/message` | Reused (owner) |
| `POST` | `/api/voice/transcribe` / `tts` | Reused |
| `POST` | `/api/sessions/[id]/end` | Reused + admin-test skip gate |
| `POST` | `/api/admin/avatars/[id]/preview` | Unchanged (non-persistent) |

---

## 4. Authorization

| Actor | Start | Continue | End | Read |
|---|---|---|---|---|
| Anonymous | 401 | 401 | 401 | 401 |
| Therapist | 403 | 403 (not owner) | 403 | own learner only |
| Admin owner | 200 | 200 | 200 skip | yes |
| Other admin | can start own | not owner → 403 | 403 | RLS admin select |

No new roles. No RLS migration in this phase.

---

## 5. Session end behavior

After status close:

1. If `admin_test` and admin owner → audit `admin.avatar.test_session.end` → `{ ok, adminTest, skippedAssessment: true }` → **STOP**
2. If `admin_test` and not admin → audit `…forged_skip_denied` → **403**
3. Else → existing learner assess / report / education / ACE / CGE / … unchanged

---

## 6. Therapy Room / VoiceSession TEST MODE

- Entry: Admin Virtual Patient detail → **Start Test Conversation** when `lifecycle_status === "testing"`
- Banner from **server** `clinical_snapshot.admin_test` (EN/AR strings)
- `?adminTest=1` is navigation hint only
- End redirects to `/admin/avatars/[id]` — not learner complete/report UX

---

## 7. Audit

| Action | When |
|---|---|
| `admin.avatar.test_session` | create success/failure/denied |
| `admin.avatar.test_session.end` | successful skip end |
| `admin.avatar.test_session.forged_skip_denied` | marker + non-admin |

Metadata: avatarId, sessionId, lifecycle, interactionMode, locale, skippedAssessment — **never** transcript/narrative/scores.

---

## 8. Analytics exclusion

- Therapist `/sessions` list **filters out** admin-test rows
- Admin `/sessions` list **badges** admin-test rows and links completed tests back to VP detail
- Helper `isLearnerTrainingSnapshot` for any future learner aggregate queries
- Quality-ledger research export is unchanged (admin tests never seal ledgers when skip holds)

---

## 9. Retention decision status

**PRODUCT DECISION REQUIRED.** Persistent admin-test sessions are allowed by existing architecture (Option A–compatible). No automatic deletion implemented.

---

## 10. Tests

- `src/lib/admin/admin-test-session.test.ts` — helpers, eligibility, skip predicate
- `src/lib/admin/admin-test-phase3c.architecture.test.ts` — sole writer, UI redirects, list filter
- `src/lib/architecture.test.ts` — end gate before `assessSession`; learner strip; create route invariants

---

## 11. Known limitations

- MVP eligibility: **testing only** (draft/published denied until product PD-1/PD-2)
- No dedicated admin test-history API (optional later)
- No session-level `is_admin_test` column (JSONB marker only — no migration)
- In-turn patient memory still allowed for runtime fidelity (PD-8 optional harden)
- Phase 3C-6 production verification not run in this task

---

## 12. Phase 3C-6 production verification plan

When authorized (separate task):

1. Deploy implementation branch to preview/production per release process  
2. Use a non-seed Virtual Patient in `testing`  
3. Admin start → message (EN/AR) → end → prove no `session_reports`, no ACE/competency writes  
4. Therapist denied start; forged skip denied  
5. Confirm Maya/Jordan and learner aggregates unchanged  
6. Record `docs/VPsych_PHASE3C_PRODUCTION_ACCEPTANCE.md`  

**Do not** treat this implementation doc as production acceptance.
