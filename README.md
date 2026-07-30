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
- `REPORT_WRITE_KEY` **or** `SUPABASE_SERVICE_ROLE_KEY` (server-only; required to finalize session reports)
- `AI_GATEWAY_API_KEY` (optional but recommended for realistic patient replies + assessments)

`REPORT_WRITE_KEY` must match the Supabase Vault secret `report_write_key`:

```sql
select decrypted_secret from vault.decrypted_secrets where name = 'report_write_key';
```

Set the same value in Vercel project env (Production + Preview) as `REPORT_WRITE_KEY`.

2. Install and run:

```bash
npm install
npm run dev
```

3. Sign up as a therapist at `/signup` (password min 8 chars).

Promote admins in SQL (do **not** commit demo passwords for shared/prod projects):

```sql
update public.profiles set role = 'admin' where id = '<user-uuid>';
```

## Security notes

- Session reports are not exposed on therapist-facing APIs.
- Report writes require a server HMAC (`REPORT_WRITE_KEY`) or `service_role` insert; unsigned RPC calls are rejected.
- Session timer fields and reopen are blocked by a DB trigger; therapists may only insert `user` messages directly.
- Do not put authorization in `user_metadata` — roles live in `profiles.role`.
- See `docs/AUDIT.md` for the audit and remediation status.

## Scripts

- `npm run dev` — local development
- `npm run build` — production build
- `npm run lint` — ESLint
