# CLAUDE.md

Guidance for AI assistants working in this repository.

## What this is

**vpsych** — a therapist-training platform. A trainee ("therapist") runs a
voice or text psychotherapy session against an AI standardized patient, and the
platform generates an **admin-only** performance report afterwards. Sessions are
bilingual (English / Arabic) and each locale's patient personality is *natively
authored*, never translated.

Stack: Next.js 16 App Router (React 19) · TypeScript (strict) · Tailwind v4 ·
Supabase (Auth + Postgres + RLS) · OpenAI / Vercel AI Gateway · ElevenLabs TTS ·
next-intl · Vitest · deployed on Vercel.

## Commands

```bash
npm install            # or npm ci
npm run dev            # local dev server
npm run build          # production build
npm run lint           # ESLint (flat config; warnings tolerated, errors are not)
npm run typecheck      # tsc --noEmit
npm test               # vitest run  (221 tests / 37 files, ~8s)
npm run test:watch
npm run test:migrations # migration filename/version integrity + optional remote parity
npm run test:reliability # calibration harness — calls a real provider, not in CI
```

CI (`.github/workflows/ci.yml`, Node 22) runs, in order: **lint → typecheck →
test → migration parity → build**. Run all five locally before pushing — the
build step is the one most likely to catch what the others miss.

`npm run test:migrations` also compares `supabase_migrations.schema_migrations`
against git when `SUPABASE_DB_URL` is set; without it, only local structure is
checked.

`npm run test:reliability` is **not** part of CI — it scores the calibration
corpus with a real provider and costs money. It skips cleanly without an API key.
See `docs/ASSESSMENT_RELIABILITY.md`.

## Layout

```
src/
  app/                    App Router
    (app)/                authenticated shell (AppShell + requireProfile)
      avatars/ sessions/ learning/ admin/
    api/                  Route Handlers (all JSON, all rate-limited)
    login/ signup/ auth/callback/
    error.tsx  global-error.tsx  (app)/error.tsx   ← error boundaries; keep them
  components/             client components (VoiceSession, ReportView, admin/, ace/, cge/)
  lib/
    ai/                   provider selection, patient agent, assessment, prompt engine
    ai/reliability*.ts    scoring reliability statistics + calibration harness
    ai/calibration*.ts    expert-scored corpus types, validator, loader
    ai/openai/            official OpenAI SDK client, retry, typed errors
    voice/                STT, TTS, ElevenLabs, voice registry, conversation pipeline
    case-engine/          Dynamic Clinical Case Engine
    scenario-templates/   Clinical Scenario Template Engine
    instructor-presets/   Instructor Preset Engine
    ace/                  Adaptive Curriculum Engine
    cge/                  Competency Graph Engine
    avatars/resolve.ts    Avatar row + locale + case snapshot → ResolvedAvatar
    supabase/             server / client / middleware / admin (service role)
    types.ts              shared domain types — the source of truth for DB row shapes
  i18n/                   next-intl config (cookie-driven locale)
  middleware.ts           auth gate + admin gate + locale cookie
messages/{en,ar}.json     UI strings
supabase/migrations/      27 SQL migrations — mirror of the deployed schema
supabase/functions/       Deno edge functions (send-email-hook)
personas/                 authoritative clinical case library (JSON)
calibration/              expert-scored transcripts for assessment reliability
schemas/avatar.v2.json    avatar schema
docs/                     engine specs + certification reports
scripts/                  migration parity check, production validation
```

Path alias: `@/*` → `./src/*` (configured in both `tsconfig.json` and
`vitest.config.ts`).

## The five engines

They stack; each builds on the one before it and none replaced an earlier API.
Read the matching file in `docs/` before changing any of them.

| Engine | Code | Doc |
|---|---|---|
| Dynamic Clinical Case Engine | `lib/case-engine/` | `docs/DYNAMIC_CLINICAL_CASE_ENGINE.md` |
| Clinical Scenario Template Engine | `lib/scenario-templates/` | `docs/CLINICAL_SCENARIO_TEMPLATE_ENGINE.md` |
| Instructor Preset Engine | `lib/instructor-presets/` | `docs/INSTRUCTOR_PRESET_ENGINE.md` |
| Adaptive Curriculum Engine (ACE) | `lib/ace/` | `docs/ADAPTIVE_CURRICULUM_ENGINE.md` |
| Competency Graph Engine (CGE) | `lib/cge/` | `docs/COMPETENCY_GRAPH_ENGINE.md` |

Core invariants:

- **A persona never permanently owns a disorder.** Every session mints a fresh
  immutable `CaseInstance`; the diagnosis lives in `sessions.clinical_snapshot`,
  not on the avatar. Locale affects speech and culture only — never diagnosis.
- ACE and CGE are **best-effort and non-blocking**. `runAceAfterAssessment`
  never throws and must never prevent a report from persisting. If ACE/CGE
  tables are missing, the session still completes.
- `lib/cge/index.ts` deliberately does **not** re-export `./ace-bridge` — that
  would recreate an ACE ↔ CGE import cycle. `src/lib/architecture.test.ts`
  enforces this.

## Session lifecycle

```
POST /api/sessions            → rate limit → createCaseForSession()
                                → INSERT sessions (case_instance_id, clinical_snapshot)
POST /api/sessions/[id]/message → ownership + active + time check
                                → resolveAvatar(avatar, language, {caseSnapshot})
                                → generatePatientReplyDetailed() → insert_assistant_message RPC
POST /api/sessions/[id]/end   → mark completed/expired → session_has_report (idempotency)
                                → assessSession() → signed create_session_report RPC
                                → runAceAfterAssessment() (best effort)
```

Sessions hard-expire at `MAX_SESSION_SECONDS` (40 min, `lib/types.ts`),
enforced server-side.

Voice path (`lib/voice/conversation-pipeline.ts`): therapist speech → OpenAI STT
(`/api/voice/transcribe`) → patient reply (`/api/sessions/:id/message`) →
ElevenLabs TTS (`/api/voice/tts`) → browser audio. Text-only sessions skip STT
and TTS and hit the same message API. Transcript persistence is always
server-side, regardless of mode.

## Database and RLS

Migrations in `supabase/migrations/` are the schema of record and mirror the
live project. Filenames must match `YYYYMMDDHHMMSS_snake_case_name.sql` with a
unique version — `npm run test:migrations` fails otherwise. Never edit a
migration that has already been applied; add a new one.

~45 tables. The ones you will touch most: `profiles`, `avatars`, `sessions`,
`session_messages`, `session_reports`, `voice_profiles`, `case_instances`,
`disorders`, `learner_profiles`, `learner_competencies`, `cge_nodes`/`cge_edges`,
`security_audit_events`.

Write rules that RLS enforces and application code must respect:

- `session_messages` RLS permits direct client inserts **only** for
  `role = 'user'`. Assistant and system messages go through the
  `insert_assistant_message` / `insert_system_message` SECURITY DEFINER RPCs,
  which re-check ownership, active status, and turn order.
- `session_reports` is written by `create_session_report`, an HMAC-signed
  insert-once RPC. The signed payload is
  `${sessionId}\n${narrative}\n${scoresJson}\n${excerptsJson}`, HMAC-SHA256 with
  `REPORT_WRITE_KEY`, which must equal the Postgres Vault secret
  `report_write_key`. Alternatively set `SUPABASE_SERVICE_ROLE_KEY` and the end
  route inserts directly. With neither set, session end 500s.
- Reads of `session_reports` are gated on `is_admin()`. Never expose reports on
  a therapist-facing API.
- Roles live in `profiles.role`, never in `user_metadata`.
- New RLS policies must wrap `auth.uid()` / `is_admin()` in `(select …)` so they
  evaluate once per statement rather than per row.

Use `messageRpcClient(userClient)` (`lib/supabase/admin.ts`) rather than
requiring a service role — it prefers service role when configured and falls
back to the authenticated client, since the RPCs enforce authorization
themselves. Hard-failing on an unset service role was a production outage
(`docs/FUNCTIONAL_CERTIFICATION.md`); `architecture.test.ts` guards against its
return.

## Auth and authorization

- **Server Components / pages**: `requireUser()`, `requireProfile()`,
  `requireAdmin()` from `lib/auth.ts` — these `redirect()`.
- **Route Handlers**: `requireApiUser()`, `requireApiAdmin()` from
  `lib/api-auth.ts` — these return JSON 401/403 and never redirect.
  `requireApiAdmin` writes a denied `security_audit_events` row automatically.
- `src/middleware.ts` handles the session refresh, the unauthenticated redirect
  to `/login?next=…`, the `/admin` + `/api/admin` edge gate, and the locale
  cookie. An explicit locale cookie always wins over `profiles.preferred_language`.

## Security conventions

These are load-bearing; several were fixed findings (see
`docs/PRODUCTION_SECURITY_CERTIFICATION.md`).

- Never return raw provider, Postgres, or environment detail to a client. Route
  through `clientSafeError()` (`lib/api-errors.ts`) or `sanitizeDbError()`
  (`lib/safe-client-error.ts`).
- Every Route Handler rate-limits before doing work: `await rateLimit(key, limit,
  windowMs)` and return 429 with a `Retry-After` header. Existing budgets are
  per-user per-hour — e.g. `msg` 120, `stt` 120, `tts` 60, `start` 30, `end` 20,
  admin previews 30. Uses Upstash Redis when `UPSTASH_REDIS_REST_URL`/`_TOKEN`
  are set, in-memory otherwise (not horizontally safe).
- Security headers (CSP, HSTS, COOP/CORP, Permissions-Policy) are a pure data
  module, `lib/security-headers.ts`, applied via `next.config.ts`. Adding a new
  external host means adding it to `connect-src` there and updating
  `security-headers.test.ts`. `/api/*` responses are `no-store`.
- Redirect targets must pass `lib/safe-redirect.ts`; passwords must pass
  `lib/password-policy.ts`.
- The service-role client is Route Handler / Server Action only, and its
  permitted call sites are documented in `lib/supabase/admin.ts` — keep that
  comment accurate if you add one.
- `/api/health/openai` requires admin. Do not relax it.
- Never commit secrets. `.env.production` intentionally holds only the public
  anon key. The `*.vpsych.test` demo accounts are deliberately banned and must
  not be re-enabled.

## AI provider selection

`lib/ai/provider.ts` is the single decision point, shared by patient chat and
assessment. Official OpenAI SDK when `OPENAI_API_KEY` is set (default model
`gpt-5`); Vercel AI Gateway when `AI_GATEWAY_API_KEY` is set;
`OPENAI_CHAT_PROVIDER=openai|gateway` forces a path. With no key at all, the
patient agent returns persona fallback replies rather than erroring.

Always propagate `aiSource` (`gpt` | `gateway` | `persona_fallback`) to the
client — a fallback reply must never be presented as a model reply.

## Assessment scoring

`weightedOverallScore()` in `lib/ai/reliability.ts` is the canonical 0–100
formula; `assessment.ts` delegates to it. Keep it that way — a second copy of
the formula would let reported scores and reliability measurements drift apart.

The platform's competency scores are **not yet validated**. The measurement
machinery exists (`npm run test:reliability`), but the corpus needs real
clinician ratings before any reliability claim can be made. Do not state or
imply that scores are validated in docs, UI copy, or certification reports
until `docs/ASSESSMENT_RELIABILITY.md` records published coefficients.

## i18n

Two locales, `en` and `ar`, driven by the `locale` cookie (no locale path
segment). Strings live in `messages/en.json` and `messages/ar.json` under the
same key tree (`meta common shell nav learning landing auth avatars sessions
session analysis report admin`) — **add every new key to both files**. Arabic is
RTL; use `localeDirection()` from `i18n/config.ts`.

Avatar personalities are separate: `en-US` and `ar-JO` are independently
authored humans with different names, cities, and idioms of distress. Never
machine-translate one into the other. `normalizeAvatarLocale()` maps UI locales
onto personality locales.

## Conventions

- TypeScript strict; no `any` in new code. Model DB rows against `lib/types.ts`
  and extend that file rather than redeclaring shapes locally.
- Tests are colocated as `*.test.ts` next to the module (vitest, `environment:
  node`, `include: src/**/*.test.ts`). Component `.tsx` files are not currently
  unit-tested.
- `src/lib/architecture.test.ts` is a guardrail suite that asserts invariants by
  reading source files. If it fails, the invariant is the thing to preserve —
  don't loosen the assertion to make it pass.
- Engine directories expose a barrel `index.ts`; import from the barrel
  (`@/lib/ace`), not from internal modules, except where a cycle forbids it.
- Route Handlers follow one shape: auth → rate limit → validate body → work →
  sanitized JSON. Keep it.
- `supabase/**` is excluded from ESLint and tsconfig — those functions run on
  Deno with URL imports.
- Validation is not uniform: Zod is used only in `lib/ai/assessment-parse.ts`;
  the engines use hand-written validators in their own `validation.ts`, and
  Route Handlers validate request bodies inline. Match the local file.

## Environment variables

`.env.example` is the full annotated list. Minimum for local dev:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Add
`OPENAI_API_KEY` (or `AI_GATEWAY_API_KEY`) for real patient replies and
assessments, `ELEVENLABS_API_KEY` for TTS, and one of `REPORT_WRITE_KEY` /
`SUPABASE_SERVICE_ROLE_KEY` for report generation.

Grant yourself admin after signing up:

```sql
update public.profiles set role = 'admin' where id = '<user-uuid>';
```

## Docs worth reading before large changes

`docs/ARCHITECTURE_CERTIFICATION.md`, `docs/PRODUCTION_SECURITY_CERTIFICATION.md`,
and `docs/FUNCTIONAL_CERTIFICATION.md` record the audits behind many of the
constraints above, including the specific regressions that motivated the
guardrail tests.
