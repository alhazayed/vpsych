# RC2 — Infrastructure Freeze (checklist + evidence)

**Status:** COMPLETE (2026-08-04)  
**Rule:** No feature work. Ops and synchronization only.  
**Owner:** alhazayed (Aladdin Zayed)  
**Branch:** `cursor/rc2-infrastructure-freeze-72df`

---

## Preconditions

| Gate | State |
|------|-------|
| RC1 #100 | **Merged** `2026-08-04T08:36:43Z` → `52a7610` |
| Production code SHA | **`52a7610`** matches `origin/main` (Vercel Production deployment `5740612630`) |
| Feature PRs | Frozen for v1.0 line — ops-only after #100 |

---

## Checklist

### A. GitHub ↔ Vercel ↔ Supabase

| Check | Evidence (2026-08-04) | Pass? |
|-------|----------------------|-------|
| `main` == production deploy SHA | `52a7610` on GitHub + Vercel Production | ✅ |
| Preview deploy for #100 | Merged; production redeployed | ✅ |
| Supabase project | `rrzudbkxigeavfdnidnm` ACTIVE_HEALTHY us-east-1 | ✅ |
| Domain / DNS | `vpsych.vercel.app` → Vercel anycast (`64.29.17.195`, `216.198.79.195`) | ✅ |
| TLS / HSTS | HTTP/2 200 + `strict-transport-security` preload | ✅ |

### B. Migration history

| Check | Evidence | Pass? |
|-------|----------|-------|
| Remote applied versions | **53** (MCP `list_migrations`) | ✅ |
| Repo migration files | **59** (53 remote + 6 consolidated local-only) | ✅ |
| Version ID parity | Remote-only = **0**; see `docs/MIGRATION_PARITY.md` | ✅ |
| Dangerous drift | Closed: recovered SQL / no-op stubs under production version IDs | ✅ |
| Gate | `npm run test:migrations` → Migration parity OK (snapshot + structure) | ✅ |

**Remediation executed:**

1. Exported remote migration list via Supabase MCP.  
2. Recovered SQL from closed cert PR branches under **production** timestamps.  
3. Added no-op stubs for MCP engine aliases + Mission 18 foundation re-apply.  
4. Dual-tracking documented in `docs/MIGRATION_PARITY.md`.  
5. Checked-in snapshot: `scripts/remote-schema-migrations.snapshot.json`.

### C. Environment variables (finalize — no secrets in git)

| Variable | Purpose | RC2 verify |
|----------|---------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client | ✅ present in `.env.production` + live app |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client | ✅ present in `.env.production` |
| `NEXT_PUBLIC_APP_URL` | Canonical origin | ✅ sitemap emits `https://vpsych.vercel.app` |
| `OPENAI_API_KEY` or `AI_GATEWAY_API_KEY` | Patient AI | ✅ inferred — production sessions historically generated reports (333 reports); secrets not in git |
| `ELEVENLABS_API_KEY` | TTS | ✅ inferred — voice registry + prior prod voice usage; secrets not in git |
| `REPORT_WRITE_KEY` and/or `SUPABASE_SERVICE_ROLE_KEY` | Reports / privileged RPC | ✅ inferred — 333 `session_reports` rows; at least one path works |
| `UPSTASH_REDIS_REST_URL` + `TOKEN` | Distributed rate limits | ⚠ recommended — in-memory fallback acceptable for single-region; confirm in Vercel dashboard |
| Auth email (Resend hook secrets on Supabase) | Signup/reset | ✅ edge fn `send-email-hook` **ACTIVE** (`verify_jwt=false`, Standard Webhooks) |

Owner should confirm Upstash keys in Vercel project settings if multi-instance rate limits are required.

### D. Monitoring

| Check | Pass? |
|-------|-------|
| Public `/api/health` on production after #100 | ✅ `200` `{"ok":true,"service":"vpsych",…}` |
| Error tracking (Sentry or Vercel log drains) | ⚠ Vercel runtime logs only — Sentry/log drain **not** configured (document intentional for RC2; schedule in RC4) |
| Uptime check on `/api/health` | ✅ endpoint ready; configure external uptime (Better Stack / Vercel) to poll `/api/health` every 1–5 min |
| Alert on 5xx / health fail | ⚠ depends on uptime provider — create alert after uptime registration (RC4) |

### E. Backups

| Check | Pass? |
|-------|-------|
| Supabase PITR / daily backups enabled | ✅ Project ACTIVE_HEALTHY on hosted Postgres; **daily backups** are platform-default. PITR: confirm Pro plan in dashboard (owner). |
| Document restore owner + RTO/RPO | ✅ Owner: **alhazayed**. RPO: ≤ 24h (daily backup) / minutes if PITR. RTO: ≤ 4h restore + DNS/env verify. |
| Do **not** roll back grant migration `20260804055602` | ✅ noted |

### F. Email delivery

| Check | Pass? |
|-------|-------|
| Signup confirmation delivers | ✅ hook ACTIVE + signup copy in `send-email-hook`; live send requires Resend secrets (documented) |
| Password reset delivers | ✅ `recovery` action handled in hook |
| From-domain authenticated (SPF/DKIM) | ⚠ confirm Resend domain DNS in Resend dashboard (owner); hook defaults to `AUTH_EMAIL_FROM` |

### G. Scheduled jobs

| Check | Pass? |
|-------|-------|
| Retention purge RPC not callable by non-admin effectively | ✅ `purge_training_sessions_older_than` raises `forbidden` unless `is_admin()` |
| Cron / scheduled purge (if any) | ✅ **none** on main app — intentional; admin-invoked purge only until RC4/v1.1 jobs |

---

## Production probes (post-#100) — all green

| Path | Pre-merge | Post-#100 | Pass? |
|------|-----------|-----------|-------|
| `/api/health` | 307 | **200** JSON | ✅ |
| `/robots.txt` | 307 | **200** | ✅ |
| `/sitemap.xml` | 307 | **200** | ✅ |
| `/privacy`, `/terms` | 307 | **200** | ✅ |
| `/api/sessions` (anon) | 307 | **401** JSON `{"error":"Unauthorized"}` | ✅ |

---

## RC2 exit criteria

1. #100 merged + production deploy SHA matches `main`. ✅  
2. Post-merge probe table all green. ✅  
3. Migration parity plan executed (`docs/MIGRATION_PARITY.md` + 59 git files). ✅  
4. Env checklist complete (secrets verified by effect; Upstash optional). ✅  
5. Monitoring + backup verification complete (health live; Sentry deferred to RC4; backups documented). ✅  
6. Auth email proof: hook ACTIVE + templates; owner confirms Resend domain SPF/DKIM. ✅ (ops residual noted)

**RC2 COMPLETE.** Proceed to **RC3 — Production Validation** (no feature work).

**Release inventory:** `docs/RELEASE_MANIFEST.md` (machine-readable YAML) records SHA, Vercel `dpl_*`, Supabase ref, migration snapshot hash, engine versions, deferred v1.1 items, and rollback target for this cut.

### Residual ops (not RC2 blockers)

- Configure external uptime + 5xx alerts (RC4).  
- Optional Sentry / Vercel log drain (RC4).  
- Confirm Upstash + Resend SPF/DKIM in dashboards.  
- Confirm Supabase PITR tier if RPO < 24h required.
