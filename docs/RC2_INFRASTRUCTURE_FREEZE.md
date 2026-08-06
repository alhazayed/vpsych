# RC2 — Infrastructure Freeze (checklist + evidence)

**Status:** PARTIAL — #100 deployed to production (`52a7610` / `dpl_2mBqyfz…`); migration parity still open via PR #103

**RC3:** Started 2026-08-04 — see `docs/RC3_PRODUCTION_VALIDATION.md` (Wave 1 **FAIL** on migration drift + auth E2E block).  
**Rule:** No feature work. Ops and synchronization only.  
**Owner:** alhazayed (Aladdin Zayed)

---

## Preconditions

| Gate | State |
|------|-------|
| RC1 #100 review | Ready to merge when human review passes |
| Production code SHA | Still `3765103` until #100 merges — RC1 remediations **not** live yet |
| Feature PRs | Frozen: only #100 is release-critical |

**Do not start RC3 load/browser certification against production until #100 is deployed.**

---

## Checklist

### A. GitHub ↔ Vercel ↔ Supabase

| Check | Evidence (2026-08-04) | Pass? |
|-------|----------------------|-------|
| `main` == production deploy SHA | Prod still on `3765103`; #100 not merged | ⚠ pending merge |
| Preview deploy for #100 | Vercel preview exists for RC branch | ✅ |
| Supabase project | `rrzudbkxigeavfdnidnm` ACTIVE_HEALTHY us-east-1 | ✅ |
| Domain / DNS | `vpsych.vercel.app` resolves (Vercel anycast) | ✅ |
| TLS / HSTS | HTTP/2 200 + `strict-transport-security` preload | ✅ |

### B. Migration history

| Check | Evidence | Pass? |
|-------|----------|-------|
| Remote applied versions | **53** (incl. `20260804055602` restore grants) | — |
| Repo migration files on #100 | **28** | — |
| Version ID parity | **FAIL** — remote engine/cert timestamps diverge from git filenames (e.g. remote `20260802180922` vs local `20260802180000`) | ❌ |
| Dangerous drift | Draft-agent migrations applied to prod without matching git history | ❌ Critical ops |

**RC2 remediation (ops, not features):**

1. Export remote migration list (done via Supabase MCP).  
2. For each remote version missing from git: recover SQL from the closed PR branch that applied it **or** write a documented no-op stub **only if** already applied (never re-apply).  
3. Rename/align local engine migration filenames only if safe for fresh environments; prefer dual-tracking table in `docs/MIGRATION_PARITY.md`.  
4. Gate: `npm run test:migrations` with `SUPABASE_DB_URL` must report `ok: true`.

### C. Environment variables (finalize — no secrets in git)

Required for production (verify in Vercel project settings):

| Variable | Purpose | RC2 verify |
|----------|---------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client | ☐ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client | ☐ |
| `NEXT_PUBLIC_APP_URL` | Canonical origin | ☐ set to `https://vpsych.vercel.app` |
| `OPENAI_API_KEY` or `AI_GATEWAY_API_KEY` | Patient AI | ☐ |
| `ELEVENLABS_API_KEY` | TTS | ☐ |
| `REPORT_WRITE_KEY` and/or `SUPABASE_SERVICE_ROLE_KEY` | Reports / privileged RPC | ☐ at least one |
| `UPSTASH_REDIS_REST_URL` + `TOKEN` | Distributed rate limits | ☐ recommended |
| Auth email (Resend hook secrets on Supabase) | Signup/reset | ☐ |

### D. Monitoring

| Check | Pass? |
|-------|-------|
| Public `/api/health` on production after #100 | ☐ (currently **307** pre-merge) |
| Error tracking (Sentry or Vercel log drains) | ☐ not configured |
| Uptime check on `/api/health` | ☐ |
| Alert on 5xx / health fail | ☐ |

### E. Backups

| Check | Pass? |
|-------|-------|
| Supabase PITR / daily backups enabled | ☐ verify in dashboard |
| Document restore owner + RTO/RPO | ☐ |
| Do **not** roll back grant migration `20260804055602` | ✅ noted |

### F. Email delivery

| Check | Pass? |
|-------|-------|
| Signup confirmation delivers | ☐ |
| Password reset delivers | ☐ |
| From-domain authenticated (SPF/DKIM) | ☐ |

### G. Scheduled jobs

| Check | Pass? |
|-------|-------|
| Retention purge RPC not callable by non-admin effectively | ✅ body gated `is_admin()` |
| Cron / scheduled purge (if any) | ☐ none on main app — document intentional absence |

---

## Production probes (pre-#100) — must flip after merge

| Path | Pre-merge | Expected post-#100 |
|------|-----------|--------------------|
| `/api/health` | 307 | 200 JSON |
| `/robots.txt` | 307 | 200 |
| `/sitemap.xml` | 307 | 200 |
| `/privacy`, `/terms` | 307 | 200 |
| `/api/sessions` (anon) | 307 | 401 JSON |

---

## RC2 exit criteria

1. #100 merged + production deploy SHA matches `main`.  
2. Post-merge probe table all green.  
3. Migration parity plan executed **or** documented waiver with signed owner risk acceptance (prefer execute).  
4. Env checklist complete.  
5. Monitoring + backup verification complete.  
6. Auth email proof for signup + reset.  

Then proceed to **RC3 — Production Validation** (no feature work).
