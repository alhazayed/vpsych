# vpsych security & architecture audit

**Date:** 2026-07-30  
**Scope:** Next.js app (`/workspace`), live Supabase project `rrzudbkxigeavfdnidnm`  
**Verdict:** MVP authz for admin-only report *reads* is sound (RLS + no report payload on therapist APIs). Report *integrity*, session timer enforcement, and demo credentials on the live project are not.

---

## Summary

| Severity | Count | Themes |
|----------|------:|--------|
| HIGH     | 5     | Demo admin access, report forge/overwrite, timer bypass, open redirect |
| MEDIUM   | 7     | Prompt/persona leakage, injection, rate limits, open signup, migrations |
| LOW      | 3     | Error detail leakage, API HTML redirects, client end-session handling |

---

## What’s working

- Roles live in `profiles.role`; signup trigger forces `therapist` (not JWT `user_metadata`).
- Profile self-update `WITH CHECK` blocks changing own `role`.
- `session_reports` SELECT/UPDATE are `is_admin()` only.
- `/api/sessions/[id]/end` does not return report content to therapists.
- Message/end routes check `therapist_id === user.id`.
- SECURITY DEFINER functions set `search_path TO 'public'`.
- App uses anon key + user JWT only (no `service_role` in the Next.js bundle).

---

## HIGH findings

### H1 — Live demo admin credentials

`README.md` documents:

| Email | Password | Role (verified) |
|-------|----------|-----------------|
| `therapist@vpsych.test` | `therapist123` | therapist |
| `admin@vpsych.test` | `admin12345` | admin |

Both users exist in production Auth. Combined with committed `.env.production` (real project URL + anon key), anyone can sign in as admin and read all session reports/transcripts.

**Remediation:** Disable or rotate these accounts; remove plaintext passwords from README (use ephemeral seed on non-prod only).

---

### H2 — Therapists can forge / overwrite session reports via RPC

`public.create_session_report` is `SECURITY DEFINER`, granted to `authenticated`, and **upserts** caller-supplied scores:

```sql
insert into public.session_reports (...)
on conflict (session_id) do update
  set scores = excluded.scores,
      narrative = excluded.narrative,
      excerpts = excluded.excerpts
```

A therapist cannot `SELECT` reports (good), but can call `/rest/v1/rpc/create_session_report` with fabricated scores and overwrite a real assessment before admin review. Supabase advisor flags this as `authenticated_security_definer_function_executable`.

**Remediation (preferred):** Revoke `EXECUTE` from `authenticated`/`anon`; write reports only from a server route using `service_role`.  
**Minimum:** Change conflict handling to `DO NOTHING` (insert-once) so overwrites stop — forging the first write still possible until EXECUTE is revoked.

See `supabase/migrations/20260730_harden_session_reports.sql`.

---

### H3 — Report existence check is dead for therapists

`src/app/api/sessions/[id]/end/route.ts` SELECTs `session_reports` before writing. Therapists are blocked by RLS, so `existing` is always null → every `/end` re-assesses and hits the upsert RPC (extra AI cost + overwrite).

**Remediation:** Rely on insert-once RPC (H2) or a security-definer “report_exists” helper; do not SELECT reports as a therapist.

---

### H4 — Session timer / status bypass via direct client updates

API enforces remaining time on `/message`, but RLS policy **“Therapists can update own sessions”** has no `WITH CHECK` / column restriction. A therapist using the browser anon client can:

- `update sessions set max_duration_sec = 999999`
- `update sessions set started_at = now()`
- reopen `status = 'active'` after completion

Client timer in `VoiceSession` trusts those DB fields.

**Remediation:** Restrict updatable columns (trigger or split policies); prefer server-only updates for status/timing. See migration file.

---

### H5 — Open redirect on auth callback / login `next`

```ts
// src/app/auth/callback/route.ts
return NextResponse.redirect(new URL(next, request.url));
```

`new URL("https://evil.example", request.url)` resolves externally. Login client uses `router.push(next)` with the same user-controlled query param.

**Remediation:** Allow only same-origin relative paths (leading `/`, no `//`). Patched in this PR via `src/lib/safe-redirect.ts`.

---

## MEDIUM findings

### M1 — Persona / rubric leakage to client + RLS

Session page selects `avatars(*)` into a client component (`VoiceSession`), serializing `persona_prompt` (and rubric/guidelines) to the browser. Separately, RLS **“Authenticated can read active avatars”** allows full-row SELECT — UI omission on `/avatars` is not a control.

**Impact:** Trainees can read system prompts and game the simulation / assessment.

**Remediation:** Client selects omit `persona_prompt` / `rubric`; keep them server-only for AI routes. Consider a view or column privilege split. App-side strip patched in this PR (RLS still exposes columns via PostgREST until DB change).

### M2 — Message `role` spoofing

`session_messages` INSERT policy checks ownership + active session, not `role = 'user'`. Therapists can insert `assistant`/`system` rows and poison transcripts/assessments.

### M3 — Prompt injection (patient + assessment)

User turns are embedded in model context with soft constraints only. Assessment embeds the full transcript. Structured Zod output helps but does not eliminate score inflation attempts.

### M4 — No rate / size limits on AI routes

`/message` and `/end` accept unbounded text and call paid AI. `/api/voice/transcribe` is authed but not session-bound — any user can burn Deepgram quota if configured.

### M5 — Middleware has no admin role gate

`/admin/*` only requires a logged-in user at the edge; `requireAdmin()` runs in RSC. Fine for current page-only admin UI; fragile if admin APIs are added later.

### M6 — Open self-signup + weak password posture

`/signup` has no invite/domain allowlist. Client `minLength={6}` only. Supabase advisor: **leaked password protection disabled**.

### M7 — Schema/migrations not versioned in git

Live migrations exist only remotely. Drift risk and no reviewable DDL history.

---

## LOW findings

| ID | Finding | Location |
|----|---------|----------|
| L1 | Deepgram error `detail` returned to client | `src/app/api/voice/transcribe/route.ts` |
| L2 | Unauthenticated `/api/*` get HTML login redirects | middleware treats APIs like pages |
| L3 | `endSession` ignores non-OK HTTP, still navigates to complete | `VoiceSession.tsx` |

---

## Privacy notes

| Data | Storage | Who can read (RLS) |
|------|---------|--------------------|
| Transcripts | `session_messages` | Owner therapist + admins |
| Session metadata | `sessions` | Owner + admins |
| Assessment reports | `session_reports` | **Admins only** |
| Avatar persona / rubric | `avatars` | All authenticated (active) |
| Profiles | `profiles` | Self + admins |

No retention/deletion UX, no admin access audit log. Voice primarily uses browser Web Speech API (on-device); optional Deepgram uploads audio when `DEEPGRAM_API_KEY` is set.

---

## Supabase advisors (live)

1. `create_session_report` / `current_user_role` / `is_admin` executable by `authenticated` as SECURITY DEFINER — [lint 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
2. Leaked password protection disabled — [docs](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

---

## Priority remediation order

1. ~~Rotate/disable demo accounts; scrub passwords from README.~~ **Done** (accounts banned; admin demoted)
2. ~~Harden `create_session_report` (insert-once + signed writes).~~ **Done** (vault HMAC; service_role path supported)
3. ~~Fix `/end` idempotency without therapist SELECT.~~ **Done** (`session_has_report`)
4. ~~Restrict `sessions` UPDATE columns / timer fields.~~ **Done** (trigger)
5. ~~Sanitize `next` redirects.~~ **Done**
6. ~~Strip sensitive avatar columns from client payloads.~~ **Done** (RLS still allows column SELECT via PostgREST)
7. ~~Rate-limit + message length caps; constrain message `role` on insert.~~ **Done**
8. Version SQL in-repo — **Done**. Enable HIBP in Supabase Auth dashboard — **still manual**.

---

## Remediation shipped

- Applied live migration `harden_session_reports` (signed insert-once reports, session update guard, message role policies, demo ban)
- App: signed `/end`, `session_has_report` short-circuit, assistant/system via definer RPCs, rate limits, API JSON 401, middleware `/admin` role gate
- **Ops required:** set `REPORT_WRITE_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) on Vercel — value is vault secret `report_write_key`
- **Ops recommended:** enable leaked-password protection in Supabase Auth
