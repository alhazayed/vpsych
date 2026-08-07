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
2. If restore required: Supabase Dashboard → Database → Backups → restore to point-in-time (PITR) or daily backup.  
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

## 7. Contacts / escalation

Follow `INCIDENT_RESPONSE.md` severity matrix. Append outcomes to `RELEASE_DECISION_LOG.md`.
