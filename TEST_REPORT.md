# vpsych — Test Report

- **Build under test:** branch `cursor/vpsych-mvp-dde8` @ `5acb206` ("Document demo accounts and ship production public env")
- **Backend:** hosted Supabase project `vpsych` (`rrzudbkxigeavfdnidnm`)
- **Date:** 2026-07-31

## Summary

The build compiles cleanly and the admin/read side works, but **the core therapist session loop is broken end-to-end** in the current environment. Two critical failures both trace to the same root cause: the shared Supabase backend was hardened by a separate security-audit effort whose **matching app-code changes were never merged into this build**, so the app and database are now out of sync.

## Static checks — PASS

| Check | Command | Result |
|---|---|---|
| Install | `npm install` | ok |
| Lint | `npm run lint` | clean, no warnings |
| Build | `npm run build` | success, 13 routes compiled |
| Dev server | `npm run dev` | serves on `:3000` |

## Critical findings

### 1. Patient never replies — `session_messages` INSERT blocked by RLS

Sending a therapist turn returns HTTP 500 and the transcript stays empty. Exact UI error:

```
new row violates row-level security policy for table "session_messages"
```

- **Root cause:** the live INSERT policy is now `with_check: (role = 'user' AND session owned & active)`. The server inserts the patient reply as `role='assistant'` (and a `role='system'` start message) via the user-scoped Supabase client, so both are rejected. Reproduced directly against PostgREST: inserting an `assistant` row returns `42501`.
- **DB evidence:** the therapist demo session `e1614668` has `user=2, assistant=0, system=0`, whereas older pre-hardening sessions have full `system/user/assistant` counts.
- **Impact:** Critical — the primary use case (a voice/text therapy session with patient responses) is non-functional.

### 2. Session end never stores a report — RPC signature mismatch

`POST /api/sessions/[id]/end` calls:

```
create_session_report(p_session_id, p_scores, p_narrative, p_excerpts)
```

but the deployed function is now:

```
create_session_report(p_session_id, p_scores_json text, p_narrative text, p_excerpts_json text, p_sig text)
```

The call fails with `PGRST202` ("Could not find the function … in the schema cache"), so no report row is created (`session_reports` count stayed at 2 after completing a session).

- **Compounding UX bug:** `VoiceSession.endSession()` does `await fetch(...)` and then navigates to the completion page **without checking `res.ok`**, so the user always sees "A performance assessment report was generated and stored securely" — even though the write failed.
- **Impact:** Critical — no assessment reports are produced for new sessions, and the UI misreports success.

### Root cause (both criticals)

Branch `cursor/vpsych-security-audit-69cd` (commit `81a46ce`) applied migrations (`20260730_harden_session_reports.sql`) to the shared Supabase project **and** added the required app-side counterparts:

- `src/lib/report-sign.ts` — computes the `p_sig` HMAC expected by the new RPC signature
- `src/lib/supabase/admin.ts` — service-role client used to insert `assistant`/`system` messages, bypassing the `role='user'` policy
- updated `src/app/api/sessions/route.ts`, `src/app/api/sessions/[id]/message/route.ts`, `src/app/api/sessions/[id]/end/route.ts`

Those app changes are **not** present in the tested build, so the code no longer matches its own backend. Merging/aligning that branch's application changes is the fix.

## Configuration / data findings

- **Demo accounts were unusable:** both `therapist@vpsych.test` and `admin@vpsych.test` had `banned_until = 2099-01-01` → login returns `user_banned`. The README advertises them as working demo logins.
- **Role mismatch:** `admin@vpsych.test` had `role='therapist'` in `profiles`, not `admin` as the README table claims — so it would be denied admin pages.

## Minor findings

- Unauthenticated API calls (`/api/sessions`, `/api/sessions/[id]/message`, `/api/voice/transcribe`) return `307` redirects to `/login` (middleware) rather than the JSON `401` the route handlers implement — API clients get HTML redirects instead of a clean 401.
- On the message error, the therapist's own (successfully persisted) turn isn't shown in the transcript, because the client only appends messages when the API returns both user + assistant messages.
- Boot warning (benign): `The "middleware" file convention is deprecated. Please use "proxy" instead.`
- `package-lock.json` is not committed on this branch (only restored on the audit branch), so installs aren't locked here.

## What works (verified)

- Auth/login, role-gated routing, and the full **admin read path**: `/admin/reports` (lists reports with scores), report detail, and `/admin/avatars` (presets with goals + rubric).
- RLS model is correct on reads: therapist sees only active avatars + own profile and gets `[]` from `session_reports`; admin can read reports. Confirmed via PostgREST with each account's JWT.

## Data changes made during testing (disclosure)

To get past the blocked demo accounts and exercise the admin path, two **data-only** edits were made in the Supabase project (no code changes):

- cleared `banned_until` for both demo accounts
- set `admin@vpsych.test` → `role='admin'`

These only align the DB with what the README documents. The RLS/RPC mismatches were intentionally **not** patched, so the critical bugs remain reproducible for review.

## Test artifacts

Captured during this run (stored with the agent run):

- `vpsych_admin_reports_flow_working.mp4` — admin login → reports list → report detail → avatar presets
- `admin_reports_list.webp` — admin reports list
- `admin_report_detail.webp` — admin report detail
- `bug_therapist_message_rls_error.webp` — therapist session showing the RLS error
