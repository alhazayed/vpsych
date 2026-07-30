# Vercel ↔ GitHub ↔ Supabase alignment

Checked 2026-07-30 against live systems.

## Identity map

| System | Resource | Status |
|--------|----------|--------|
| GitHub | `alhazayed/vpsych` (public, default `main`) | OK — homepage set to `https://vpsych.vercel.app` |
| Vercel | Project `vpsych` (`prj_qiJ1mQvX0s5lJZ9KJnpWAx4EXjNm`, team `alhazayed-1540s-projects`) | **Broken serving** — see below |
| Supabase | Project `vpsych` (`rrzudbkxigeavfdnidnm`, us-east-1, ACTIVE_HEALTHY) | OK |

## What aligns

- **GitHub → Vercel git integration works.** Pushes create deployments with correct `githubOrg`/`githubRepo`/`githubCommitSha` (e.g. preview for PR #4 on `cursor/vpsych-security-audit-69cd`).
- **Supabase public keys match repo `.env.production`.** URL `https://rrzudbkxigeavfdnidnm.supabase.co` and anon JWT ref `rrzudbkxigeavfdnidnm` match the live project.
- **Preview builds compile successfully** (Next.js App Router routes listed in logs, including `/api/sessions/*`).
- **Deployment Protection is off** (password/SSO/Trusted IPs disabled).

## What’s broken / misaligned

### 1. Vercel project not serving traffic (`live: false`)

- API reports `"live": false` on the project.
- Every URL returns platform `x-vercel-error: NOT_FOUND`, including:
  - `https://vpsych.vercel.app` (GitHub homepage)
  - Production deployment URL `https://vpsych-i1c4hq2ae-alhazayed-1540s-projects.vercel.app`
  - Latest preview URL / branch alias
- Builds show **READY** with full route tables, so this is a **Vercel routing/live-state issue**, not a Next.js compile failure.
- Known recovery path: Dashboard → Redeploy latest Production from Git (clear build cache), or if `live` stays false, **delete + re-import** the GitHub repo into a fresh Vercel project ([community reports](https://community.vercel.com/t/production-deployment-ready-promoted-but-returns-not-found-live-false/40388)).

### 2. Framework / build settings corrupted

- Project `framework` is `null` (should be Next.js).
- Failed production deploy `dpl_3Ep8wNVFckXAKsJJCAkg2Az8hhDP`:
  - Downloaded **1 file** (not a full Git checkout)
  - Error `missing_pages_app` / `npm run vercel-build`
- Other CLI-style production deploys used a hacky install:
  `git clone ... /tmp/vpsych-src && cp -a ... && npm install`
- **Fix in Vercel Project Settings → General / Build & Development:**
  - Framework Preset: **Next.js**
  - Root Directory: `.` (empty)
  - Install Command: **default** / `npm install` (remove git-clone override)
  - Build Command: **default** / `next build` (or rely on repo `vercel.json`)
  - Output Directory: leave default (unset for Next.js)

Repo now includes `vercel.json` pinning Next.js install/build.

### 3. Production domain vs GitHub homepage

- GitHub `homepageUrl` = `https://vpsych.vercel.app`
- Domain has been assigned on some older READY production deployments, but current project `domains` list only shows team `*.vercel.app` aliases and the site 404s.
- After restoring `live`, confirm **Domains** includes `vpsych.vercel.app` assigned to Production.

### 4. Env secrets not in Vercel (only public keys in git)

Present via `.env.production` at build time:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `AI_MODEL`

**Missing on Vercel (must add for Production + Preview):**

| Variable | Purpose |
|----------|---------|
| `REPORT_WRITE_KEY` | HMAC for `create_session_report` (vault `report_write_key`) |
| *or* `SUPABASE_SERVICE_ROLE_KEY` | Preferred privileged writes |
| `AI_GATEWAY_API_KEY` | Real patient/assessment AI (else heuristics) |

See `docs/OPS_SECRETS.md`.

### 5. Supabase Auth URL alignment (manual check)

In Supabase Dashboard → Authentication → URL configuration, set:

- **Site URL:** `https://vpsych.vercel.app` (once that domain serves)
- **Redirect URLs:** include  
  `https://vpsych.vercel.app/auth/callback`  
  and preview pattern if using email confirm:  
  `https://*-alhazayed-1540s-projects.vercel.app/auth/callback`

Signup currently uses `emailRedirectTo: ${origin}/auth/callback`. Email confirm is enabled (`mailer_autoconfirm: false`).

### 6. Security branch not on Production yet

- Production Git SHA on last good main deploy: `c331d73` (pre-audit remediations).
- Audit + hardening is on draft PR #4 (`cursor/vpsych-security-audit-69cd`) — preview builds only until merge.
- Merging before fixing `live: false` / env secrets will still leave the site unreachable or `/end` failing closed.

## Recommended fix order

1. **Vercel Dashboard** — clear bad Install/Build overrides; set Framework = Next.js.
2. **Redeploy Production** from `main` (clear cache). Confirm `https://vpsych.vercel.app` returns 200.
3. If still `live: false` / platform NOT_FOUND → delete project and re-import `alhazayed/vpsych` from GitHub; re-add domain + env.
4. Add `REPORT_WRITE_KEY` (or service role) + `AI_GATEWAY_API_KEY` to Vercel env.
5. Align Supabase Auth Site URL + redirect allowlist to `vpsych.vercel.app`.
6. Merge PR #4 and confirm a new Production deploy serves the hardened app.
