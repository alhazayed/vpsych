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

2. Install and run:

```bash
npm install
npm run dev
```

3. Sign up as a therapist at `/signup`, or use the seeded demo accounts:

| Email | Password | Role |
|-------|----------|------|
| `therapist@vpsych.test` | `therapist123` | therapist |
| `admin@vpsych.test` | `admin12345` | admin |

Promote additional admins in SQL:

```sql
update public.profiles set role = 'admin' where id = '<user-uuid>';
```

## Demo verification

RLS check: therapists can create session reports via RPC but **cannot SELECT** `session_reports`; admins can. Confirmed against the live Supabase project.

## Security notes

- Session reports are not exposed on therapist-facing APIs.
- `create_session_report` is a security-definer RPC that writes reports; only `is_admin()` policies allow reading `session_reports`.
- Do not put authorization in `user_metadata` — roles live in `profiles.role`.

## Scripts

- `npm run dev` — local development
- `npm run build` — production build
- `npm run lint` — ESLint
