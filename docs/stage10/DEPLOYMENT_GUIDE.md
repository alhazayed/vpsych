# Stage 10 — Deployment Guide

1. Merge PR after CI green (lint · typecheck · test · migrations · build).  
2. Apply migration `20260807180000_enterprise_platform_stage10.sql` to Supabase (or rely on linked migrate pipeline).  
3. Confirm `institutions.tenant_type` backfilled.  
4. Grant org admins via `institution_memberships` (`institution_admin`).  
5. Optional: set `institutions.sso_enabled` + `sso_metadata` for IdP.  
6. Smoke:  
   - `GET /api/admin/enterprise` as platform admin  
   - `GET /api/enterprise/summary` as member with `primary_institution_id`  
   - `GET /api/enterprise/certificates/verify?code=…`  
7. UI: `/admin/enterprise`

No patient-engine feature flags required. Stage 10 is always-on soft-fail.
