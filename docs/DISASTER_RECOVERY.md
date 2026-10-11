# Disaster Recovery — VPsych Version 1.0

**Cert:** Stage 12 · `VPSYCH-1.0-RC1-STAGE12`  
**RTO target (preview/RC):** ≤ 4 hours for application rollback  
**RPO target:** ≤ 24 hours (Supabase plan backup window — confirm on Pro/Team plan)

## 1. Backup strategy

| Asset | Mechanism | Owner |
|-------|-----------|-------|
| Postgres | Supabase automatic backups / PITR (plan-dependent) | Ops |
| Auth users | Supabase Auth (included in project backup) | Ops |
| Git / migrations | GitHub `main` + `supabase/migrations/` | Engineering |
| Vercel env | Vercel project env UI (not git) | Ops |
| Secrets | Vault / password manager | Release Manager |
| Personas / schemas | Git (`personas/`, `schemas/`) | Engineering |

**Daily:** Confirm Supabase project health.  
**Weekly:** Export critical env key names checklist (not values) against `.env.example`.  
**Per release:** Tag SHA; record deploy id in RDL.

## 2. Restore procedures

### Application (Vercel)

1. Identify last known-good READY deploy (SHA + deploy id).  
2. Vercel → Promote that deploy to Production.  
3. Verify `GET /api/health` → `ok: true` and `version` expected.  
4. Verify public `/login` 200 and unauthenticated `POST /api/sessions` → 401 JSON.

### Database

1. Prefer **forward fix** migrations over restore when data loss risk is high.  
2. If restore required: Supabase Dashboard → Database → Backups. Prefer **Restore to new project** (proven 2026-10-11, §6.1) and repoint the app only after verifying the copy. The **Restore** buttons on *Scheduled backups* overwrite production in place.  
3. After restore: run `npm run test:migrations` with `SUPABASE_DB_URL` against restored project.  
4. Re-apply any git migrations newer than restored `schema_migrations`.  
5. Validate RPC grants on `insert_assistant_message` / `insert_system_message` / `create_session_report`.

### Auth

1. If JWT keys rotated incorrectly, users re-login.  
2. Restore Auth settings from runbook notes; re-enable leaked-password protection.

## 3. Migration rollback

- **Do not** delete applied migration rows casually.  
- Ship compensating forward migrations.  
- If a bad migration is applied: restore DB to pre-migration backup **only** with Board approval and matching git revert of the app SHA that required it.

## 4. Deployment rollback

See `DEPLOYMENT_GUIDE.md` §2 and `OPERATIONS_RUNBOOK.md` §8.

Tag reference: `rc1-pp-1.0-baseline` is historical preview baseline — use only with Board approval (schema may have advanced through Stages 7–11).

## 5. Business continuity

| Capability | Continuity mode |
|------------|-----------------|
| Text training (no AI key) | Persona fallback replies (`aiSource` must surface) |
| Voice down | Text-only sessions |
| Assessment provider down | Session end may fail report — page on-call; do not expose raw errors |
| Upstash down | In-memory RL fallback (single-instance safe only) |
| Realtime / TRM flags | Keep **off**; classic VoiceSession |

## 6. Recovery testing

| Drill | Cadence | Evidence |
|-------|---------|----------|
| Vercel instant rollback | Per major release | Screenshot + health curl |
| Migration parity check | Every deploy | CI + optional remote |
| Backup restore (staging project) | Quarterly | Signed note in RDL |
| Credential Verification Gate | Every cert wave | RDL |

**Status at Stage 12:** Procedures **documented**; quarterly restore drill remains an ops residual (does not block RC; blocks “DR certified” marketing claims).

**Status 2026-10-11:** first database restore drill passed (§6.1). Next drill due by 2027-01-11, and after any large migration.

### 6.1 Restore drill log

#### 2026-10-11 — daily backup → new project (first proven restore)

- **Backups available:** 7 daily physical backups, 2026-10-04 to 2026-10-10 (Pro retention). Newest: 2026-10-10 10:44:29 UTC.
- **Method:** Database → Backups → *Restore to new project* (beta) on the 2026-10-10 backup, into a new project `vpsych-restore-drill` (us-east-1, nano compute). Production was not touched.
- **Duration:** restore started 09:00:30 UTC; the project was reported healthy by 09:26 UTC. That gives an upper bound of about 26 minutes; the exact healthy time was not captured.
- **Verification:** the same read-only query was run on both projects. For production, the counts were also taken as of the backup time.

| Check | Restored copy | Production at backup time |
|---|---|---|
| profiles / auth users | 17 / 17 | 17 / 17 |
| sessions | 714 | 714 |
| session_messages | 4791 | 4791 |
| session_reports | 565 | 565 |
| avatars (patients) | 56 | 56 |
| schema_migrations rows / latest | 88 / `20261009185408` | 88 / `20261009185408` |
| newest session | 2026-10-09 11:21:35 UTC | 2026-10-09 11:21:35 UTC |
| Vault `report_write_key` present | yes | yes |

Every value matched. There had been no new activity since the backup, so production's current counts were identical as well.

- **PITR:** not yet confirmed (Point in time tab not checked). Without it, the worst-case data loss is everything written since the last nightly backup (RPO ≤ 24 h).
- **Not covered:** Storage objects (Supabase does not include them in database backups), Vercel env, and repointing the app at a restored project.
- **Clean-up:** pause or delete `vpsych-restore-drill` after the drill. Never point Vercel env at it.

## 7. Contacts / escalation

Follow `INCIDENT_RESPONSE.md` severity matrix. Append outcomes to `RELEASE_DECISION_LOG.md`.
