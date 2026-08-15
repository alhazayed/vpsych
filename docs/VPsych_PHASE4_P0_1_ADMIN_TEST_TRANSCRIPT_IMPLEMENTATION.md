# VPsych — Phase 4 P0-1 Implementation Record
## Admin Test Transcript Review Surface

**Date:** 2026-08-15 (UTC)
**Branch:** `claude/phase4-p0-1-admin-test-transcript`
**Base:** `claude/vpsych-cursor-handoff-h1qovr` @ `ead49c1` (≡ `origin/main` `09cec18` + Phase 4 docs)
**Production SHA at time of work:** `7222e6c` — confirmed ancestor of `origin/main`; **unchanged**
**Authorization:** `docs/VPsych_PHASE4_READINESS_ASSESSMENT.md` (finding C-2) ·
`docs/VPsych_PHASE4_OPEN_DECISIONS_REGISTER.md` (§9, item P0-1)

**Database migration:** NONE · **Schema:** UNCHANGED · **RLS:** UNCHANGED ·
**Production:** UNCHANGED · **Phase 3 behaviour:** UNCHANGED

> **Scope note.** The authorization message cited `docs/VPsych_PHASE4_EXECUTIVE_DECISION_BRIEF.md`.
> That brief was delivered in conversation and was never written to the repository, so it does not
> exist as a file. The two documents above carry the same P0-1 authorization and were used instead.
> No file was created to fill the gap, as that was not in the authorized scope.

---

## 1. Problem

Phase 3C persists Admin Test Conversations to `session_messages` like any other session, but
deliberately creates **no `session_reports` row** — that is the point of the assessment skip.
The consequence, recorded in the readiness assessment, is that the transcript becomes
unreachable through the product UI:

```
completed admin-test session
  → /sessions/[id]           status !== "active"      → redirect /sessions/[id]/complete
  → /sessions/[id]/complete  isAdminTestSnapshot      → redirect /admin/avatars/[id]
  → /admin/avatars/[id]      no transcript view
  → /admin/reports/[id]      requires a session_reports row that never exists
```

Every path loops back to the avatar page. Reviewing what the virtual patient actually said
required direct database access. The feature whose purpose is qualifying avatars could not
display the evidence it generates.

P0-1 closes exactly that gap and nothing else.

---

## 2. Architecture

```
/admin/avatars/[id]                    (existing page, extended)
   └── Overview tab
         └── "Admin test conversations" list          ← NEW section
               └── link → /admin/test-sessions/[sessionId]

/admin/test-sessions/[sessionId]       ← NEW server page
   ├── requireAdmin()                          server-side gate
   ├── SELECT sessions (+ avatars join)        user-scoped client, RLS is_admin()
   ├── isAdminTestSnapshot(clinical_snapshot)  → notFound() when false
   ├── SELECT session_messages                 ordered created_at ASC
   ├── logSecurityEvent(...transcript_view)
   └── render: AdminTestBanner · metadata · AdminTestTranscript
```

Server Components throughout. No new API route — the page reads directly through the
authenticated Supabase server client, the same pattern as `/admin/reports/[sessionId]`.
No new UI framework, no new authorization architecture, no client-side data fetching.

---

## 3. Routes and components changed

| Path | Change | Notes |
|---|---|---|
| `src/app/(app)/admin/test-sessions/[sessionId]/page.tsx` | **New** | Server page; authorization, admin-test gate, data read, audit, render |
| `src/components/admin/AdminTestTranscript.tsx` | **New** | Presentation-only message list; no data access, no authorization |
| `src/app/(app)/admin/avatars/[id]/page.tsx` | Modified | Fetches the avatar's admin-test sessions server-side; passes `testSessions` |
| `src/components/admin/VirtualPatientDetail.tsx` | Modified | Optional `testSessions` prop; renders the list section in the Overview tab |
| `messages/en.json` · `messages/ar.json` | Modified | `admin.testTranscript` key block, +32 lines each, identical trees |
| `src/lib/admin/admin-test-transcript.architecture.test.ts` | **New** | Security and scope guardrails |

**Reused unchanged:** `requireAdmin` (`lib/auth.ts`) · `isAdminTestSnapshot`
(`lib/admin/admin-test-session.ts`) · `AdminTestBanner` · `AdminPageHeader` · `StatusBadge` ·
`logSecurityEvent` · next-intl · existing design tokens and `clinical-card` styling.

**Deliberately not touched:** the Phase 3C end-of-session redirect targets in `VoiceSession`,
`TherapyRoom`, and `TherapyRoomSession`; the `/sessions` list `sessionHref` behaviour; the
end-route skip gate; the test-session creation route.

---

## 4. Authorization model

Four independent layers, none of them new:

| # | Layer | Effect |
|---|---|---|
| 1 | `src/middleware.ts` edge gate | `/admin/*` requires `profiles.role = 'admin'` |
| 2 | `requireAdmin()` in the page | Anonymous → `redirect("/login")`; non-admin → `redirect("/avatars")` + denied `security_audit_events` row |
| 3 | Postgres RLS | `sessions` SELECT `therapist_id = auth.uid() OR is_admin()`; `session_messages` SELECT `is_admin() OR EXISTS(owner)` — **unchanged** |
| 4 | Admin-test marker check | `isAdminTestSnapshot(typed.clinical_snapshot)` read from the persisted row; `notFound()` when false |

**Properties held:**

- **No `service_role`.** The page uses the `requireAdmin()`-scoped user client. `createServiceClient`
  and `messageRpcClient` are absent, and asserted absent by test.
- **No RLS change.** Admin read access already existed; this surface consumes it.
- **Server-side boundary only.** The transcript component performs no authorization and contains
  no data access; it carries an explicit comment saying it must never be treated as a boundary,
  and a test asserts that comment plus the absence of any client or auth call.
- **Consistent with Phase 3C.** An admin who is not the session owner can read the transcript,
  matching the Phase 3C authorization matrix row *"Read transcript · Other admin · ALLOW (RLS
  `is_admin()`)"*. Semantics are unchanged.

### Admin-test identification

The admin-test determination is made **only** from `sessions.clinical_snapshot` as persisted by
the server, through the shared `isAdminTestSnapshot` helper. The page reads no `searchParams`,
no `?adminTest=1`, no `localStorage`, and no client-provided flag — each asserted absent by test.
The gate runs **before** the `session_messages` query, so a learner session id 404s without any
message content being loaded.

---

## 5. Data source

| Field group | Source | Handling |
|---|---|---|
| Transcript | `session_messages` — `id, role, content, created_at`, ordered `created_at ASC` | Rendered verbatim, `whitespace-pre-wrap`. Never altered, regenerated, or summarised |
| Speaker distinction | `session_messages.role` (`system` / `user` / `assistant`) | Preserved and visually distinguished; labelled System / Therapist (admin) / Patient |
| Session metadata | `sessions` — `id, avatar_id, status, started_at, ended_at, created_at, language, interaction_mode, clinical_snapshot` | Display only |
| Avatar identity | `avatars` join — `id, name, slug, disorder` | Display only |

Reads only. No `insert` / `update` / `upsert` / `delete` anywhere in the surface, asserted by test.
No patient agent, no case engine, no assessment, no STT, no TTS, no session creation — all
asserted absent by test.

### Non-learner labelling

Three independent signals, none of them frontend-only text:

1. `AdminTestBanner`, driven by the **server-provided** `clinical_snapshot` (the same component
   Phase 3C uses in-session), rendering `ADMIN TEST — NOT A LEARNER SESSION` /
   `اختبار إداري — ليس جلسة لمتدرب`.
2. An explicit notice stating the transcript has no assessment, no report, and no competency
   scores and must not be read as a learner performance record.
3. A metadata row `Admin test: Yes — confirmed from stored session state`.

The page cannot render at all for a non-admin-test session, so the labelling can never be
false: reaching this route is itself proof of the marker.

---

## 6. Security tests

`src/lib/admin/admin-test-transcript.architecture.test.ts` — 17 tests in 5 groups.

| Requirement | Covered by |
|---|---|
| 1 · Anonymous blocked | `requireAdmin` → `requireUser` → `redirect("/login")` asserted present |
| 2 · Therapist blocked | `requireAdmin` role check → `redirect("/avatars")` + denied audit |
| 3 · Admin allowed | `requireAdmin()`-scoped client is the only data path |
| 4 · Non-admin authenticated blocked | Same gate as 2 — the model is role-based, not therapist-specific |
| 5 · Learner session not reachable by id manipulation | Marker gate asserted present **and** asserted to precede the message query |
| 6 · Client-provided `admin_test` cannot authorize | `searchParams`, `adminTest=1`, `localStorage`, and literal marker assignment all asserted absent |

Additional guardrails: no service role · no parallel authorization path · component holds no
authorization · read-only data access · no patient/voice/assessment invocation · verbatim content
· roles preserved · access audited · no review workflow, scoring, verdict, or approval controls ·
no migration · Phase 3C redirect targets and marker writer/strip/skip-gate all still intact.

### Honest limitation

These are **source-invariant assertions**, in the established style of
`src/lib/architecture.test.ts` and `admin-test-phase3c.architecture.test.ts` — they prove the
security properties hold *in the code as written*. They are not runtime HTTP tests. The
repository has no request or component integration harness: vitest runs `environment: node` over
`src/**/*.test.ts`, and `.tsx` files are not unit-tested. Building such a harness would have
exceeded the authorized scope, so it was not done. **Runtime verification of layers 1–3 against a
running instance remains outstanding** and is noted below.

No production test session was created. No fixture data was added.

---

## 7. Regression tests

Full mandated suite executed on this branch:

| Command | Result |
|---|---|
| `npm run audit:deps` | **PASS** — 0 vulnerabilities |
| `npm run lint` | **PASS** — 0 errors, 13 warnings (pre-existing, unchanged) |
| `npm run typecheck` | **PASS** |
| `npm test` | **PASS** — 724 tests / 88 files (was 707 / 87; +17 tests, +1 file) |
| `npm run test:migrations` | **PASS** — local structure OK; remote parity skipped (`SUPABASE_DB_URL` unset) |
| `npm run test:perf-smoke` | **PASS** |
| `npm run build` | **PASS** |

CI was not weakened: no test was skipped, relaxed, or deleted, and no lint rule was disabled.
i18n key parity verified independently: **1085 / 1085**, en and ar.

---

## 8. Explicitly out of scope — not implemented

Per the authorization, none of the following were built, and no groundwork for them was laid:

clinical sign-off · clinical reviewer workflow · reviewer scoring · QA verdicts · approval
workflow · evidence package · content versioning · content hash · clinical validation ·
psychometric validation · reliability harness · Arabic validation workflow · voice validation
workflow · publication gate changes · lifecycle changes · new avatar authoring fields · new
database tables · new database migration · production deployment · Phase 4 Track B · forged
`admin_test` remediation · retention policy · clinical safety incident workflow.

The surface adds **no** rating controls, clinical verdicts, approve/reject buttons, reviewer
comments, scoring, or analytics. Those depend on governance decisions OD-17, OD-22, OD-24 and
OD-26, none of which are resolved and all of which are owned by a Clinical Governance Lead who
is not yet identified.

### Adjacent problems deliberately left alone

- **`/sessions` admin list still links completed admin tests to `/admin/avatars/[id]`.** The
  transcript is reachable from there in one further click, so the authorized flow is satisfied
  without editing a Phase 3C-adjacent file.
- **Ops session counts remain unfiltered** (readiness assessment F-2) — out of scope.
- **Dyad carry and admin-home badging** (F-3, F-4) — out of scope.

### Follow-up worth recording, not acted on

- Runtime verification of the four authorization layers against a running instance.
- **The Arabic UI strings were authored without a native-speaker review.** They follow the
  existing `ADMIN_TEST_BANNER_AR` register, but should be ratified by an Arabic-speaking
  reviewer — the same caution the validation protocol records for the Arabic opening prompt
  (OD-7). This is UI chrome, not patient content, so it does not touch the never-translate rule
  for avatar personalities.

---

## 9. Stop conditions

None were triggered. The surface required no migration, no schema change, no RLS modification,
no authentication change, no `service_role`, no production write, no lifecycle change, no
scoring or assessment logic, no change to learner sessions, reports, ACE/CGE or competencies,
no change to Admin Test semantics, and no change to Phase 3 behaviour.

---

## 10. Status

```text
P0-1:                 IMPLEMENTED
DATABASE MIGRATION:   NONE
SCHEMA:               UNCHANGED
RLS:                  UNCHANGED
PHASE 3:              UNCHANGED
TRACK B:              NOT STARTED
PRODUCTION:           UNCHANGED
PR:                   NOT CREATED
PHASE 4:              CONTINUES AS VALIDATION READINESS
```
