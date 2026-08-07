# GA Deployment Guide — Controlled Institutional Deployment

**Program:** `VPSYCH-1.0-CIDP-GA`  
**Package:** `1.0.0-rc.1` (tag `v1.0.0-rc.1`)  
**Audience:** University / residency / hospital / research IT + program leads  
**Base:** Stage 12 RC1 on `main` (PR #176 merged)

> Do not redesign engines. Deploy the certified RC1 binary with institutional configuration only.

## Packages by institution type

| Institution | Package emphasis |
|-------------|------------------|
| University / medical school | Faculty + Resident manuals, education dashboards |
| Psychiatry residency | Supervisor + Resident manuals, competency tracking |
| Teaching hospital | Security + RBAC, multi-department tenancy |
| Mental health center | Clinician quick start, privacy |
| Research institution | Research protocol, observational export |

## Deploy steps (Vercel + Supabase)

1. Confirm production SHA includes PR #176 merge (`e201e2c` or later).  
2. Apply migration `20260807184117_institutional_feedback_ga.sql` if not applied (already on prod for CIDP).  
3. Set env from `.env.example` (see `DEPLOYMENT_GUIDE.md`).  
4. Prefer `UPSTASH_REDIS_*` for multi-instance rate limits.  
5. Keep `NEXT_PUBLIC_THERAPY_ROOM_MODE` and realtime flags **off** unless pilot-approved.  
6. Smoke: `/api/health`, login, one text session, admin ops dashboards.  
7. Onboard users via `INSTITUTIONAL_ONBOARDING.md`.

## Deployment package contents

- This guide · Administrator (`INSTITUTIONAL_ONBOARDING`) · Faculty · Resident · Supervisor · Research · Security (`SECURITY_AUDIT` / `SECURITY_MODEL`) · Quick Start (below) · Rollback (`ROLLBACK_PROCEDURES`)

## Quick Start (15 minutes)

1. Admin creates institution membership rows.  
2. Grant `admin` only to program IT leads (`profiles.role`).  
3. Faculty invite residents; share `RESIDENT_MANUAL.md`.  
4. Run one supervised session; submit feedback via `POST /api/feedback`.  
5. Review `GET /api/admin/ops/dashboards`.

## Related

`DEPLOYMENT_GUIDE.md` · `OPERATIONS_RUNBOOK.md` · `DISASTER_RECOVERY.md`
