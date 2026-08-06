# vpsych

Therapist training platform: practice voice therapy with preset patient avatars (disorder-specific personas), then generate an admin-only performance report after each session.

## Features (MVP)

- Auth with roles: `therapist` | `admin` (Supabase Auth + `profiles`)
- Preset avatars with persona prompts, ideal-session guidelines, and scoring rubric
- Voice-first sessions (browser speech recognition + speech synthesis), 40-minute max
- Patient replies via Vercel AI Gateway / AI SDK (heuristic fallback if no AI key)
- Post-session assessment stored with RLS — **admins only** can read reports

## Stack

- Next.js App Router + TypeScript + Tailwind
- Supabase (Auth, Postgres, RLS)
- Vercel AI SDK (`AI_GATEWAY_API_KEY`)

## Setup

1. Copy env template and fill values:

```bash
cp .env.example .env.local
```

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `AI_GATEWAY_API_KEY` (optional but recommended for realistic patient replies + assessments)

Required for **report generation** (choose one):

- `REPORT_WRITE_KEY` — the HMAC key the app uses to sign report writes. It
  **must equal** the Postgres Vault secret `report_write_key` (see
  `supabase/migrations/20260730181421_harden_session_reports.sql`). The app signs
  `${sessionId}\n${narrative}\n${scoresJson}\n${excerptsJson}` with HMAC-SHA256
  and passes it as `p_sig` to `create_session_report`.
- **or** `SUPABASE_SERVICE_ROLE_KEY` — if set, `/api/sessions/[id]/end` inserts
  the report with a service-role client instead of the signed RPC.

If neither is set, session end returns a 500 and no report is written.

2. Install and run:

```bash
npm install
npm run dev
```

3. Sign up as a therapist at `/signup`. Grant admin in SQL:

```sql
update public.profiles set role = 'admin' where id = '<user-uuid>';
```

> The `*.vpsych.test` demo accounts are intentionally **disabled**
> (`banned_until` set) by the security-hardening migration and must not be used
> for live access.

## Database migrations

The Postgres schema, RLS policies, SECURITY DEFINER RPCs, and the report-signing
contract live in `supabase/migrations/` and mirror what is deployed to the live
project. The report/message contract is defined in
`20260730181421_harden_session_reports.sql`:

- `create_session_report(uuid, text, text, text, text)` — HMAC-signed, insert-once
- `insert_assistant_message` / `insert_system_message` — RLS-safe writes for
  non-`user` message roles
- `session_has_report` — idempotency check callable by the session owner

The application calls these RPCs; it never inserts `assistant`/`system` messages
directly (RLS permits only `role = 'user'` on `session_messages`).

## Email confirmations (Resend)

Auth emails (signup confirmation, recovery, magic link, email change) are sent
through **Resend** via a Supabase Auth _Send Email_ hook — the edge function in
`supabase/functions/send-email-hook`. The hook links to the app-hosted
`/auth/confirm?token_hash=…&type=…` route (which calls `verifyOtp`) so recovery
does **not** depend on the Supabase Auth Site URL / redirect allow-list. Password
reset then continues on `/auth/reset-password`.

Deploy: `supabase functions deploy send-email-hook --no-verify-jwt --project-ref rrzudbkxigeavfdnidnm`

Activation (dashboard): verify a sending domain and set `AUTH_EMAIL_FROM`; enable
Authentication → Hooks → _Send Email_ pointing at
`https://rrzudbkxigeavfdnidnm.supabase.co/functions/v1/send-email-hook`; then set
edge-function secrets `RESEND_API_KEY`, `SEND_EMAIL_HOOK_SECRET`, `AUTH_EMAIL_FROM`,
and optionally `APP_URL=https://vpsych.vercel.app`. Until enabled, Supabase's
default mailer is used, so the live signup flow is unaffected.

Also set Authentication → URL Configuration **Site URL** to
`https://vpsych.vercel.app` (not `http://localhost:3000`) and allow
`https://vpsych.vercel.app/**` in Redirect URLs — required for any flow that still
uses GoTrue `/auth/v1/verify` redirects (default mailer / PKCE callback).

## Security notes

- Session reports are not exposed on therapist-facing APIs.
- `create_session_report` is a security-definer RPC that writes reports; only `is_admin()` policies allow reading `session_reports`.
- Do not put authorization in `user_metadata` — roles live in `profiles.role`.
- RLS policies wrap `auth.uid()` / `is_admin()` in `(select …)` so they evaluate
  once per statement (see `20260731110213_optimize_rls_initplan_and_fk_index.sql`).
- **Enable leaked-password protection** (Authentication → Policies) so Supabase
  checks new passwords against HaveIBeenPwned — this is a dashboard setting and
  is currently off.

## Scripts

- `npm run dev` — local development
- `npm run build` — production build
- `npm run lint` — ESLint
