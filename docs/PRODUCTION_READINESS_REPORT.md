# Production Readiness Report — Mission Omega

**Date:** 2026-08-06 · **SHA:** `7dc9a35` · **Deploy:** `dpl_2fxxbz…`

## Checklist (PASS / FAIL / NOT APPLICABLE only)

| # | Item | Result |
|---|------|--------|
| 1 | Production deploy READY | **PASS** |
| 2 | Production git SHA matches `origin/main` | **PASS** |
| 3 | Migration filenames ≡ remote `schema_migrations` | **PASS** (61≡61 after Ω remediations) |
| 4 | Public landing / login / signup reachable | **PASS** |
| 5 | Legal pages + robots/sitemap public | **PASS** |
| 6 | Unauthenticated APIs return JSON 401 | **PASS** |
| 7 | `/api/health` healthy | **PASS** |
| 8 | Admin APIs require auth | **PASS** (401 without token) |
| 9 | Auth-gated session create/message/end smoke (this run) | **FAIL** — audit credentials invalid |
| 10 | Auth-gated TTS smoke (this run) | **FAIL** — blocked by #9 |
| 11 | Prior Wave 3 TTS/session evidence retained | **PASS** (RDL-024/025) — not re-executed |
| 12 | RLS enabled on public tables sampled | **PASS** |
| 13 | Reports not therapist-readable (design) | **PASS** (architecture + prior RLS probes) |
| 14 | Experimental engines absent from production runtime | **PASS** |
| 15 | Therapy Room flag default off | **PASS** |
| 16 | npm audit critical/high | **PASS** (0) |
| 17 | Local typecheck | **PASS** |
| 18 | Local vitest | **PASS** (317) |
| 19 | Local lint errors | **PASS** (0 errors / 12 warnings) |
| 20 | Secrets not in git | **PASS** (`.env.production` public keys only) |
| 21 | Demo `*.vpsych.test` accounts banned | **PASS** |
| 22 | Fictional patients only | **PASS** |
| 23 | Competency scores validated | **FAIL** — explicitly not claimed |
| 24 | Monitoring (Sentry/APM) production-complete | **FAIL** — residual ops |
| 25 | DR / backup drill certified | **FAIL** — documented backlog |
| 26 | Leaked-password protection enabled | **FAIL** — Supabase advisor |
| 27 | Open experimental PRs frozen from merge | **PASS** (policy; 33 open held) |
| 28 | Documentation matches production posture | **PASS** (Omega + RC1) |
| 29 | Rate limiting present on route handlers | **PASS** |
| 30 | Security headers module present | **PASS** |

## Summary counts

| Result | Count |
|--------|------:|
| PASS | 24 |
| FAIL | 6 |
| NOT APPLICABLE | 0 |

**Interpretation:** Failures are either **known limitations** (validation/monitoring/DR), **ops residuals** (HIBP, audit vault), or **this-run credential blockage**. They do not overturn Limited Professional Preview under published constraints; they **do** block ✅ Expert Clinical Validation and public GA.

## Deployment parity detail

| System | Value |
|--------|-------|
| GitHub `main` | `7dc9a3581d37a403120fdf5b7514d074f0c4952b` |
| Vercel production | Same SHA · `dpl_2fxxbzKUwpPCg2QzB3ZiYKQE2saC` |
| Migrations | 61 remote ≡ 61 git (incl. CQG restore + TRM `20260806135528`) |
| Post-freeze merges on baseline | #139 HCF · #140 password recovery · #143 TRM · #142 validation portal |

## Environment parity (inspectable)

| Variable class | Status |
|----------------|--------|
| `NEXT_PUBLIC_SUPABASE_*` | Present (public) |
| `OPENAI` / Gateway / ElevenLabs / report keys | Not inspectable via MCP; inferred from prior Wave evidence + health |
| `NEXT_PUBLIC_THERAPY_ROOM_MODE` | Not set / off (code default) |
| `VPSYCH_AUDIT_*` in this agent | Present keys, **invalid passwords** |
