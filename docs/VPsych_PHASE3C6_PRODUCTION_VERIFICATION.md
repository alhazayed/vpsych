# VPsych — Phase 3C-6 Production Deployment + Verification Record

**Record type:** Production deployment + controlled verification (evidence-bound)  
**Window:** 2026-08-13 (UTC)  
**Verdict:** **PHASE 3C-6 — BLOCKED**

**Authorized scope executed until stop condition:** deploy approved SHA, create one
fictional testing VP, attempt one Admin Test Conversation, verify auth boundaries,
compare integrity. **No forged `admin_test` INSERT. No publish. No migration. No
Phase 4. No service_role application writes. No SQL DELETE.**

---

## 1. Pre-deploy source state

| Item | Value |
|---|---|
| Authorized SHA | `dbb83f6093b5e5721b62962d135e57749c53c6b4` |
| Working tree at deploy | CLEAN |
| Migrations vs main | **NONE** |
| Pre-deploy Production SHA | `cebb75d4f0294fa415a7e609e09b45b068b706e1` |
| Pre-deploy Production deployment | `dpl_8gRUASy2Lh7HgJdfqh1ZA69QB83W` |

---

## 2. Deployment

| Step | Result |
|---|---|
| Fast-forward `main` to `dbb83f6` | **PASS** |
| GitHub Production deploy of `dbb83f6` | `dpl_7pZK9gsZK4uUT9xesEULsnyW2S9D` — **ERROR** (`next build` / Turbopack Google Fonts module resolution) |
| READY preview of same SHA | `dpl_7STKSL8zayoXudnw3dd3Gft9ot53` (READY, `readySubstate=STAGED`) |
| Production alias assign `vpsych.vercel.app` → preview of `dbb83f6` | **PASS** (old: `dpl_8gRUASy2Lh7HgJdfqh1ZA69QB83W`) |
| Database migration applied | **NONE** |
| Post-deploy Production serves | `dpl_7STKSL8zayoXudnw3dd3Gft9ot53` @ `dbb83f6093b5e5721b62962d135e57749c53c6b4` |
| `/admin` anonymous | **BLOCKED** (`307` → `/login?next=/admin`) |
| `/api/admin/.../test-session` anonymous | **BLOCKED** (`401 Unauthorized`) after Vercel SSO bypass cookie |

**PRODUCTION DEPLOYMENT: PASS** (exact authorized tree live on production alias;
git Production rebuild failed once; identical READY preview promoted via alias).

---

## 3. Pre-test baseline (read-only SQL counts)

| Metric | Before |
|---:|
| avatars | 4 |
| personas | 4 |
| sessions | 583 |
| session_reports | 466 |
| case_instances | 438 |
| learner_competencies | 130 |
| learner_profiles | 5 |
| session_messages | 4078 |
| cge_nodes | 34 |
| cge_edges | 42 |
| cge_attempts | 0 |
| learning_paths | 0 |
| learning_assignments | 0 |
| adaptive_learning_effectiveness_scores | 0 |

| Avatar | ID | `lifecycle_status` | `is_active` | `updated_at` |
|---|---|---|---|---|
| Maya Chen | `14f4c9bf-2216-4f0e-8837-38d6537407d7` | published | true | `2026-08-03T18:15:37.637928+00` |
| Jordan Hale | `46eefc09-e55b-44d0-9e67-43ea68814613` | published | true | `2026-08-03T18:15:37.637928+00` |

---

## 4. Authentication / authorization (application auth; no service_role)

| Actor | Login | Result |
|---|---|---|
| Admin (production audit admin account) | password grant | **PASS** — `/admin` `200`, `/api/admin/disorders` `200` |
| Therapist (production audit therapist account) | password grant | **PASS** login; `/admin` **307→/avatars**; admin APIs **403** |
| Anonymous | — | admin UI redirect; test-session **401** |

Passwords not recorded.

---

## 5. Verification avatar (created; not published)

| Field | Value |
|---|---|
| Avatar ID | `5fbd9eb1-ce82-4d26-b6cb-4a37d6b703f9` |
| Slug | `phase3c-admin-test-verification-20260813` |
| Persona ID | `c28b9f64-1d5c-4a8c-bf05-eadbd3424fb5` |
| EN name | Nora Ellison (fictional) |
| AR name | نورا إلياس (fictional, natively authored) |
| Disorder | existing `gad-with-panic` (`d1000000-0000-4000-8000-000000000002`) |
| Voice | existing Amira/Bella (`a1000000-0000-4000-8000-000000000003`) |
| Human personality / Module 2b | present EN+AR (`version: 1`) |
| Create | `POST /api/admin/avatars` → **201**, `draft`, `is_active=false`, `publishReady:true` |
| Lifecycle | `POST …/lifecycle` `{status:"testing"}` → **200** |
| Final state left | **`lifecycle_status=testing`, `is_active=false`** |
| Published | **NO** |

Phase 3B patient **not reused / not modified**.

---

## 6. Admin Test Conversation — STOP

| Check | Result |
|---|---|
| Therapist start on verification VP | **403 Forbidden** |
| Anonymous start | **401 Unauthorized** |
| Admin start `POST …/test-session` | **400** `{ "error": "Persona is inactive" }` |
| Session created | **NO** (`sessions` for avatar = 0) |
| `admin_test` marker | **N/A** (session never created) |
| Therapy Room / conversation / end | **NOT EXECUTED** (stop) |

### Stop condition

`createCaseForSession` → `validateCaseGeneration` rejects
`persona.is_active === false` (`persona_inactive`).

Phase 3C eligibility is **`lifecycle_status=testing`**, which projects
**`avatars.is_active=false`** and leaves the linked **persona inactive**. The
admin test-session route reuses `createCaseForSession` without an admin-test
bypass for inactive personas. Therefore a compliant testing VP **cannot** start
an Admin Test Conversation on the deployed SHA.

**No improvisation:** did not publish, did not SQL-activate persona, did not
forge marker, did not change RLS/schema, did not deploy a hotfix SHA.

Audit evidence:

| Action | Outcome | Resource |
|---|---|---|
| `admin.avatar.create` | success | avatar `5fbd9eb1-…` |
| `admin.avatar.lifecycle` | success | same |
| `admin.avatar.test_session` | **failure** | same |

---

## 7. Post-stop integrity

| Metric | Before | After | Delta |
|---:|---:|---:|---:|
| avatars | 4 | 5 | **+1** (intentional verification VP) |
| personas | 4 | 5 | **+1** (intentional) |
| sessions | 583 | 583 | 0 |
| session_reports | 466 | 466 | 0 |
| case_instances | 438 | 438 | 0 |
| learner_competencies | 130 | 130 | 0 |
| learner_profiles | 5 | 5 | 0 |
| session_messages | 4078 | 4078 | 0 |
| cge_nodes / edges / attempts | 34 / 42 / 0 | same | 0 |
| learning_paths / assignments | 0 / 0 | same | 0 |
| adaptive_learning scores | 0 | 0 | 0 |

| Seed | Status |
|---|---|
| Maya Chen | **UNCHANGED** (`updated_at` identical) |
| Jordan Hale | **UNCHANGED** |
| Phase 3B verification patients | **UNCHANGED** (still draft / inactive) |

---

## 8. Cleanup

| Action | Result |
|---|---|
| SQL DELETE | **Not used** |
| Publish | **Not used** |
| Avatar left | `testing` / `is_active=false` |
| Session | none |

---

## 9. Required follow-up (not started here)

Hotfix on a **new authorized SHA** must allow Admin Test Conversation for
`lifecycle_status=testing` without publishing / without making the VP
therapist-visible — e.g. admin-test path bypass of `persona_inactive` **or**
activate persona for runtime while keeping `avatars.is_active=false`.

P1 forge-marker finding: **UNCHANGED** (not escalated; not exercised in prod).

---

## 10. Final status block

```text
PRODUCTION DEPLOYMENT:
PASS

DEPLOYED SHA:
dbb83f6093b5e5721b62962d135e57749c53c6b4

DEPLOYMENT ID:
dpl_7STKSL8zayoXudnw3dd3Gft9ot53

DATABASE MIGRATION:
NONE

VERIFICATION AVATAR:
5fbd9eb1-ce82-4d26-b6cb-4a37d6b703f9

VERIFICATION SLUG:
phase3c-admin-test-verification-20260813

VERIFICATION SESSION:
NONE

ADMIN START:
FAIL

THERAPIST BLOCK:
PASS

ANONYMOUS BLOCK:
PASS

THERAPY ROOM TEST MODE:
NOT RUN

ADMIN_TEST MARKER:
NOT RUN

VOICE:
NOT RUN

CONVERSATION:
NOT RUN

SESSION END:
NOT RUN

ASSESSMENT CREATED:
NO

REPORT CREATED:
NO

COMPETENCY CHANGED:
NO

ACE CHANGED:
NO

CGE CHANGED:
NO

LEARNING PLAN CHANGED:
NO

PORTFOLIO CHANGED:
NO

LEARNER ANALYTICS CHANGED:
NO

AUDIT:
PASS (create + lifecycle success; test_session failure recorded)

MAYA/JORDAN:
UNCHANGED

EXISTING LEARNER DATA:
UNCHANGED

VERIFICATION ARTIFACT:
ACTIVE AS TESTING / INACTIVE (no session)

PRODUCTION DATA:
EXPECTED ONLY (+1 avatar, +1 persona)

PHASE 3B:
UNCHANGED

P1:
UNCHANGED

PHASE 3C-6:
BLOCKED

PHASE 4:
NOT STARTED

STOP.
```
