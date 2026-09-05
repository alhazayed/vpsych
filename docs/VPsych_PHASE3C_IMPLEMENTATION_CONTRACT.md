# VPsych — Phase 3C Admin Test Conversation  
# Implementation & Safety Contract

**Document type:** Pre-implementation design / safety contract  
**Status:** BINDING for Phase 3C implementation (when authorized)  
**Based on:** `docs/VPsych_PHASE3C_ADMIN_TEST_READINESS_ASSESSMENT.md` (PR #196)  
**Authoritative main at assessment:** `cebb75d`  
**Phase 3B:** CLOSED / PRODUCTION VERIFIED — **do not modify**  
**This task:** Specification only — **IMPLEMENTATION NOT STARTED**

---

## Absolute rules (carry forward)

Do **not**, during contract work or until Phase 3C is explicitly authorized to code:

- modify production data or deploy Phase 3C
- create production test sessions or Virtual Patients
- modify Phase 3B lifecycle semantics / `lifecycle_status` machine
- modify learner scoring, ACE, CGE, or clinical competency algorithms
- merge PR #188 or PR #196 as a substitute for this contract
- create a second session engine, Therapy Room, or voice pipeline
- create migrations or change RLS / authentication in this phase
- invent a retention period without an explicit product decision

---

## 1. Executive Summary

Phase 3C adds an **Admin Test Conversation**: a persistent, admin-only session that exercises the **real** patient runtime (case mint, patient agent, messages, voice, Therapy Room / VoiceSession) while **never** entering the learner assessment → report → competency → ACE/CGE → portfolio → analytics pipeline.

| Item | Contract decision |
|---|---|
| Architecture | **EXISTING SESSION ENGINE + `admin_test` context + Therapy Room/VoiceSession TEST MODE + centralized end exclusion** |
| Marker | `sessions.clinical_snapshot.admin_test === true` (JSONB; no migration required for MVP) |
| Authoritative truth | **Session row** `clinical_snapshot.admin_test` (server-written only) |
| Central invariant | **Single gate in `POST /api/sessions/[id]/end`** after status close, before any learner post-processing — plus shared helper used by that gate |
| Create API | **NEW** `POST /api/admin/avatars/[id]/test-session` (Phase 3B surface) |
| Runtime APIs | **REUSE** message / STT / TTS / (hardened) end |
| Eligibility (locked for MVP) | See §7 — **`testing` ALLOW; `archived` DENY; draft/published = product decision with default DENY until decided** |
| Retention | **PRODUCT DECISION REQUIRED** (§11) |
| Database migration | **NONE** for MVP |
| New roles | **NONE** — reuse `profiles.role = 'admin'` |
| Implementation | **NOT STARTED** |

```text
PHASE 3C CONTRACT:        CREATED
DATA ISOLATION:           DEFINED
AUTHORIZATION:            DEFINED
API:                      DEFINED
SESSION END:              DEFINED
AUDIT:                    DEFINED
RETENTION:                PRODUCT DECISION REQUIRED
DATABASE CHANGE:          NONE
IMPLEMENTATION:           NOT STARTED
PRODUCTION DATA:          UNCHANGED
```

---

## 2. Existing Architecture (baseline — do not redesign)

### 2.1 Phase 3B avatar lifecycle (closed)

| `lifecycle_status` | `is_active` | Therapist visible | Admin visible |
|---|---|---|---|
| `draft` | false | No | Yes |
| `testing` | false | No | Yes |
| `published` | true | Yes | Yes |
| `archived` | false | No | Yes |

Canonical: `lifecycle_status`. Projection: `is_active` (published only).

### 2.2 Learner session path (main today)

```text
POST /api/sessions  (requires avatar.is_active)
  → createCaseForSession() → CaseInstance + CaseInstanceSnapshot
  → INSERT sessions (clinical_snapshot, therapist_id, …)
  → insert_system_message
  → VoiceSession | Therapy Room
  → STT → POST /api/sessions/[id]/message → TTS
  → POST /api/sessions/[id]/end
       → status completed|expired
       → assessSession
       → runEducationAfterAssessment (ACE + CGE bridge + portfolio analytics)
       → validation / supervisor / enterprise / realtime
       → runPatientMemoryAfterSession
       → session_reports (+ quality ledger)
```

### 2.3 Admin preview (not a test conversation)

`POST /api/admin/avatars/[id]/preview` — `resolveAvatar` (+ optional ephemeral case preview JSON). **No** `sessions` row. **No** messages. Explicitly defers persistent chat to Phase 3C.

### 2.4 PR #188 historical pattern (reference only — not on main)

- Create: set `clinical_snapshot.admin_test = true` (+ label) on insert.
- End: after status close, if `admin_test === true`, return `{ skippedAssessment: true }` **before** assess/report.
- Eligibility: non-`archived` (draft/testing/published allowed).
- Surface was `/api/admin/virtual-patients/...` — **do not resurrect**; use `/api/admin/avatars/...`.

---

## 3. Admin Test Data Model

### 3.1 Marker

```ts
// On sessions.clinical_snapshot (CaseInstanceSnapshot / JSONB)
{
  ...caseSnapshot,
  admin_test: true,
  admin_test_label: "ADMIN TEST — NOT A LEARNER SESSION"
}
```

| Field | Type | Required | Mutable after insert? |
|---|---|---|---|
| `admin_test` | `boolean` | yes for admin tests | **No** — treat as immutable |
| `admin_test_label` | `string` | recommended | No |

### 3.2 Where set

| Step | Action |
|---|---|
| `createCaseForSession()` / generator | Produces **normal** case snapshot — does **not** know about admin test |
| Admin test-session create route | **ONLY writer** of `admin_test: true` — spread onto snapshot **immediately before** `sessions` INSERT |
| `POST /api/sessions` (learner) | **MUST NEVER** set `admin_test` |
| Client / direct Supabase insert | **MUST NOT be trusted** as authorization (see §5, §14) |

**Answer to Part 1 Q1–Q4:**

1. **Where set?** On the session’s `clinical_snapshot` at **session insert** time (not on the avatar; not as a separate case_instances column for MVP).  
2. **Session vs snapshot creation?** Snapshot is minted first (case engine); marker is applied at **session creation** when persisting `clinical_snapshot`.  
3. **Authoritative source of truth?** `sessions.clinical_snapshot.admin_test === true` on the session row.  
4. **Propagation?** Copied only via that JSONB field on the session; message/voice routes do not need to re-stamp it; end route **reads** it; UI may mirror via server-loaded session payload (never via query string alone).

### 3.3 Helper (implementation requirement)

Introduce a single shared helper (name illustrative):

```ts
// e.g. src/lib/admin/admin-test-session.ts
export function isAdminTestSnapshot(snapshot: unknown): boolean
export function withAdminTestMarker(snapshot: CaseInstanceSnapshot): CaseInstanceSnapshot
export function assertAdminTestSkipAllowed(opts: {
  snapshot: unknown;
  callerIsAdmin: boolean;
  therapistId: string;
  callerId: string;
}): { ok: true } | { ok: false; reason: string }
```

All exclusion logic **must** call these helpers — no ad-hoc `snapshot.admin_test` checks scattered without the admin-role hardening.

---

## 4. Data Isolation Contract

### 4.1 Data-flow map (Admin Test Session)

| Node | Classification | Rule |
|---|---|---|
| Admin start API | **ALLOW** (admin only) | Create path; sets marker |
| `sessions` row | **ALLOW** | Persist; `therapist_id = admin user id` |
| `clinical_snapshot` | **ALLOW** + marker | Immutable case + `admin_test: true` |
| `case_instances` / case mint | **ALLOW** | Real case; memory_scope remains case_instance |
| `session_messages` | **ALLOW** | Real transcript for admin verification |
| Patient agent / emotion / adaptation (in-turn) | **ALLOW** | Same runtime as learners |
| STT / TTS / voice | **ALLOW** | Same pipeline |
| Therapy Room / VoiceSession UI | **ALLOW** + TEST MODE chrome | No fork |
| Session status → completed/expired | **ALLOW** | Normal close |
| `assessSession` | **BLOCK** | Must not run |
| `session_reports` / `create_session_report` | **BLOCK** | Must not insert |
| Quality ledger seal | **BLOCK** | Must not seal |
| Competency ingest / `learner_competencies` | **BLOCK** | Must not write |
| `runEducationAfterAssessment` | **BLOCK** | Must not run |
| ACE (`runAceAfterAssessment` / `persistLearnerUpdate`) | **BLOCK** | Must not run |
| CGE (via ACE bridge) | **BLOCK** | Must not run |
| Learning plan generation | **BLOCK** | Must not run |
| Portfolio (`buildTraineePortfolio` path in end) | **BLOCK** | Must not run |
| Supervisor / validation / enterprise / realtime after-assess | **BLOCK** | Must not run on end |
| `runPatientMemoryAfterSession` (end summarize) | **BLOCK** | Must not run on end |
| In-turn `prepareMemoryForTurn` | **ALLOW** for MVP runtime fidelity; **optional harden** to no-persist (PD-8) | See open decisions |
| Dyad CI seed at create | **ALLOW** scoped to admin+avatar; must not affect other therapists | Soft-fail OK |
| Learner `/sessions` history (therapist) | **IGNORE** / never own these rows | Therapist is not `therapist_id` |
| Admin `/sessions` list | **REQUIRES CHANGE** | Filter or badge admin_test rows |
| Research / analytics exports | **REQUIRES CHANGE** | Exclude `admin_test` |
| Notifications (learner report ready, etc.) | **BLOCK** / N/A | None if end skips |

### 4.2 Which systems already ignore admin tests?

**None on main.** Marker and skip do not exist. Any admin test created without this contract would be processed as a learner session.

### 4.3 Which systems would mistakenly process them today?

Everything downstream of `POST /api/sessions/[id]/end` after status close:

- `assessSession`
- `runEducationAfterAssessment` → ACE + CGE bridge + curriculum/portfolio analytics
- `runValidationAfterAssessment`
- `runSupervisorAfterAssessment`
- `runEnterpriseAfterAssessment`
- `runRealtimeAfterAssessment`
- `runPatientMemoryAfterSession`
- `session_reports` insert / `create_session_report`
- `sealAssessmentQualityLedger`

Also: unfiltered session lists / exports that select all sessions for a user.

### 4.4 Isolation invariants (normative)

1. **I1 — Write gate:** Only `POST /api/admin/avatars/[id]/test-session` may set `admin_test: true`.  
2. **I2 — End gate:** Learner post-processing runs **iff** `!isAdminTestSnapshot(snapshot)`.  
3. **I3 — Forgery gate:** Skip is allowed **iff** I2 **and** caller `profiles.role === 'admin'` **and** `session.therapist_id === caller.id`.  
4. **I4 — No learner report:** No `session_reports` row for admin-test sessions.  
5. **I5 — No competency/ACE/CGE/portfolio writes** for admin-test sessions.  
6. **I6 — Analytics:** Any aggregate over learner training sessions **must** exclude admin-test sessions (application filter on snapshot or future column).  
7. **I7 — Query string is not security:** `?adminTest=1` is UI-only.

---

## 5. Session-End Contract

### 5.1 PR #188 historical end-skip (evidence)

On PR #188 branch, after marking `completed`/`expired`, before `session_has_report` / `assessSession`:

```ts
if (snapshotMeta?.admin_test === true) {
  return NextResponse.json({
    ok: true,
    adminTest: true,
    skippedAssessment: true,
  });
}
```

Intended effect (and contract adoption):

| Effect | Required? |
|---|---|
| No assessment | **Yes** |
| No report | **Yes** |
| No competency update | **Yes** (via blocking education/ACE) |
| No learning-plan update | **Yes** |
| No portfolio update | **Yes** |
| No ACE/CGE update | **Yes** |
| Session still closes (status) | **Yes** |
| Idempotent re-end | **Yes** — already closed + skip again returns same shape |

### 5.2 Hardening beyond PR #188 (mandatory)

PR #188 checked **only** the JSON flag. Sessions INSERT RLS allows `therapist_id = auth.uid()` with arbitrary `clinical_snapshot`. A non-admin could forge `admin_test: true` to skip assessment.

**Contracted skip predicate:**

```text
SKIP_LEARNER_PIPELINE =
  isAdminTestSnapshot(clinical_snapshot)
  AND caller.profile.role === "admin"
  AND session.therapist_id === caller.id
```

If `admin_test === true` but caller is **not** admin → **do not skip**; treat as anomalous (log security event `admin.avatar.test_session.forged_skip_denied`, proceed with normal learner pipeline **or** return 403 — prefer **403** to avoid rewarding forgery with a free assessment skip).  
**Chosen rule:** **403 Forbidden** + audit `denied` when marker present and caller is not admin.

### 5.3 Central place of enforcement (ONE invariant)

| Location | Role |
|---|---|
| **`POST /api/sessions/[id]/end`** | **Primary / mandatory** choke point — all UI end paths call this |
| Shared helper `assertAdminTestSkipAllowed` | Single predicate used by end route |
| `assessSession` itself | **Do not** silently no-op; prefer never calling it. Optional assert throw if ever called with admin_test (belt-and-suspenders) |

**Do not** sprinkle independent skips inside ACE, education, report RPC, etc. as the *primary* control. Defense-in-depth filters in analytics are allowed **in addition**.

### 5.4 Ordered end algorithm (normative)

```text
1. Auth user
2. Rate limit `end`
3. Load session; require therapist_id === user.id (existing)
4. If status active → set completed|expired + ended_at
5. If isAdminTestSnapshot:
     a. If NOT (role admin AND owner): audit denied → 403
     b. Else: audit success end (optional) → 200 { ok, adminTest, skippedAssessment: true }
        STOP  // no assess, report, education, ACE, CGE, ledger, memory summarize, …
6. Else: existing learner pipeline unchanged
```

### 5.5 What must remain unchanged for non-admin-test sessions

Phase 3B and all learner semantics: **byte-for-byte behavioral continuity** when `admin_test` is absent/false.

---

## 6. Authorization Matrix

No new platform roles. Use `profiles.role` (`admin` | therapist) + existing `requireApiAdmin` / `requireApiUser` / ownership.

### 6.1 Matrix

| Operation | Anonymous | Therapist | Admin (owner) | Admin (other) |
|---|---|---|---|---|
| Start admin test | **DENY** | **DENY** | **ALLOW** (eligible avatar) | **ALLOW** (starts own session) |
| Continue admin test (message / STT / TTS) | **DENY** | **DENY** | **ALLOW** | **DENY** (not owner; message route ownership) |
| Read test session / transcript (API/UI) | **DENY** | **DENY** | **ALLOW** | **ALLOW** (RLS `is_admin()`; admin review) |
| End test session | **DENY** | **DENY** | **ALLOW** | **DENY** via ownership (unless future admin-force-end — **out of scope**) |
| Read another admin’s test | **DENY** | **DENY** | — | **ALLOW** (admin RLS select) |
| Delete test session | **DENY** | **DENY** | **PRODUCT DECISION** (default: no delete API in MVP) | Same |
| View test history | **DENY** | **DENY** | **ALLOW** (own + all via admin tools) | **ALLOW** |

### 6.2 Enforcement layers

| Layer | Mechanism |
|---|---|
| Middleware | Session refresh; `/admin` + `/api/admin` gated in supabase middleware helpers (existing admin edge gate) |
| Route / page | Admin VP pages: `requireAdmin` / `requireProfile`; session pages: owner check |
| API | Start: `requireApiAdmin`; message/end: auth + `therapist_id === user.id`; end skip: + admin role |
| Database / RLS | `sessions` select: owner **or** `is_admin()`; insert: `therapist_id = auth.uid()`; avatars: inactive readable by admin |
| Session ownership | `therapist_id` = creating admin |
| Audit | Deny on `requireApiAdmin`; success/failure on create/end; forged-skip denied |

### 6.3 Continue-path note

Message route today allows any authenticated owner. Contract: admin tests are only created by admins, so owner is admin. Therapists cannot obtain ownership of an admin-test session through the start API. URL guessing a session UUID still fails ownership unless they are the creator.

---

## 7. Avatar Eligibility

### 7.1 Preview vs Test Conversation

| | Admin Preview | Admin Test Conversation |
|---|---|---|
| API | `POST …/preview` | `POST …/test-session` |
| Persistent `sessions` row | No | Yes |
| Messages / voice loop | No | Yes |
| `admin_test` marker | N/A | Required |
| Learner analytics | N/A | Excluded |
| Purpose | Config / resolve / case JSON check | Behavioral verification with real runtime |

### 7.2 Lifecycle eligibility (contract)

| State | Start Test Conversation | Rationale |
|---|---|---|
| `draft` | **DENY (MVP default)** until PD-1 | Incomplete authorship; Preview may still run |
| `testing` | **ALLOW** | Phase 3B meaning: ready for administrator verification |
| `published` | **DENY (MVP default)** until PD-2 | PR #188 allowed; product must opt in for regression tests |
| `archived` | **DENY** | Matches PR #188; withdrawn patients |

**Final MVP rule (implementable without further assumption):**

```text
canStartAdminTest(lifecycle) := lifecycle === "testing"
```

Preview remains available per existing Phase 3B rules (not redefined here).

**Single function** `assertAvatarEligibleForAdminTest(avatar)` must encode this so PD-1/PD-2 can flip draft/published without scattering conditionals.

---

## 8. API Contract

### 8.1 Reuse (no duplicate engines)

| Method | Path | Admin test use |
|---|---|---|
| `POST` | `/api/sessions/[id]/message` | Continue conversation |
| `POST` | `/api/sessions/[id]/message/stream` | If used by UI — same ownership rules |
| `POST` | `/api/voice/transcribe` | STT |
| `POST` | `/api/voice/tts` | TTS |
| `POST` | `/api/sessions/[id]/end` | End + **skip gate** |
| `POST` | `/api/admin/avatars/[id]/preview` | Unchanged preview |

Do **not** require a separate admin message/voice stack.

### 8.2 NEW — `POST /api/admin/avatars/[id]/test-session`

| Field | Spec |
|---|---|
| Auth | Authenticated session |
| Role | `requireApiAdmin` (`action: "admin.avatar.test_session"`) |
| Rate limit | e.g. `admin-avatar-test:${userId}`, **20 / hour** (align PR #188 budget) |
| Input | `{ locale?: string; interactionMode?: "classic" \| "therapy_room" }` (body optional) |
| Validation | Avatar exists; `assertAvatarEligibleForAdminTest`; locale normalize |
| Lifecycle | MVP: must be `testing` |
| Session creation | `createCaseForSession` then INSERT with `withAdminTestMarker(snapshot)` |
| `clinical_snapshot` | Full case snapshot + `admin_test: true` + label |
| `therapist_id` | Admin `user.id` |
| System message | Admin-test label (no learner assessment wording) |
| Response `200` | `{ sessionId, path, adminTest: true, language, interactionMode, caseInstanceId?, … }` |
| `path` | `/sessions/{id}` or `/clinic/room/{id}` per mode + feature flags; query `adminTest=1` optional UI hint only |
| Errors | `401` unauth; `403` non-admin; `404` missing; `409` ineligible lifecycle; `429` rate; `500` sanitized |
| Audit | `admin.avatar.test_session` outcome success/failure; metadata: `{ avatarId, sessionId, lifecycle, interactionMode, locale }` — **no transcript** |
| Ownership | Creator admin |

### 8.3 CHANGED — `POST /api/sessions/[id]/end`

| Field | Spec |
|---|---|
| Auth / ownership | Unchanged load + owner check |
| New branch | §5.4 skip algorithm |
| Response (skip) | `{ ok: true, adminTest: true, skippedAssessment: true }` |
| Audit | `admin.avatar.test_session.end` on successful skip; `…forged_skip_denied` on marker+non-admin |
| DB | Status update only; **no** report |

### 8.4 OPTIONAL (not required for MVP)

| Method | Path | When |
|---|---|---|
| `GET` | `/api/admin/test-sessions/[id]` | If VP detail needs JSON without using learner complete page |
| `GET` | `/api/admin/avatars/[id]/test-sessions` | History list for one avatar |
| `POST` | `/api/admin/test-sessions/[id]/end` | **Avoid** unless product wants admin URL clarity; prefer hardened shared end |

### 8.5 Explicitly out of scope APIs

- `/api/admin/virtual-patients/*` resurrection  
- Parallel `/api/admin/test-sessions/.../message`  
- Learner `POST /api/sessions` overload with `adminTest` body flag (forbidden — would blur authz)

---

## 9. Therapy Room / VoiceSession Reuse

### 9.1 Principle

**Do not redesign.** Add TEST MODE chrome only.

### 9.2 Minimum UI requirements

| Concern | Spec |
|---|---|
| Entry point | Admin Virtual Patient detail / lifecycle actions when `lifecycle_status === "testing"`: “Start test conversation” |
| Routes | Reuse `/sessions/[id]` (classic) or `/clinic/room/[sessionId]` (Therapy Room when enabled) |
| Banner | Persistent visible: **ADMIN TEST — NOT A LEARNER SESSION** (EN + AR strings in both message files) |
| Server truth | Banner shown when loaded session snapshot has `admin_test` (not only query param) |
| Voice controls | Unchanged |
| Transcript | Unchanged persistence/visibility for owner |
| Termination | “End test” → `POST …/end` → on `skippedAssessment`, redirect to admin VP detail (not learner report/complete UX that implies scoring) |
| Refresh / resume | Same as learner: owner can reopen active session; banner remains |
| Navigation | Prefer return CTA to `/admin/avatars/[id]`; avoid implying ACE/next-case |
| History | MVP: list under admin VP detail **or** filter/badge in admin’s `/sessions` — must not present as learner assessment history |

### 9.3 Feature flags

Honor existing Therapy Room enablement. If Therapy Room off, classic VoiceSession is the admin test UI.

---

## 10. Audit Contract

Use existing `logSecurityEvent` → `log_security_event` RPC. Best-effort; never break primary path.

### 10.1 Events

| Action | When | outcome | resourceType | resourceId | metadata (allowed) |
|---|---|---|---|---|---|
| `admin.avatar.test_session` | Create attempt | success / failure / denied | `session` or `avatar` | sessionId or avatarId | `avatarId`, `sessionId`, `lifecycle`, `interactionMode`, `locale` |
| `admin.avatar.test_session.end` | Successful skip end | success | `session` | sessionId | `avatarId`, `skippedAssessment: true` |
| `admin.avatar.test_session.forged_skip_denied` | Marker present, non-admin end | denied | `session` | sessionId | `avatarId` |
| `admin.avatar.test_session.view` | Optional GET history/detail | success / denied | `session` | sessionId | `avatarId` |

Naming aligns with Phase 3B `admin.avatar.*` (not PR #188 `admin.virtual_patients.*`).

### 10.2 Actor / timestamp

- Actor: `auth.uid()` via RPC  
- Timestamp: DB `created_at` on `security_audit_events`  
- IP / UA: existing helper fields  

### 10.3 Forbidden in metadata

- Raw patient narrative  
- Full transcript / message bodies  
- Scores (N/A)  
- Unnecessary clinical formulation dumps  

---

## 11. Retention Options

**PRODUCT DECISION REQUIRED — do not implement a chosen policy in code until product selects.**

### Option A — Persistent admin test history

| Aspect | Notes |
|---|---|
| Clinical/data | Transcripts remain for admin review / regression comparison |
| Complexity | **Lowest** — sessions already persist; only need UI list + analytics exclusion |
| Audit | Create/end events remain; rows available for investigation |
| Storage | Grows with admin usage; subject to generic `purge_training_sessions_older_than` if invoked |
| Admin usefulness | **Highest** |
| Privacy | Admin-owned training artifacts; still not learner PHI; minimize cross-admin exposure via UI norms |

### Option B — Time-limited admin test sessions

| Aspect | Notes |
|---|---|
| Clinical/data | Auto-delete or archive after N days |
| Complexity | Medium — needs job/RPC filter on `admin_test` (generic purge today does **not** distinguish) |
| Audit | Keep security_audit_events longer than session rows |
| Storage | Bounded |
| Admin usefulness | Medium — lose old verification evidence |
| Privacy | Stronger storage limitation |

### Option C — Ephemeral (no persistent history)

| Aspect | Notes |
|---|---|
| Clinical/data | Delete session (+ cascade messages) on end or shortly after |
| Complexity | Higher — end path delete, or short TTL worker; fights “real transcript” debugging |
| Audit | Events only |
| Storage | Minimal |
| Admin usefulness | **Lowest** for multi-turn verification review |
| Privacy | Strongest |

### Compatibility without selecting policy

**Most compatible with existing architecture today: Option A** (persistent sessions + exclusion filters). Options B/C need extra machinery beyond current schema.  
Until product chooses, implementation **must not** add automatic admin-test deletion; document that generic retention purge would delete admin tests indiscriminately if run.

---

## 12. Data Model Recommendation

| Option | Description | Migration? | Verdict |
|---|---|---|---|
| **A. Snapshot-only** | `clinical_snapshot.admin_test` | No | **MVP recommendation** |
| **B. Session-level column** | e.g. `sessions.is_admin_test boolean` | Yes | Optional later for indexed filters |
| **C. Both** | Column synced from snapshot | Yes | Future hardening / analytics scale |

**Evidence for A:**

- PR #188 used snapshot-only successfully as a design.  
- `clinical_snapshot` is already the session’s immutable clinical bag.  
- Assessment doc: **DATABASE CHANGE: NONE**.  
- End route already loads `clinical_snapshot`.  

**Caveat:** JSONB filter in SQL exports is clumsier than a column — accept for MVP; revisit B/C if analytics exclusion becomes hot-path.

**Recommendation:** **A for Phase 3C-1…5**; do not create a migration now. If product later needs indexed exclusion, additive column sync is a separate change request.

---

## 13. Assessment / Report Exclusion Matrix

All automatic post-session processing on main end route:

| Processor | On `admin_test` + valid admin skip | Notes |
|---|---|---|
| Status → completed/expired | **RUN** | Close session |
| `session_has_report` | **SKIP** (not reached) | |
| `assessSession` | **BLOCK** | |
| `runEducationAfterAssessment` | **BLOCK** | Includes ACE + curriculum + portfolio assembly |
| ACE `persistLearnerUpdate` / competencies | **BLOCK** | |
| CGE ace-bridge | **BLOCK** | |
| Learning plan generation | **BLOCK** | |
| Portfolio build (end path) | **BLOCK** | |
| `runValidationAfterAssessment` | **BLOCK** | |
| `runSupervisorAfterAssessment` | **BLOCK** | |
| `runEnterpriseAfterAssessment` | **BLOCK** | |
| `runRealtimeAfterAssessment` | **BLOCK** | |
| `runPatientMemoryAfterSession` | **BLOCK** | End summarize |
| `session_reports` insert / RPC | **BLOCK** | |
| `sealAssessmentQualityLedger` | **BLOCK** | |
| Client “report ready” UX | **BLOCK** | Redirect to admin VP, not learner complete-as-scored |
| Notifications | **N/A / BLOCK** | None should fire for learner reports |

**In-session (message) processors** remain **ALLOW** for runtime fidelity (patient agent, emotion, adaptation, optional memory read). They must not write learner competency tables (they do not today).

---

## 14. Security

| Question | Contract answer |
|---|---|
| Can admin access another admin’s test? | **Yes** for read (RLS `is_admin()`). Continue/end require ownership. |
| Can therapist guess test-session URLs? | May hit page; **redirect/403** — not owner; cannot message/end |
| Does RLS protect test sessions? | Same as all sessions: owner or admin select; insert as self; no special RLS change required for MVP |
| Is API authorization sufficient for start? | **Yes** if `requireApiAdmin` on create |
| Are session IDs enumerable? | UUIDs; unauthenticated denied; non-owners denied |
| Rate limiting? | Yes on create (`admin-avatar-test`) and existing msg/stt/tts/end budgets |
| Forged `admin_test`? | End returns **403** + audit; does not skip |
| Weaken RLS / auth? | **Forbidden** |
| Service role for create? | Prefer user-scoped client + existing RPCs (`messageRpcClient` pattern); no new service-role authoring |

---

## 15. Error / Recovery

| Failure | Safe behavior |
|---|---|
| Case mint fails before session insert | Return error; **no** session row; no marker orphan |
| Session insert fails after case mint | Return 500 sanitized; case_instance may exist unused — acceptable; do not write admin_test elsewhere |
| Snapshot marker omitted by bug | Session behaves as learner session for that admin — tests must catch; treat as P0 bug |
| Avatar archived while test active | **Allow conversation to finish** (historical sessions immutable per Phase 3B); **block new** starts; do not mutate snapshot |
| Admin session expires (max duration) | Existing `expireStaleSession` → expired status; end/skip path still applies on finalize |
| Browser closes | Session remains `active` until expiry/end; resume with banner |
| Voice provider fails | Same as learner: show error; transcript may still persist via text |
| Patient agent fails | Same as learner: sanitized error / persona_fallback labeling rules unchanged |
| Session-end fails mid-status-update | Retry end; idempotent skip once closed |
| Assessment pipeline accidentally invoked with admin_test | Must not happen if end gate holds; optional assert in helper; if reached, **refuse** to persist report (fail closed on learner writes) |

---

## 16. Test Strategy

### 16.1 Authentication / authorization

- Anonymous start → 401  
- Therapist start → 403 + denied audit  
- Admin start on `testing` → 200 + marker  
- Therapist message on admin’s session → 403  
- Therapist end on admin’s session → 403  
- Non-admin forged snapshot end → 403 + `forged_skip_denied`  
- Other admin read transcript → allowed (RLS)  
- Other admin end → 403 (not owner)

### 16.2 Lifecycle

- `draft` start → 409 (MVP)  
- `testing` start → 200  
- `published` start → 409 (MVP) until PD-2  
- `archived` start → 409  

### 16.3 Isolation

- After end: **no** `session_reports` row  
- ACE/learner_competencies unchanged for admin user  
- Education/portfolio/supervisor/enterprise hooks not invoked (spy/unit)  
- Analytics helper excludes admin_test  
- Historical learner sessions untouched  

### 16.4 Runtime

- Message uses `generatePatientReplyDetailed` path  
- STT/TTS same routes  
- Therapy Room / VoiceSession mount with banner when flag on/off  
- EN + AR locales resolve via existing avatar personalities  

### 16.5 Session end

- Skip response shape stable  
- Re-end idempotent  
- Active → completed/expired still applied  
- Learner sessions without marker unchanged (regression)

### 16.6 Architecture guardrail

- Extend `architecture.test.ts` (or sibling) to assert end route contains admin-test skip **before** `assessSession`, and create route sets marker only under admin API path.

---

## 17. Implementation Phases

**Do not implement until authorized. Sequence:**

### PHASE 3C-1 — Data isolation foundation

- Shared helpers (`isAdminTestSnapshot`, `withAdminTestMarker`, `assertAdminTestSkipAllowed`)  
- Types: optional `admin_test` / `admin_test_label` on snapshot type  
- End-route gate + forged-skip denial  
- Unit tests for helper + end skip  

### PHASE 3C-2 — Admin test session API

- `POST /api/admin/avatars/[id]/test-session`  
- Eligibility function (`testing` only MVP)  
- Audit create  
- Rate limit  

### PHASE 3C-3 — Therapy Room / VoiceSession TEST MODE

- Entry button on admin VP detail  
- Banner + end redirect UX  
- i18n EN/AR  
- History badge/filter (minimal)  

### PHASE 3C-4 — Audit logging

- Create/end/forged events wired and covered by tests  
- Metadata scrub review  

### PHASE 3C-5 — Tests

- Full §16 matrix (unit + route integration)  
- Architecture guardrails  

### PHASE 3C-6 — Production verification

- Non-seed `testing` avatar only  
- Prove no learner report/ACE contamination  
- Prove Maya/Jordan and learner aggregates unchanged  
- Record acceptance doc (separate from Phase 3B)  

**Retention policy implementation:** only after product selects §11 option — may land as 3C-7 if not A-default.

---

## 18. Open Product Decisions

| ID | Decision | MVP contract default | Blocks? |
|---|---|---|---|
| **PD-1** | Allow admin test on `draft`? | **DENY** | No — Preview covers draft checks |
| **PD-2** | Allow admin test on `published`? | **DENY** | No — can revisit for regression |
| **PD-3** | Retention A / B / C | **Unset** — **PRODUCT DECISION REQUIRED** | Soft — ship A-compatible persistence without auto-delete |
| **PD-4** | Cross-admin transcript visibility in UI | RLS allows; UI may list all or own-only | Soft |
| **PD-5** | Delete/cleanup API | None in MVP | Soft |
| **PD-6** | Dedicated admin end URL | No — shared hardened end | Soft |
| **PD-7** | Admin-only verification note (non-`session_reports`) | None in MVP | Soft |
| **PD-8** | Disable in-turn patient-memory persistence for admin tests | Optional harden | Soft |

---

## 19. Production Readiness Gate

Phase 3C may be declared production-ready only when **all** are true:

| Gate | Criterion |
|---|---|
| Code | 3C-1…3C-5 merged with CI green (lint, typecheck, test, migrations parity, build) |
| Isolation | Automated proof: end skip; no report; no ACE/competency writes |
| Security | Forged-skip denied; therapist/anonymous denied start |
| Lifecycle | Only `testing` starts (unless PD-1/2 amended in writing) |
| UX | Banner visible; no learner score UX on end |
| Audit | Create (+ end) events observed in verification |
| Clinical safety | No Maya/Jordan mutation; no real-patient data in VP authoring |
| Retention | PD-3 recorded even if “defer / use A” |
| Phase 3B | Unchanged / still closed |
| Acceptance | Separate Phase 3C production acceptance record |

Until then: **PRODUCTION READY = NOT READY**.

---

## Document control

| Item | Value |
|---|---|
| Assessment | `docs/VPsych_PHASE3C_ADMIN_TEST_READINESS_ASSESSMENT.md` |
| Contract | `docs/VPsych_PHASE3C_IMPLEMENTATION_CONTRACT.md` (this file) |
| Phase 3B acceptance | `docs/VPsych_PHASE3B_PRODUCTION_ACCEPTANCE.md` — immutable |
| PR #188 | Reference only — do not merge for Phase 3C |
| Implementation | **NOT STARTED** |

**STOP.**
