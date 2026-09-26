# VPsych — Phase 3C Admin Test Conversation Readiness Assessment

**Document type:** Read-only architecture / readiness assessment  
**Assessment date:** 2026-08-12 (UTC)  
**Authoritative main SHA:** `cebb75d4f0294fa415a7e609e09b45b068b706e1` (`cebb75d`)  
**Production application commit (at Phase 3B acceptance):** `48320d11f993359c987eaa7af1a954587924ddf2` (`48320d1`)  
**Phase 3B acceptance record:** `docs/VPsych_PHASE3B_PRODUCTION_ACCEPTANCE.md`  
**Scope:** Assessment only. No application-code change. No schema change. No migration. No deploy. No production sessions. No Virtual Patient mutation. No PR merge of #188/#190.

---

## 1. Executive Summary

| Gate | Verdict |
|---|---|
| **PHASE 3B** | **CLOSED / UNCHANGED** |
| **PHASE 3C READINESS** | **READY WITH GAPS** |
| **EXISTING TEST INFRASTRUCTURE** | **FOUND** (partial — preview + `testing` lifecycle; no persistent test conversation) |
| **ADMIN_TEST ARCHITECTURE** | **PARTIAL** (designed on unmerged PR #188; **absent on main**) |
| **SESSION ENGINE REUSE** | **SAFE** (preferred: existing session engine + test mode + metadata + exclusion) |
| **DATABASE CHANGE** | **NONE** required if `clinical_snapshot.admin_test` JSON marker is reused |
| **NEW API REQUIRED** | **YES** |
| **LEARNER DATA ISOLATION** | **GAP** on main (no marker; end always assesses) |
| **VOICE RUNTIME REUSE** | **PASS** (same `/api/sessions/:id/message` + STT/TTS pipeline) |
| **THERAPY ROOM REUSE** | **PASS** (reuse with TEST MODE UX; do not fork UI) |
| **AUTHORIZATION** | **GAP** (no admin test-session route on main) |
| **AUDIT** | **GAP** (no `test_session` audit action on main) |
| **RETENTION** | **PRODUCT DECISION REQUIRED** |
| **PRODUCTION READINESS** | **NOT READY** |
| **APPLICATION CODE CHANGED** | **NO** (this doc only) |
| **DATABASE CHANGED** | **NO** |
| **PRODUCTION DATA CHANGED** | **NO** |

**Bottom line:** Phase 3C should **not** create a second session engine. The production-safe shape is:

```text
EXISTING SESSION ENGINE
  + ADMIN-ONLY CREATE PATH (bypasses is_active / published-only gate)
  + clinical_snapshot.admin_test = true (immutable marker)
  + session end early-exit (skip assessment / report / ACE / CGE / education / portfolio)
  + analytics & history exclusion
  + admin TEST MODE UI over VoiceSession / Therapy Room
```

That architecture was sketched in PR #188 but **never landed on main**. Phase 3B closed the lifecycle (`draft → testing → published → archived`) and left persistent Admin Test Conversation explicitly as Phase 3C.

---

## 2. Existing Admin Test Infrastructure

### 2.1 Search coverage

Repository + git history searched for: `admin_test`, `admin-test`, `test_session`, `test-session`, `admin test`, `sandbox`, `sandbox session`, `preview`, `test conversation`, `test patient`, `clinical_snapshot.admin_test`, `is_admin`, `skip assessment`, `skip report`.

### 2.2 Inventory on current main (`cebb75d`)

| Artifact | File / location | Function / route | Purpose | Status on main | Production usage | Safe to reuse? |
|---|---|---|---|---|---|---|
| Avatar lifecycle `testing` | `avatars.lifecycle_status` + Phase 3B RPCs/APIs | `POST /api/admin/avatars/[id]/lifecycle` | Admin-visible, not therapist-visible verification state; `is_active=false` | **Present** | Verified in Phase 3B acceptance | **Yes** — do not redesign |
| Therapist visibility projection | `avatars.is_active` + sync triggers | Session start / RLS | `is_active=true` iff `published` | **Present** | Live | **Yes** |
| Resolve preview (non-chat) | `src/app/api/admin/avatars/[id]/preview/route.ts` | `POST …/preview` | Admin-only `resolveAvatar` (+ optional case generation); **no messages** | **Present** | Verified Phase 3B | **Yes** for prompt/voice/case preview only — **not** a conversation |
| Preview UI | `VirtualPatientWizard` / `VirtualPatientDetail` | Client fetch to preview | Shows resolved excerpts / JSON | **Present** | Admin UX | **Yes** as complementary check |
| Voice sample preview | `VoicePreviewButton` | TTS sample | Locale voice check | **Present** | Admin UX | **Yes** — not a session |
| Session create (learner) | `POST /api/sessions` | Creates case + session | Requires `avatar.is_active`; always learner path | **Present** | Production learner sessions | **Reuse engine internals**; **do not** use this route as-is for testing avatars |
| Message / voice / end | `/api/sessions/[id]/message`, STT/TTS, `/end` | Full conversation + assessment | Learner pipeline | **Present** | Production | **Reuse** for runtime; **must gate end** for admin tests |
| `admin_test` marker | — | — | Skip learner side effects | **Absent on main** | None | Pattern from PR #188 is reusable **with hardening** |
| `POST …/test-session` | — | — | Start admin test session | **Absent on main** | None | Must implement under Phase 3B `/api/admin/avatars` surface |
| `/api/admin/virtual-patients/*` | — | — | PR #188 parallel IA | **Absent on main** | None | **Do not resurrect** as primary surface |
| End-route skip | `sessions/[id]/end` | Early return | Skip report/ACE | **Absent on main** | N/A — end always assesses | Required for Phase 3C |
| Admin Test Conversation UI | — | — | Persistent sandbox chat | **Absent** | None | Reuse Therapy Room / VoiceSession in TEST MODE |
| Docs pointing to 3C | Phase 3B / contract / Phase 2 docs | — | Explicitly defer sandbox chat | **Present** | Guidance only | Align implementation to these |

### 2.3 What does **not** exist on main

- No `admin_test` / `adminTest` string in `src/**` TypeScript.
- No `test-session` Route Handler under `src/app/api/admin/`.
- No skip-assessment / skip-report branch in `src/app/api/sessions/[id]/end/route.ts`.
- No TEST MODE indicator in session or Therapy Room UI.
- No admin-only test-session history view.
- No dedicated retention/cleanup policy for admin tests.

### 2.4 Preview vs Test Conversation (product boundary)

Preview (`admin.avatar.preview`) returns resolved prompt excerpts and optional case preview JSON. Response note on main:

> `Preview uses resolveAvatar. Persistent test conversations are Phase 3C.`

Phase 3B acceptance §27–§28: clinical conversation **NOT STARTED**; Phase 3C **NOT STARTED**.

---

## 3. Current Session Architecture

### 3.1 End-to-end learner path (authoritative on main)

```text
Avatar (must is_active / published for therapists)
  → POST /api/sessions
      → rate limit (`start`)
      → load avatar (rejects inactive)
      → createCaseForSession() → CaseInstance + CaseInstanceSnapshot
      → INSERT sessions (therapist_id, clinical_snapshot, case_instance_id, …)
      → insert_system_message RPC
      → optional case_memory / dyad Clinical Intelligence seed
  → Conversation UI
      → classic: VoiceSession  OR  therapy_room: TherapyRoom / TherapyRoomSession
  → Therapist speech → OpenAI STT `/api/voice/transcribe`
  → POST /api/sessions/[id]/message
      → ownership + active + time check
      → resolveAvatar(avatar, language, { caseSnapshot })
      → patient agent (emotion, adaptation, PME/CI, humanization, memory)
      → insert_assistant_message RPC
  → ElevenLabs TTS `/api/voice/tts` (voice mode)
  → POST /api/sessions/[id]/end
      → mark completed/expired
      → session_has_report idempotency
      → assessSession()
      → runEducationAfterAssessment() → ACE (+ CGE bridge) + portfolio analytics
      → validation / supervisor / enterprise / realtime (best-effort)
      → runPatientMemoryAfterSession()
      → create_session_report (HMAC or service role)
      → quality ledger seal
```

### 3.2 Shared vs admin-test-specific layers

| Layer | Therapist learner session | Admin test session (target) |
|---|---|---|
| Case Engine / snapshot mint | Shared | Shared |
| Patient agent / prompts / personality | Shared | Shared |
| Message RPCs / transcript | Shared | Shared |
| STT / TTS / voice registry / Arabic locales | Shared | Shared |
| Therapy Room / VoiceSession UI shell | Shared | Shared + TEST MODE chrome |
| Create route | `POST /api/sessions` (`is_active` required) | **New** admin create (inactive/`testing` allowed) |
| Session marker | none | `clinical_snapshot.admin_test=true` |
| End pipeline | Full assessment + learner systems | **Skip** assessment/report/ACE/CGE/education/portfolio/enterprise learner paths |
| Visibility | Therapist history `/sessions` | Admin-only history; **exclude** from learner views/analytics |

**Do not** assume separate engines. Prefer one engine with mode gates.

---

## 4. PR #188 Reuse Analysis

### 4.1 PR status

| Field | Value |
|---|---|
| PR | [#188](https://github.com/alhazayed/vpsych/pull/188) |
| Title | feat(admin): Virtual Patient usability redesign — guided wizard & 7-section IA |
| State at assessment | **OPEN / DRAFT** (`mergedAt: null`) |
| Branch | `cursor/admin-dashboard-usability-46b3` |
| In `main`? | **No** (`280d545` is **not** an ancestor of `main`) |

Phase 3B reconciliation explicitly: PR #188 is **reference architecture**; **superseded as merge target**. Lifecycle on main came via Phase 3B (`/api/admin/avatars` + `20260811084442_admin_virtual_patient_lifecycle_rpcs.sql`), not by merging #188.

### 4.2 What PR #188 implemented for Admin Test

| Piece | PR #188 behavior |
|---|---|
| Route | `POST /api/admin/virtual-patients/[id]/test-session` |
| Auth | `requireApiAdmin` + rate limit `admin-vp-test` |
| Eligibility | Any non-`archived` VP (draft/testing/published allowed) |
| Case | `createCaseForSession` (real case mint) |
| Marker | `clinical_snapshot.admin_test = true` + `admin_test_label` |
| System message | Explicit “ADMIN TEST — NOT A LEARNER SESSION…” |
| Audit | `admin.virtual_patients.test_session` |
| UI redirect | `/sessions/:id?adminTest=1` or `/clinic/room/:id?adminTest=1` |
| End skip | After status close, if `admin_test===true` → `{ skippedAssessment: true }` — **before** assess/report/ACE |
| Types | Optional `admin_test?: boolean` on `CaseInstanceSnapshot` |
| UI | Edit Virtual Patient “Test” tab → start test |

### 4.3 Still present on main?

| Item | On main? |
|---|---|
| Lifecycle idea (`draft/testing/published/archived`) | **Yes** (Phase 3B, different API surface) |
| `/api/admin/virtual-patients/*` | **No** |
| `test-session` route | **No** |
| `admin_test` on snapshot type | **No** |
| End skip | **No** |
| Test Patient UI | **No** (preview only) |

### 4.4 What is still valid

1. **Reuse the real session + case + message + voice runtime.**
2. **Mark via `clinical_snapshot.admin_test`** (no new table required).
3. **Early-exit on end** before assessment / report / education / ACE / CGE / portfolio.
4. **Admin-only create** with audit event.
5. **Labeled system message** for transcript clarity.
6. **Query flag `adminTest=1`** as a UI hint (must be backed by server marker, never trust alone).

### 4.5 What should **NOT** be resurrected

1. **Do not merge PR #188 wholesale** — conflicts with Phase 3B `/api/admin/avatars` IA and superseded migration `20260808171439_avatar_lifecycle_status.sql`.
2. **Do not recreate `/api/admin/virtual-patients`** as the primary authoring/test surface.
3. **Do not re-apply** PR #188 lifecycle migration (prod already has lifecycle; Phase 3B shim documents drift).
4. **Do not treat `?adminTest=1` alone as security** — clients can spoof query params.
5. **Do not copy end-skip without admin verification** (see Risks — therapist could forge JSON marker via direct insert under current RLS).

### 4.6 What can safely be reused (ideas / patterns only)

- Snapshot marker + label strings.
- End-route early return placement (after status update, before `session_has_report` / `assessSession`).
- Rate-limit budget class for admin test starts.
- Redirect into existing session routes rather than a new conversation engine.

**Do not cherry-pick or merge PR #188 in Phase 3C without a deliberate, reduced port onto the Phase 3B API surface.**

---

## 5. Data Isolation Analysis

### 5.1 Highest-priority question

How can an admin test be isolated from learner data **without** a second engine?

### 5.2 Tables / systems touched by a normal session

| Store | Written on learner path? | Isolation need for admin test |
|---|---|---|
| `sessions` | Yes | Mark as admin-test; filter from learner history/analytics |
| `sessions.clinical_snapshot` | Yes (immutable case) | **Preferred marker home:** `admin_test: true` |
| `case_instances` / case memory | Yes | New instance per session — OK; do not feed learner adaptivity |
| `session_messages` | Yes | Retain for admin review; admin-readable via RLS |
| `session_reports` | Yes on end | **Must not create** for admin tests |
| Quality ledger | Yes (best-effort) | **Must not seal** for admin tests |
| ACE / `learner_profiles` / `learner_competencies` | Via education/ACE after assess | **Must not update** |
| CGE (via ACE bridge) | Via ACE | **Must not update** |
| Education portfolio / longitudinal | Via `runEducationAfterAssessment` | **Must not update** |
| Supervisor / validation / enterprise / realtime after-assess hooks | Yes | **Must not run** (or must no-op) for admin tests |
| Patient memory (`therapist_id` + `avatar_id`) | Turn + end | Dyad-scoped to admin user — **does not alter therapist learners**; still should skip end-summarize for cleanliness / admin portfolio pollution |
| Clinic appointments / immersion | Therapy Room path | Prefer not attaching admin tests to clinic day schedule |

### 5.3 Existing reliable marker on main?

| Candidate | Exists on main? | Verdict |
|---|---|---|
| `clinical_snapshot.admin_test` | **No** (type + writers absent) | **Best reuse candidate** from PR #188 |
| `sessions` column `admin_test` | **No** | Not required if JSON marker + hardened end checks |
| Separate `admin_test_sessions` table | **No** | Avoid unless product requires hard separation |
| Avatar `lifecycle_status='testing'` alone | **Yes** | Marks **avatar**, not **session** — insufficient (published may also need admin re-test; learners never use testing avatars) |

**Recommendation:** Do **not** invent a new flag name. Reuse **`clinical_snapshot.admin_test = true`**. Optionally add TS fields on `CaseInstanceSnapshot`. **No migration required** for JSONB metadata.

### 5.4 Who writes / reads (target design)

| Actor | Write marker? | Read / enforce? |
|---|---|---|
| Admin test-session API only | Yes (server-side) | Create path |
| `POST /api/sessions` (learner) | Never | — |
| Direct client insert | Must not be trusted | End must require **admin role** when skipping |
| Session end | Read marker + verify `is_admin()` / actor | Skip learner pipeline |
| Reports / ACE / analytics queries | Filter `admin_test` | Exclusion |
| Therapist UI | Must not see others’ admin tests; admin’s own `/sessions` should filter or badge | History isolation |

### 5.5 Current main behavior (gap)

On main, **any** completed session end runs assessment → report → education/ACE/CGE → etc. There is **no** exclusion. Therefore **LEARNER DATA ISOLATION = GAP** until Phase 3C implements marker + end gate + query filters.

### 5.6 Retention interaction

`purge_training_sessions_older_than(p_days)` deletes **all** completed/expired sessions older than N days (admin-only RPC). It does **not** distinguish admin tests. See §11.

---

## 6. Lifecycle Analysis

### 6.1 Avatar lifecycle (Phase 3B — closed; do not redesign)

```text
draft → testing → published → archived
         ↑___________|          |
              restore → draft
```

| State | Admin visible | Therapist visible | Intended for admin test? |
|---|---|---|---|
| `draft` | Yes | No | Optional (incomplete) — **product decision** |
| `testing` | Yes | No | **Primary** eligibility |
| `published` | Yes | Yes | Re-verification? — **product decision** (PR #188 allowed) |
| `archived` | Yes | No | **No** (PR #188 blocked; keep blocked) |

### 6.2 Test session lifecycle (proposed, based on architecture)

```text
Testing Avatar (or approved eligible state)
  → Start Test (admin API)
  → Active Test Session (sessions.status = active, admin_test marker)
  → Conversation (real runtime)
  → End Test (sessions.status = completed|expired)
  → Closed — NO report / NO learner assessment side effects
```

| Question | Conclusion from existing architecture / docs |
|---|---|
| Visible to admins? | **Yes** (own session + admin RLS) |
| Visible to therapists? | **No** as a learner artifact; therapists must not start tests; testing avatars are not therapist-selectable |
| Appear in learner session history? | **Should not** for therapist learners; if admin uses `/sessions`, filter/badge — otherwise admin history pollution |
| Generate reports? | **No** |
| Generate assessments? | **No** (learner scoring) |
| Competency scores? | **No** |
| Learning-plan / ACE / CGE updates? | **No** |
| Analytics? | **No** learner/enterprise aggregates |

---

## 7. Voice / Realtime Analysis

### 7.1 Current runtime (must reuse)

Client orchestration (`lib/voice/conversation-pipeline.ts`):

```text
Therapist speech → OpenAI STT (`/api/voice/transcribe`)
  → Patient reply (`/api/sessions/:id/message`)
  → ElevenLabs TTS (`/api/voice/tts`)
  → Browser audio
```

Text-only skips STT/TTS but uses the same message API. Transcript persistence is always server-side.

Therapy Room adds VAD, interruption, immersion, FSM — still calls the same session message/end APIs.

### 7.2 Admin Test requirements

| Capability | Must match learner runtime? | How |
|---|---|---|
| Speech recognition | Yes | Same STT route |
| TTS / ElevenLabs / voice profiles | Yes | Same TTS + registry |
| Arabic pronunciation / locale | Yes | Same `resolveAvatar` locale path |
| Turn-taking / interruption | Yes | Same Therapy Room / pipeline |
| Patient emotion / memory / behavior rules | Yes | Same message route engines |
| Separate voice stack | **No** | Forbidden by absolute rules |

**VOICE RUNTIME REUSE: PASS** — provided Phase 3C opens a real `sessions` row and reuses existing clients.

---

## 8. Therapy Room Reuse Analysis

| Concern | Finding |
|---|---|
| Can Therapy Room host admin tests? | **Yes** — PR #188 redirected to `/clinic/room/:id?adminTest=1` or classic `/sessions/:id` |
| Route protection today | `requireProfile` + `therapist_id === user.id` — works when admin is session owner |
| Test-mode indicator | **Missing** — query param unused on main |
| Exit / end | Calls `/api/sessions/:id/end` — **must** honor `admin_test` skip |
| Transcript / audio / voice / patient state | Same components |
| Persistence | Same `session_messages` |
| Feature flag | Therapy Room still gated by `NEXT_PUBLIC_THERAPY_ROOM_MODE` / feature helpers — classic VoiceSession remains default |

**Recommendation:** Reuse VoiceSession (default) and Therapy Room (when enabled) with a **TEST MODE** banner, distinct end copy (“End test — no learner report”), and redirect back to admin Virtual Patient detail — **not** a new conversation UI.

**THERAPY ROOM REUSE: PASS** (with UX gaps).

---

## 9. Authorization

### 9.1 Existing controls to leverage

- Pages: `requireAdmin` / `requireProfile`
- APIs: `requireApiAdmin` (writes `security_audit_events` on deny)
- Middleware: `/admin` + `/api/admin` edge gate
- Roles: `profiles.role` only (`admin` | therapist) — **do not create new roles**

### 9.2 Required policy for Phase 3C

| Step | Admin | Therapist | Anonymous |
|---|---|---|---|
| Start test | Allowed (eligible avatar) | **Denied** | Denied |
| Continue test (message/voice) | Allowed if owner | Denied (unless somehow owner — should not be) | Denied |
| Read transcript | Allowed (owner or admin RLS) | Only own learner sessions | Denied |
| End test | Allowed if owner + admin path | N/A | Denied |
| Delete/cleanup | Admin-only; policy TBD | Denied | Denied |
| View test history | Admin-only | Denied | Denied |

### 9.3 Gaps on main

- No start-test endpoint → therapists cannot call a missing route, but admins also cannot start tests.
- Learner `POST /api/sessions` rejects inactive avatars → correctly blocks therapists from testing `testing` avatars via normal start.
- **Forged `admin_test` risk** if end skip is added without role check (see Risks).

**AUTHORIZATION: GAP** (missing test APIs + hardening requirement).

---

## 10. Audit Logging

### 10.1 Existing related events (main)

| Action | When |
|---|---|
| `admin.avatar.create` | Create draft |
| `admin.avatar.update` | Patch draft/testing |
| `admin.avatar.lifecycle` | Status transitions (incl. → testing) |
| `admin.avatar.preview` | Preview (via `requireApiAdmin` action) |
| `admin.avatar.publish` / `archive` / `restore` / `duplicate` / `validate` / `voice.assign` | Lifecycle ops |
| `compliance.retention.purge` | Bulk session purge |

### 10.2 Missing for Phase 3C

| Event | Needed? |
|---|---|
| `admin.avatar.test_session` (or `admin.avatar.test_session.start`) | **Yes** — create |
| `admin.avatar.test_session.end` | **Recommended** — especially because learner end has no security audit today |
| Deny events | Covered by `requireApiAdmin` |

Align naming with Phase 3B `admin.avatar.*` (not PR #188’s `admin.virtual_patients.*`).

**AUDIT: GAP**

---

## 11. Retention / Cleanup

### 11.1 What exists

- Profile preference `data_retention_days` (default 365).
- Admin RPC `purge_training_sessions_older_than(p_days)` — deletes completed/expired sessions older than N days **without** admin-test distinction.
- Session hard-expire at `MAX_SESSION_SECONDS` (active → expired) — timer only, not retention policy.

### 11.2 Models A–D

| Model | Defined in repo for admin tests? |
|---|---|
| A. Keep indefinitely for admin review | Not specified |
| B. Retain temporarily | Not specified |
| C. Auto-delete after period | Only generic training purge |
| D. Mark admin-test and retain separately | Marker idea exists in PR #188; retention not specified |

### 11.3 Verdict

**RETENTION: PRODUCT DECISION REQUIRED**

Do not invent a policy in implementation. Until decided, implement marker + exclusion; default operational behavior will follow generic session retention if purge is run.

---

## 12. Current → Required Gap Analysis

| Area | Current VPsych (main) | Required Phase 3C | Gap? |
|---|---|---|---|
| Authentication | Supabase Auth | Same | Pass |
| Authorization | Admin gates for preview/lifecycle; no test start | Admin-only test start/end/history | **Gap** |
| Testing lifecycle (avatar) | `testing` state live | Use as primary eligibility | Pass |
| Session creation for inactive VP | Blocked by `/api/sessions` | Admin create bypassing `is_active` | **Gap** |
| Test-session marker | Absent | `clinical_snapshot.admin_test` | **Gap** |
| Conversation runtime | Full patient agent | Same | Pass (reuse) |
| Voice | Full pipeline | Same | Pass (reuse) |
| Transcript | `session_messages` | Same | Pass (reuse) |
| Persistence | sessions + messages | Same + marker | **Partial** |
| Assessment exclusion | None | Skip on end | **Gap** |
| Report exclusion | None | Skip report insert/RPC | **Gap** |
| Competency / ACE / CGE exclusion | None | Skip education/ACE path | **Gap** |
| Analytics exclusion | None | Filter admin tests | **Gap** |
| Patient-memory end summarize | Always (best-effort) | Skip or no-op for admin tests | **Gap** (low severity vs ACE) |
| Audit | Preview/lifecycle only | test start (+ end) | **Gap** |
| Retention | Generic purge | Product decision | **Decision** |
| Cleanup | None specific | Per retention decision | **Decision** |
| UI | Preview JSON only | TEST MODE conversation + entry points | **Gap** |
| Error handling | Standard API sanitization | Same patterns | Pass (extend) |
| Forged skip hardening | N/A | End must verify admin when skipping | **Gap** (design) |

---

## 13. Recommended Architecture

### 13.1 Preferred shape (proven safe if hardened)

```text
EXISTING SESSION ENGINE
  + TEST MODE
  + ADMIN-TEST METADATA (clinical_snapshot.admin_test)
  + ANALYTICS / ASSESSMENT / REPORT / ACE / CGE EXCLUSION
```

**Why safe:**

1. Case/patient/voice paths already take `clinical_snapshot` as session truth — additive boolean does not change diagnosis ownership invariants.
2. Messages already require session ownership — admin as `therapist_id` is consistent with RLS.
3. Learner side effects are concentrated in `/api/sessions/[id]/end` — one gate covers report, education, ACE, CGE bridge, supervisor, enterprise, realtime, ledger.
4. Avatar lifecycle already separates therapist visibility from admin verification.
5. Avoids dual transcript engines and dual patient agents (explicitly forbidden).

### 13.2 Hardening requirements (make SAFE in production)

1. **Only** admin test-session API sets `admin_test: true` (server-assembled snapshot).
2. On end skip: require `admin_test === true` **AND** `profiles.role === 'admin'` for the caller (and preferably `therapist_id === auth.uid()`).
3. Never trust `?adminTest=1` for skip decisions.
4. Filter admin-test sessions from learner analytics exports and ACE ingest (defense in depth even if end skip works).
5. UI TEST MODE reads server marker (session payload), not only query string.

### 13.3 Explicit non-goals

- No second session engine  
- No second transcript engine  
- No Clinical Core / ACE / CGE algorithm changes  
- No RLS weakening  
- No new roles  
- No Phase 3B lifecycle redesign  

**SESSION ENGINE REUSE: SAFE** (with the hardening above).

---

## 14. Proposed API Contract

### 14.1 Already exists (keep)

| Method | Path | Role |
|---|---|---|
| `POST` | `/api/admin/avatars/[id]/preview` | Non-persistent resolve preview |
| `POST` | `/api/sessions/[id]/message` | Reuse for test conversation turns |
| `POST` | `/api/voice/transcribe` | Reuse |
| `POST` | `/api/voice/tts` | Reuse |
| `POST` | `/api/sessions/[id]/end` | Reuse **with** admin_test early-exit |

### 14.2 Required new / changed endpoints

#### A. `POST /api/admin/avatars/[id]/test-session` (**NEW**)

| Field | Spec |
|---|---|
| Auth | Session cookie |
| Authorization | `requireApiAdmin` (`action: admin.avatar.test_session`) |
| Input | Optional `{ locale?, interactionMode?: "classic"\|"therapy_room" }` |
| Eligibility | Prefer `lifecycle_status === "testing"`; archived denied; draft/published per product decision |
| DB writes | `createCaseForSession`; `sessions` insert with `clinical_snapshot.admin_test=true`; system message; **no** report |
| Session marker | `clinical_snapshot.admin_test = true`, optional `admin_test_label` |
| Audit | `admin.avatar.test_session` success + metadata `{ avatarId, sessionId, interactionMode, lifecycle }` |
| Output | `{ sessionId, path, adminTest: true, language, … }` |
| Exclusion | N/A at create; sets up end exclusion |
| Database changes | **None** (JSONB field) |

Place under **`/api/admin/avatars`** (Phase 3B surface), not `/virtual-patients`.

#### B. `POST /api/sessions/[id]/end` (**CHANGE** — behavior gate only)

| Field | Spec |
|---|---|
| Auth | Existing |
| Authorization | Owner; if skipping, **also** require admin |
| Behavior | After status close: if admin_test && admin → return `{ ok, adminTest, skippedAssessment: true }` without assess/report/education/ACE/… |
| Audit | Optional `admin.avatar.test_session.end` |
| Database changes | None |

#### C. Optional `GET /api/admin/test-sessions` / `[id]` (**OPTIONAL**)

Only if admin history UX needs listing beyond filtering `sessions` where snapshot contains `admin_test`. Prefer querying existing `sessions` with admin client filters before adding endpoints.

#### D. Explicit `POST /api/admin/test-sessions/[id]/end`

**Not required** if B is hardened. Avoid duplicate end semantics unless product wants an admin-only URL for clarity.

---

## 15. Database Impact

| Option | Required? | Notes |
|---|---|---|
| **NO DATABASE CHANGE** | **Preferred** | Store `admin_test` on existing `sessions.clinical_snapshot` JSONB |
| NEW COLUMN | Not required | Could add `sessions.is_admin_test boolean` later for indexed analytics filters — optional optimization |
| NEW TABLE | Not required | Avoid parallel engine |
| EXISTING FIELD REUSE | **Yes** | `clinical_snapshot` |
| EXISTING ADMIN_TEST ARCHITECTURE REUSE | **Pattern from PR #188 only** — not present on main |

**DATABASE CHANGE: NONE** for MVP Phase 3C if JSON marker + query filters suffice.

If analytics at scale need indexed exclusion, a follow-up migration adding `sessions.is_admin_test` generated/synced from snapshot could be proposed later — **not** blocking architecture.

---

## 16. Test Strategy

| # | Case | Expected |
|---|---|---|
| 1 | Admin starts test on eligible avatar | 200; session row; `admin_test=true` |
| 2 | Therapist starts test | 403 |
| 3 | Anonymous starts test | 401 |
| 4 | Avatar must be Testing/eligible | Non-eligible → 409; archived → 409 |
| 5 | Published behavior | Per product decision (allow or deny) — assert chosen rule |
| 6 | Marker correct | Snapshot + system message label |
| 7 | Messages stored | user/assistant via existing RPCs |
| 8 | No learner report | `session_reports` absent; end `skippedAssessment` |
| 9 | No competency score | No `learner_competencies` ingest for session |
| 10 | No learner progress | ACE profile unchanged |
| 11 | No ACE/CGE update | Bridge not applied |
| 12 | End test safe | Status completed/expired; no 500 from missing report key |
| 13 | Historical learner sessions unchanged | Maya/Jordan learner aggregates untouched |
| 14 | Real patient runtime | `generatePatientReplyDetailed` path used (`aiSource` real or persona_fallback honestly labeled) |
| 15 | Same voice pipeline | STT/TTS routes identical |
| 16 | EN/AR same runtime | Locale resolve + native personalities |
| 17 | Auditable | `security_audit_events` contains test_session (+ end if implemented) |
| Extra | Forged marker by non-admin | End must **not** skip assessment |
| Extra | Admin `/sessions` list | Test sessions filtered or clearly badged |
| Extra | Therapist catalog | Testing avatar still invisible |

---

## 17. Production Readiness

| Gate | Status | Notes |
|---|---|---|
| **CODE READY** | **NOT READY** | No test-session route; no end skip; no TEST MODE UI |
| **DATABASE READY** | **READY** | JSONB marker needs no migration; lifecycle already live |
| **SECURITY READY** | **NOT READY** | Need admin-only create + hardened skip + audit |
| **CLINICAL-SAFETY READY** | **READY WITH CARE** | Reuse patient runtime; do not mutate seed patients; do not write real patient data into VPs |
| **DATA-ISOLATION READY** | **NOT READY** | Marker + exclusion not on main |
| **UI READY** | **NOT READY** | Preview only; no conversation TEST MODE |
| **PRODUCTION READY** | **NOT READY** | Phase 3C not started (Phase 3B acceptance §28) |

---

## 18. Risks

1. **Forged `admin_test` via direct Supabase insert** under sessions INSERT RLS — end skip must verify admin role.  
2. **Accidentally merging PR #188** — would fight Phase 3B API surface and migration history.  
3. **Using `POST /api/sessions` for tests** — cannot start on `testing` avatars; would also lack marker.  
4. **Admin sessions appearing in `/sessions` history** — confuses admins; may look like learner work.  
5. **Patient memory / dyad carry for admin userId** — low cross-learner risk, but pollutes admin’s own dyad if they also train.  
6. **Enterprise/supervisor hooks** if end skip is incomplete or reordered.  
7. **Retention purge** deleting admin verification transcripts without product consent.  
8. **Published-avatar testing** without policy — could create noise next to real learner sessions on same avatar.  
9. **Therapy Room clinic day coupling** — admin tests should not distort clinic schedule metrics.  
10. **Treating preview as sufficient verification** — preview cannot validate turn-taking, emotion, or voice loop.

---

## 19. Open Product Decisions

| ID | Decision | Default recommendation (non-binding) |
|---|---|---|
| PD-1 | May admin test **draft** avatars? | Allow with warning (incomplete) **or** require `testing` only |
| PD-2 | May admin test **published** avatars? | Allow for regression checks (PR #188 did); keep `admin_test` exclusion |
| PD-3 | Retention model A/B/C/D | **REQUIRES PRODUCT DECISION** |
| PD-4 | Admin test history UX — badge in `/sessions` vs dedicated admin list | Prefer dedicated admin “Test sessions” under VP detail |
| PD-5 | Classic vs Therapy Room default for tests | Follow existing feature flag; classic default |
| PD-6 | Whether end should write an admin-only “verification note” (non-learner) | Optional; must not use `session_reports` learner report shape |
| PD-7 | Cleanup/delete API for individual test sessions | Optional; wait for retention decision |
| PD-8 | Skip in-session patient-memory writes entirely for admin tests | Recommended yes for cleanliness |

---

## 20. Recommended Phase 3C Implementation Plan

**Do not start until this assessment is accepted.** When authorized:

### Step 0 — Preconditions

- Phase 3B remains closed/unchanged.  
- Do not merge PR #188 / #190.  
- Branch from current `main`.  
- Confirm PD-1/PD-2 (eligibility) and note PD-3 as open.

### Step 1 — Types + end gate (isolation core)

1. Add optional `admin_test?: boolean` (+ label) to `CaseInstanceSnapshot` typing.  
2. In `POST /api/sessions/[id]/end`, after status close: if marker && caller is admin → skip assessment/report/education/ACE/CGE/supervisor/enterprise/realtime/ledger/patient-memory summarize.  
3. Unit/integration tests for skip + forged-marker non-skip.

### Step 2 — Admin create API

1. Add `POST /api/admin/avatars/[id]/test-session` mirroring learner create internals (`createCaseForSession`, message RPC) but: admin auth, eligibility checks, marker, audit, no `is_active` requirement.  
2. Rate limit budget (e.g. 20/hour).  
3. Return path to classic or Therapy Room UI.

### Step 3 — UI TEST MODE

1. Entry: Virtual Patient detail / lifecycle actions when eligible (“Start test conversation”).  
2. Reuse `VoiceSession` / Therapy Room; banner + end copy; return to admin VP page.  
3. Do not build a parallel chat client.

### Step 4 — History / analytics exclusion

1. Filter `admin_test` from learner-facing lists if an admin account shares `/sessions`.  
2. Ensure research/export/ACE ingest ignore admin-test sessions (defense in depth).  

### Step 5 — Audit + docs

1. Emit `admin.avatar.test_session` (+ optional end).  
2. Update contract/implementation docs; keep Phase 3B acceptance immutable.  

### Step 6 — Verification before production

Run the §16 matrix on preview/production with a **non-seed** testing avatar (never Maya/Jordan mutation). Confirm session counts/reports/ACE aggregates for learners unchanged.

---

## Final Report Card

```text
PHASE 3B:
CLOSED / UNCHANGED

PHASE 3C READINESS:
READY WITH GAPS

EXISTING TEST INFRASTRUCTURE:
FOUND

ADMIN_TEST ARCHITECTURE:
PARTIAL

SESSION ENGINE REUSE:
SAFE

DATABASE CHANGE:
NONE

NEW API REQUIRED:
YES

LEARNER DATA ISOLATION:
GAP

VOICE RUNTIME REUSE:
PASS

THERAPY ROOM REUSE:
PASS

AUTHORIZATION:
GAP

AUDIT:
GAP

RETENTION:
PRODUCT DECISION REQUIRED

PRODUCTION READINESS:
NOT READY

APPLICATION CODE CHANGED:
NO

DATABASE CHANGED:
NO

PRODUCTION DATA CHANGED:
NO
```

**STOP.** Assessment complete. No Phase 3C implementation performed.
