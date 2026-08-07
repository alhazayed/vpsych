# Deployment Guide — VPsych Version 1.0

**Audience:** DevOps / Release Manager  
**Stack:** Vercel (Next.js 16) · Supabase (Auth + Postgres) · Optional Upstash Redis · Optional Cloudflare DNS/CDN  
**Cert:** Stage 12 · `1.0.0-rc.1`

## 1. Environments

| Env | Purpose | Branch |
|-----|---------|--------|
| Production | Institutional users | `main` auto-deploy |
| Preview | PR validation | Vercel PR previews |
| Local | Dev | `.env.local` from `.env.example` |

Production URL: `https://vpsych.vercel.app`  
Supabase ref: `rrzudbkxigeavfdnidnm` (us-east-1)

## 2. Vercel

1. Project linked to GitHub `alhazayed/vpsych`.  
2. Framework preset: Next.js (`vercel.json`).  
3. Node: align with CI (**22**).  
4. Production tracks `main`.  
5. After merge: confirm deploy **READY** and SHA ≡ `git rev-parse origin/main`.  
6. Rollback: Vercel → Deployments → Promote prior READY deploy (instant). Prefer forward-fix when migrations already applied.

### Edge / middleware

- `src/middleware.ts`: session refresh, unauthenticated redirect, `/admin` + `/api/admin` gate, locale cookie.  
- Security headers via `next.config.ts` ← `lib/security-headers.ts`.  
- Adding external hosts requires `connect-src` update + `security-headers.test.ts`.

## 3. Supabase

1. Migrations in `supabase/migrations/` are schema of record (**68** files at Stage 12 baseline).  
2. Never edit applied migrations; add `YYYYMMDDHHMMSS_snake_case.sql`.  
3. Apply with CLI or MCP; ensure filename version ≡ `schema_migrations.version`.  
4. Local/CI: `npm run test:migrations` (remote parity when `SUPABASE_DB_URL` set).  
5. Auth: JWT expiry, email hooks (`supabase/functions/send-email-hook`), enable leaked-password protection.  
6. Vault: `report_write_key` must match `REPORT_WRITE_KEY` when using signed RPC.

## 4. Cloudflare (optional)

- DNS proxy / WAF in front of Vercel is supported when SSL mode is Full (strict).  
- Do not terminate auth cookies incorrectly; prefer Vercel as origin.  
- Cache rules: **bypass** `/api/*` (already `no-store`). Static `_next/static` may cache.

## 5. Redis (Upstash) — recommended now, required for multi-instance RL

```
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Without these, rate limits are **per-instance memory** (not horizontally safe).

## 6. Environment template

Copy `.env.example`. Minimum production:

| Variable | Required |
|----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` | Yes |
| `REPORT_WRITE_KEY` and/or `SUPABASE_SERVICE_ROLE_KEY` | Yes (reports) |
| `OPENAI_API_KEY` or `AI_GATEWAY_API_KEY` | Recommended |
| `ELEVENLABS_API_KEY` (`sk_…`) | Recommended (voice) |
| `UPSTASH_REDIS_*` | Recommended |
| `ELEVENLABS_TIMEOUT_MS` | Optional (default 30000) |
| Feature flags (`NEXT_PUBLIC_THERAPY_ROOM_MODE`, `FEATURE_REALTIME_*`) | Default **off** |

Admin ops snapshot: `GET /api/admin/ops/metrics` (authz + rate-limited).

## 7. Scaling strategy

| Layer | Strategy |
|-------|----------|
| Next.js | Vercel Fluid / serverless concurrency |
| DB | Supabase compute + connection pooling; watch `session_messages` growth |
| Rate limits | Upstash sliding window |
| Voice | Provider quotas (OpenAI STT, ElevenLabs TTS); cache short TTS |
| Realtime / Enterprise stores | In-process today — plan Redis/Postgres (ENT-08, RT-S11-02) before mega-tenants |
| CDN | Vercel / Cloudflare for static assets |

## 8. Release gates (CI)

`.github/workflows/ci.yml` on `main` / PRs:

`npm ci` → **audit:deps** → lint → typecheck → test → migration parity → **perf-smoke** → build

## 9. Semantic versioning

| Version | Meaning |
|---------|---------|
| `1.0.0-rc.1` | Stage 12 Release Candidate |
| `1.0.0` | Board-approved GA tag after RC soak + RDL |

## 10. Related

- Stage 10 deploy notes: `docs/stage10/DEPLOYMENT_GUIDE.md`  
- Ops: `OPERATIONS_RUNBOOK.md`  
- DR: `DISASTER_RECOVERY.md`
