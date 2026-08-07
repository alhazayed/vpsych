# Disaster Recovery Report — Controlled Institutional Deployment

**Report ID:** `VPSYCH-1.0-RC1-CIDP-DR`  
**Version:** `1.0.0-rc.1`  
**Date (UTC):** 2026-08-07  
**Related:** `../DISASTER_RECOVERY.md`, `../INCIDENT_RESPONSE.md`

## 1. Objectives

| Objective | Target (RC/CIDP) | GA requirement |
|-----------|------------------|----------------|
| RTO (app rollback) | ≤ 4 hours | Proven in drill |
| RPO | ≤ 24 hours (confirm plan) | PITR verified |
| Evidence | Templates below | Signed drill pack |

**Status at CIDP packaging:** Procedures and evidence templates **complete**. Live PITR drill remains an **ops residual** (does not block CIDP; blocks GA).

## 2. Backup verification procedure

1. Supabase Dashboard → Database → Backups: confirm latest automatic backup timestamp.  
2. Record project ref, plan tier, PITR enabled Y/N.  
3. Confirm git `supabase/migrations/` count matches remote `schema_migrations` when URL available.  
4. Confirm Vercel env key **names** match `.env.example` (no values in evidence).  

**Evidence fields:** date, operator, backup timestamp, PITR flag, migration count git/remote, sign-off.

## 3. Restore testing procedure (staging preferred)

1. Provision or select staging Supabase project.  
2. Restore from backup or PITR to chosen timestamp.  
3. Point staging app env at restored DB (never production secrets in logs).  
4. Run `npm run test:migrations` with staging `SUPABASE_DB_URL`.  
5. Smoke: health, login, session create/message/end (Credential Gate).  
6. Document data loss window observed (RPO actual).

## 4. PITR drill

1. Insert a benign marker row in staging (non-PHI).  
2. Note timestamp T0.  
3. Delete marker; restore to T0 via PITR.  
4. Confirm marker present; app smoke PASS.  
5. Attach screenshots + SQL proof to `evidence/`.

## 5. Database validation post-restore

- [ ] RLS enabled on public tables (sample)  
- [ ] `insert_assistant_message` / `insert_system_message` / `create_session_report` grants  
- [ ] `institutional_feedback` policies intact  
- [ ] No orphan sessions without ownership  

## 6. Secrets recovery

1. Identify missing secret from outage symptom (TTS 503 → ElevenLabs, report 500 → REPORT_WRITE_KEY).  
2. Retrieve from vault / Vercel encrypted env — **not** chat logs.  
3. Rotate if exposure suspected.  
4. Redeploy; smoke affected path.  
5. Record rotation in RDL (no secret values).

## 7. Infrastructure recovery

1. Vercel: promote last known-good READY deploy.  
2. DNS/CDN: verify SSL Full (strict) if Cloudflare.  
3. Upstash: verify REST URL/token; fallback is in-memory only.  
4. Supabase status page check.

## 8. Application recovery

1. Health ok + version match.  
2. Auth diagonal login (therapist/admin).  
3. Session pipeline STT→message→TTS (or text-only).  
4. Admin CIDP dashboard loads.  
5. Feedback submit works.

## 9. Drill evidence template

```
DRILL_ID:
DATE_UTC:
OPERATOR:
ENVIRONMENT: staging|production
STEPS_EXECUTED:
BACKUP_TIMESTAMP:
PITR_USED: yes|no
RTO_ACTUAL_MIN:
RPO_ACTUAL_MIN:
SMOKE_RESULTS:
ISSUES:
BOARD_SIGN_OFF:
```

Store completed forms under `docs/cidp/evidence/` or the institutional audit vault.
