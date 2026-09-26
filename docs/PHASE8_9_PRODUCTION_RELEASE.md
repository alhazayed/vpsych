# Phase 8.9 — Production Release Record

**Date (UTC):** 2026-09-26  
**Status:** CLEAR  
**PR:** [#242](https://github.com/alhazayed/vpsych/pull/242)

---

## 1. PR #242

| Field | Value |
|-------|-------|
| Title | Phase 8.9: Admin MFA enroll/challenge UX (bootstrap fix) |
| Branch | `cursor/admin-phase8-9-mfa-ux-fc9c` |
| Head tip before merge | `50019b600ae3fe8127a258b623c5f75dc7f8b781` |
| Merge method | Merge commit |
| Merged at | 2026-09-26T06:14:56Z |
| State | MERGED |

CI on tip (pre-merge): SUCCESS — 3/3 (`verify`, Vercel, Preview Comments).

---

## 2. Final production commit

| Field | Value |
|-------|-------|
| `main` SHA | `db7c16b0333485cc6f3ebe5904bbef7cdcce2f90` |
| Subject | Merge pull request #242 from alhazayed/cursor/admin-phase8-9-mfa-ux-fc9c |

---

## 3. Vercel deployment

| Field | Value |
|-------|-------|
| Deployment ID | `dpl_GzX1uVxRs6udXvXa2XMuqGNbTgny` |
| Target | production |
| State | READY |
| Commit | `db7c16b0333485cc6f3ebe5904bbef7cdcce2f90` |
| Aliases | `vpsych.vercel.app`, `vpsych-git-main-…`, `vpsych-alhazayed-1540s-projects.vercel.app` |

---

## 4. Health check

`GET https://vpsych.vercel.app/api/health` → **200**  
`{"ok":true,"service":"vpsych","version":"1.0.0-rc.1",…}`

---

## 5. `/auth/mfa` production availability

| Request | Result |
|---------|--------|
| Unauthenticated `GET /auth/mfa` | **307** → `/login?next=/auth/mfa` (not 404) |
| Unauthenticated `GET /auth/mfa/enroll` | **307** → `/login?next=/auth/mfa/enroll` |
| Authenticated AAL1 admin, 0 verified factors → `/admin` | **307** → `/auth/mfa` → `/auth/mfa/enroll` |
| Authenticated AAL1 admin, ≥1 verified factor → `/admin` | **307** → `/auth/mfa` (challenge) |

Identity guard: `requireAdminIdentity()` (authenticated + `profiles.role = admin`); AAL2 not required on bootstrap routes.

---

## 6. MFA enrollment result

| Field | Value |
|-------|-------|
| Subject admin | Existing production admin (`8545be46-…`, Audit Admin class) |
| Starting verified factors | **0** |
| Method | Supabase Auth MFA enroll → challenge → verify (same APIs as in-app UI) |
| Friendly name | `vpsych-phase89b-prod` |
| Result | Factor **VERIFIED**; session **AAL2** |

Secrets (TOTP secret / QR / codes / tokens) were not written to logs or docs.

---

## 7. Verified factor count

| Scope | Before | After |
|-------|--------|-------|
| Production admins with ≥1 verified TOTP | **1/7** | **2/7** |
| Subject admin verified TOTP factors | 0 | **1** |

Remaining admins enroll themselves via `/auth/mfa/enroll` after password login. No automatic enrollment.

---

## 8. AAL1 denial

| Check | Result |
|-------|--------|
| AAL1 before enroll → `GET /api/admin/analytics` | **403** `MFA_REQUIRED` |
| Fresh AAL1 after logout → same API | **403** `MFA_REQUIRED` |
| After invalid TOTP (still AAL1) → same API | **403** `MFA_REQUIRED` |

---

## 9. AAL2 success

| Check | Result |
|-------|--------|
| After enroll verify → `currentLevel` | **aal2** |
| `GET /admin` | **200** |
| `GET /api/admin/analytics` | **200** |
| After challenge verify on re-login | **aal2** + analytics **200** |

---

## 10. Invalid TOTP rejection

| Check | Result |
|-------|--------|
| One deliberate invalid code (`000000`) | Verify **rejected** |
| AAL after invalid | Remains **aal1** |
| Admin API | Remains **403** |

---

## 11. Logout

| Check | Result |
|-------|--------|
| `signOut` then `GET /api/admin/analytics` | **401** |

---

## 12. P0 HMAC regression

Live `insert_assistant_message` as session therapist (authenticated, not service role):

| Case | Result |
|------|--------|
| Unsigned | REJECTED — `Invalid message signature` |
| Bad HMAC | REJECTED — `Invalid message signature` |
| Tampered / garbage sig | REJECTED — `Invalid message signature` |
| Wrong session | REJECTED — `Session not found` |
| Legitimate service_role after user turn | **SUCCESS** |

Unit: `report-sign` + `admin` prepareMessageRpc tests PASS.

---

## 13. Cron status

Workflow `expire-sessions.yml`: last five runs **success** (most recent 2026-09-26T05:53:48Z).  
Agent cannot `workflow_dispatch` (HTTP 403). No cron code changes in PR #242. Residual: next scheduled run will execute against `db7c16b`.

---

## 14. Automated regression

| Command | Result |
|---------|--------|
| `npm test` | **PASS** — 103 files / **955** tests |
| `npm run lint` | **PASS** — 0 errors (pre-existing warnings) |
| `npm run build` | **PASS** — emits `/auth/mfa`, `/auth/mfa/enroll` |

---

## 15. Residual risks

1. **5/7 admins still lack verified MFA** — they must self-enroll; until then they cannot use protected admin UI/API under AAL2 enforcement.  
2. **Enrollment UX shows manual secret once** (Supabase TOTP enroll) — expected for authenticator setup; never logged server-side.  
3. **service_role still bypasses message HMAC** by design — protect that key.  
4. **Cron post-deploy run** not yet observed on `db7c16b` (dispatch forbidden to agent).

---

## FINAL GATE

**PHASE 8.9 STATUS = CLEAR**
