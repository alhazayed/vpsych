# Rollback Procedures

Companion to `DISASTER_RECOVERY.md` and `OPERATIONS_RUNBOOK.md` §8.

## Application rollback (Vercel)

1. Identify last READY deploy SHA.  
2. Promote prior deploy to Production.  
3. Verify `GET /api/health` version/cert.  
4. Verify unauthenticated API → JSON 401.

## Git tag baseline

- `v1.0.0-rc.1` → Stage 12 RC1 certified tip (PR #176).  
- Prefer forward-fix when migrations already applied.

## Migration rollback

- Do not delete `schema_migrations` rows casually.  
- Ship compensating forward migrations.  
- PITR restore only with Board approval.

## Feedback / telemetry

- Feedback ledger is append-only; rollback of app does not erase durable feedback rows.  
- In-process telemetry resets on cold start — expected.
