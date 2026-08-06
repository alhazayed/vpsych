# Dependency Audit — Mission Omega

**Date:** 2026-08-06  
**Command:** `npm audit` → **0** vulnerabilities (info/low/moderate/high/critical)  
**Runtime:** Node 22 (CI) · Next.js **16.2.12** · React **19.2.4**

## Production dependencies

| Package | Declared | Role | Notes |
|---------|----------|------|-------|
| `next` | 16.2.12 | App framework | Pinned with eslint-config-next |
| `react` / `react-dom` | 19.2.4 | UI | |
| `typescript` | ^5 | Types (dev) | |
| `@supabase/ssr` | ^0.12.4 | Auth cookies | |
| `@supabase/supabase-js` | ^2.111.0 | DB/Auth client | |
| `openai` | ^7.3.0 | Official SDK path | |
| `ai` / `@ai-sdk/openai` | ^7 / ^4 | Gateway/AI SDK | |
| `next-intl` | ^4.13.4 | i18n | |
| `@upstash/ratelimit` / `redis` | ^2 / ^1.38 | Optional rate limit | |
| `zod` | ^4.4.3 | Assessment parse | |
| `date-fns` | ^4.4.0 | Dates | |
| `tailwindcss` | ^4 | Styling (dev) | |
| `vitest` | ^3.2.7 | Tests (dev) | |
| `supabase` CLI | ^2.110.0 | Migrations tooling (dev) | |

## Overrides

| Package | Override | Reason |
|---------|----------|--------|
| `postcss` | ^8.5.25 | Supply-chain pin |
| `sharp` | ^0.35.0 | Image pipeline pin |

## External services (not npm)

| Service | Use | License/terms |
|---------|-----|---------------|
| Supabase | Auth + Postgres | Cloud SaaS |
| OpenAI / Vercel AI Gateway | LLM | Provider ToS |
| ElevenLabs | TTS | Provider ToS |
| Upstash | Redis rate limit | Optional |
| Vercel | Hosting | Platform |

## License compatibility

Application is `private: true`. Dependencies are mainstream permissive OSS (MIT/Apache-style). No copyleft conflict identified for private SaaS deployment. **Not a legal opinion.**

## Outdated / residual

| Item | Status |
|------|--------|
| Azure Speech / Deepgram env docs | Legacy unused — STT is OpenAI-only |
| `hasAzureSpeech()` export | Dead code residue |
| Package version `0.1.0` | Not tagged `1.0.0` — intentional for preview |

## Verdict

**PASS** for limited preview — clean advisory audit, modern stack aligned with CLAUDE.md.
