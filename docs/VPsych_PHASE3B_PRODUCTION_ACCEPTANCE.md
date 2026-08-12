# VPsych — Phase 3B Production Acceptance Record

**Record type:** Production acceptance (evidence-bound)  
**Verification window:** 2026-08-12 (UTC)  
**Auth gate cleared:** 2026-08-12T11:49:44Z  
**Lifecycle verification completed:** 2026-08-12T12:56:03Z  
**Verdict:** **PHASE 3B PRODUCTION VERIFICATION — PASS**

**Scope of this record:** Formal acceptance of Phase 3B Virtual Patient
authoring/lifecycle on production, based only on the verified production run
evidence.  
**Non-scope:** No application-code change claimed by this verification. No
additional Virtual Patient created by this documentation task. No clinical /
learner conversation. Phase 3C not started. Phase 4 not started. PR #190 not
merged.

---

## 1. Production environment

| Item | Verified value |
|---|---|
| App URL | `https://vpsych.vercel.app` |
| Auth / API backend | Production Supabase project from `NEXT_PUBLIC_SUPABASE_URL` (public anon endpoint used; host not restated here) // pragma: allowlist secret |
| Health probe | `GET /api/health` → `200` |
| Health payload (at record time) | `ok: true`, `service: vpsych`, `version: 1.0.0-rc.1`, `certId: VPSYCH-1.0-RC1-STAGE12` |
| Method | Phase 3B **Admin API** on production, authenticated with audit admin JWT cookies from normal Supabase Auth password grant (anon key). **`service_role` not used.** No direct SQL authoring. |

---

## 2. Production deployment commit and URL

| Item | Verified value |
|---|---|
| Canonical production URL | `https://vpsych.vercel.app` |
| GitHub Production deployment SHA | `48320d11f993359c987eaa7af1a954587924ddf2` |
| Short SHA | `48320d1` |
| Commit subject | `fix(admin): cast partial avatar selects through unknown for strict TS` |
| GitHub Production deployment id | `5847819508` |
| Deployment created_at | `2026-08-11T09:27:34Z` |
| Deployment status | `success` (`Deployment has completed`) |
| `origin/main` at acceptance writing | `48320d11f993359c987eaa7af1a954587924ddf2` (matches Production deployment SHA) |

Phase 3B API calls in the verification run targeted `https://vpsych.vercel.app`
and succeeded against that host.

---

## 3. Database migration status

| Item | Evidence |
|---|---|
| Lifecycle RPC migration in production SHA tree | `supabase/migrations/20260811084442_admin_virtual_patient_lifecycle_rpcs.sql` present at `48320d1` |
| Migrations in production SHA tree | **75** files under `supabase/migrations/` |
| Functional proof on production | Admin RPCs/APIs used successfully: `POST /api/admin/avatars` (create draft), lifecycle, validate, preview, publish, archive, restore, duplicate |

**Not claimed in this record:** a fresh remote `schema_migrations` row-by-row
parity dump was **not** re-run in this verification window. Migration presence
is evidenced by (a) the migration file in the production SHA and (b) successful
production execution of the Phase 3B Admin lifecycle path that depends on those
RPCs.

---

## 4. Authentication verification

Prior gate (same production Auth + Cursor Cloud secrets sync), then reused for
Phase 3B:

| Account | Email mapping | Password grant | Role |
|---|---|---|---|
| Admin | `VPSYCH_AUDIT_ADMIN_EMAIL` matches expected audit admin // pragma: allowlist secret | **PASS** | `admin` |
| Therapist | `VPSYCH_AUDIT_THERAPIST_EMAIL` matches expected audit therapist // pragma: allowlist secret | **PASS** | `therapist` |

| Gate | Result |
|---|---|
| Admin email mapping | **PASS** (`email_matches_expected`) |
| Therapist email mapping | **PASS** (`email_matches_expected`) |
| Admin / therapist password variables | **PRESENT** (values not recorded) |
| Credential Verification Gate (`email_matches_expected` + `login_success` + role) | **PASS** |

---

## 5. Admin authorization

| Check | Result |
|---|---|
| Admin session on `/admin` | **PASS** (`200`) |
| Admin session on `/admin/avatars` | **PASS** (`200`) |
| Admin session on `/admin/avatars/new` | **PASS** (`200`) |
| Admin session on verification patient detail | **PASS** (`200`) |
| Admin `GET /api/admin/disorders` | **PASS** (`200`) |
| Admin create / lifecycle / publish / archive / restore / duplicate | **PASS** (all exercised) |

---

## 6. Therapist authorization boundary

| Check | Result |
|---|---|
| Therapist password grant | **PASS** |
| Therapist role | `therapist` |
| Therapist `/admin` | **BLOCKED** (`307` → `/avatars`) |
| Therapist `/admin/avatars` | **BLOCKED** (`307` → `/avatars`) |
| Therapist `GET /api/admin/disorders` | **BLOCKED** (`403`) |
| Therapist `POST /api/admin/avatars` (create) | **BLOCKED** (`403`) |
| Therapist archive / publish / duplicate | **BLOCKED** (`403`) |

---

## 7. Verification patient ID and slug

| Field | Value |
|---|---|
| Avatar ID | `ba3452f0-f16e-4968-a8d7-02c7b129cc25` |
| Slug | `phase3b-verification-patient-20260812` |
| Persona ID | `3f2c834a-36fb-4e6a-a09d-d766fe6ea7e1` |
| Persona `display_name` | `Phase 3B Verification Patient` |
| EN identity display name | `Lena Moretti` (fictional) |
| AR identity display name | `لينا منصور` (fictional, natively authored) |
| Final state after verification | `lifecycle_status=draft`, `is_active=false` |

---

## 8. Create Draft result

**PASS**

| Field | Observed |
|---|---|
| Endpoint | `POST /api/admin/avatars` |
| HTTP | `201` |
| `lifecycle_status` | `draft` |
| `is_active` | `false` |
| Avatar ID created | `ba3452f0-f16e-4968-a8d7-02c7b129cc25` |
| Persona created | `3f2c834a-36fb-4e6a-a09d-d766fe6ea7e1` |
| EN / AR personalities | Present; prompts differ |
| Human personality EN / AR | Present (`version: 1`) |
| Clinical core | Present (age `29`, gender `female`, GAD catalog disorder) |
| Sessions for avatar at create | `0` |
| Case instances for avatar/persona at create | `0` |

---

## 9. Validate result

**PASS**

| Check | Result |
|---|---|
| `POST /api/admin/avatars/validate` (`mode: publish`) | `200`, `publishReady: true` |
| Create-time validation | `ok: true`, `publishReady: true`, `issues: []` |
| Gates observed green | identity, clinical, personality_en, personality_ar, human_personality_en, human_personality_ar, voice, disorder, runtime |
| Post-run `GET /api/admin/avatars/{id}` validation | `ok: true`, `publishReady: true` |

Validation was not weakened or bypassed.

---

## 10. Testing result

**PASS**

| Check | Result |
|---|---|
| Transition | `POST …/lifecycle` `{ status: "testing" }` → `200` |
| After | `lifecycle_status=testing`, `is_active=false` |
| Admin visible | **Yes** |
| Therapist visible | **No** (empty therapist RLS read for this id) |

---

## 11. Preview result

**PASS**

| Check | Result |
|---|---|
| Endpoint | `POST /api/admin/avatars/{id}/preview` |
| EN-US preview | `200`; `resolveAvatar` returned clinical, EN persona excerpt, system prompt excerpt, Module 2b human-personality prompt, voice projection |
| AR-JO preview | `200`; AR name `لينا منصور`, AR persona excerpt, Module 2b present |
| Note returned | `Preview uses resolveAvatar. Persistent test conversations are Phase 3C.` |
| `includeCase` while persona inactive (draft/testing) | `casePreview: null` (generator rejects `persona_inactive`); **no** `case_instances` persisted |
| Conversation started | **No** |

---

## 12. Publish result

**PASS**

| Check | Result |
|---|---|
| Endpoint | `POST …/publish` |
| HTTP | `200` |
| Transition | `testing` → `published` |
| Projection | `is_active=true` |
| Publish validation | `ok: true`, `publishReady: true`, `issues: []` |

---

## 13. Therapist visibility result

**PASS**

While published, therapist-visible active catalog included:

| Avatar | Slug | Status |
|---|---|---|
| Maya Chen | `maya-chen` | published / active |
| Jordan Hale | `jordan-hale` | published / active |
| Verification patient | `phase3b-verification-patient-20260812` | published / active |

Therapist HTML `/avatars` showed the verification patient name and retained Maya /
Jordan. Draft / testing / archived states were **not** therapist-visible.

---

## 14. Archive result

**PASS**

| Check | Result |
|---|---|
| Endpoint | `POST …/archive` |
| HTTP | `200` |
| After | `lifecycle_status=archived`, `is_active=false` |
| Admin visible | **Yes** |
| Therapist visible | **No** |

---

## 15. Restore result

**PASS**

| Check | Result |
|---|---|
| Endpoint | `POST …/restore` |
| HTTP | `200` |
| After | `lifecycle_status=draft`, `is_active=false` |
| Auto-republish | **Did not occur** |
| Therapist visible after restore | **No** |

---

## 16. Duplicate result

**PASS**

| Field | Value |
|---|---|
| Endpoint | `POST …/duplicate` |
| HTTP | `201` |
| Duplicate ID | `f2dddf43-3c52-4aff-9f0d-96e6e6f98a8c` |
| Duplicate slug | `phase3b-verification-patient-20260812-dup` |
| Duplicate persona ID | `69005ea7-2e60-4341-addd-ebb2c8a361aa` (new) |
| Duplicate lifecycle | `draft` |
| Duplicate `is_active` | `false` |
| Sessions copied | `0` |
| Case instances copied | `0` |
| Reports copied | none observed (global reports count unchanged; per-avatar sessions `0`) |

---

## 17. Human personality result

**PASS**

| Locale | Result |
|---|---|
| `en-US` | Present on avatar; preview Module 2b rendered |
| `ar-JO` | Present on avatar; preview Module 2b rendered |
| Publish gate `human_personality_en` / `human_personality_ar` | **ok** |

---

## 18. Module 2b result

**PASS**

Preview `resolved.human_personality_prompt` began with:

`HUMAN PERSONALITY PROFILE (authoritative — stay consistent every turn):`

Observed for both EN and AR previews (EN length ≈ 1840 chars; AR length ≈ 1606
chars in the verification artifact).

---

## 19. Voice result

**PASS**

| Field | Value |
|---|---|
| Voice profile ID | `a1000000-0000-4000-8000-000000000003` |
| Voice name | **Amira (Bella)** |
| Source | Existing active production voice profile (not newly created) |
| Preview voice projection | Active profile resolved |
| Publish gate `voice` | **ok** |

---

## 20. Disorder result

**PASS**

| Field | Value |
|---|---|
| Disorder ID | `d1000000-0000-4000-8000-000000000002` |
| Disorder slug | **`gad-with-panic`** |
| Disorder name | Generalized Anxiety Disorder, with panic attacks |
| Source | Existing production disorder catalog row (`is_active=true`) |
| New disorder created | **No** |
| Publish gate `disorder` | **ok** |
| Preview `resolved.disorder` | Catalog disorder name returned |

---

## 21. Security results

**PASS**

| Actor | Action | Result |
|---|---|---|
| Admin | Author + lifecycle-manage | Allowed |
| Therapist | See published verification patient | Allowed (only while published) |
| Therapist | See draft / testing / archived | Denied |
| Therapist | Create / update / publish / archive / restore / duplicate | Denied (`403`) |
| Non-admin admin UI | `/admin/*` | Redirected to `/avatars` |
| `service_role` | — | **Not used** in this verification |

---

## 22. Existing Maya / Jordan integrity

**UNCHANGED**

| Avatar | ID | `updated_at` observed | Status |
|---|---|---|---|
| Maya Chen | `14f4c9bf-2216-4f0e-8837-38d6537407d7` | `2026-08-03T18:15:37.637928+00:00` (unchanged across run) | published / active |
| Jordan Hale | `46eefc09-e55b-44d0-9e67-43ea68814613` | `2026-08-03T18:15:37.637928+00:00` (unchanged across run) | published / active |

Neither existing avatar was modified by the verification run.

---

## 23. Sessions / reports / snapshots integrity

**UNCHANGED** (global counts)

| Metric | Before | After | Delta |
|---|---:|---:|---:|
| `sessions` | 583 | 583 | 0 |
| `session_reports` | 466 | 466 | 0 |
| `case_instances` (snapshots proxy used in this run) | 438 | 438 | 0 |

Intentional avatar/persona deltas only:

| Metric | Before | After | Delta |
|---|---:|---:|---:|
| `avatars` | 2 | 4 | +2 (verification patient + duplicate) |
| `personas` | 2 | 4 | +2 |

---

## 24. Learner-data integrity

**UNCHANGED**

| Metric | Count observed | Delta |
|---|---:|---:|
| `learner_profiles` | 5 | 0 |
| `learner_competencies` | 130 | 0 |

---

## 25. Verification artifacts remaining

Both left **inactive drafts** (no published residual):

| ID | Slug | `lifecycle_status` | `is_active` |
|---|---|---|---|
| `ba3452f0-f16e-4968-a8d7-02c7b129cc25` | `phase3b-verification-patient-20260812` | `draft` | `false` |
| `f2dddf43-3c52-4aff-9f0d-96e6e6f98a8c` | `phase3b-verification-patient-20260812-dup` | `draft` | `false` |

---

## 26. DELETE-route limitation

| Check | Result |
|---|---|
| `DELETE /api/admin/avatars/{id}` | **405** (no approved DELETE route) |
| Cleanup action taken | Left both artifacts `draft` / `is_active=false` |
| Direct SQL delete | **Not used** |

---

## 27. Clinical conversation

**NOT STARTED**

Preview explicitly notes persistent test conversations are Phase 3C. No session
create/message/end was executed for the verification patient. Sessions global
count remained 583.

---

## 28. Phase 3C

**NOT STARTED**

---

## 29. Phase 4

**NOT STARTED**

---

## 30. PR #190

**NOT MERGED**

| Field | Value |
|---|---|
| PR | https://github.com/alhazayed/vpsych/pull/190 |
| State at acceptance | `OPEN` |
| `mergedAt` | `null` |

---

## Final conclusion

**PHASE 3B PRODUCTION VERIFICATION — PASS**

Production Phase 3B Virtual Patient create → validate → testing → preview →
publish → therapist visibility → archive → restore → duplicate completed
successfully under admin authorization, with therapist authorization boundaries
enforced, existing Maya/Jordan and clinical/learner aggregates unchanged aside
from the two intentional inactive verification artifacts listed above.

This acceptance record does not authorize Phase 3C, Phase 4, merging PR #190,
or deletion of the remaining draft artifacts.
