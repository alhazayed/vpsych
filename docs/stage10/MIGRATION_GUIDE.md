# Stage 10 — Migration Guide

## Additive migration

File: `supabase/migrations/20260807180000_enterprise_platform_stage10.sql`

### Adds

- Enum values: supervisor, observer, research_coordinator, guest, support, therapist  
- `enterprise_tenant_type` + `institutions.tenant_type`  
- Campuses, courses/modules/lessons, rotations, learning paths, graduation requirements  
- Case libraries + entries  
- Certificates  
- Research studies  
- Webhooks  
- Enterprise audit events  
- RLS + grants  

### Does not

- Alter patient message RPCs  
- Rewrite `clinical_snapshot`  
- Drop Mission 18 tables  
- Change `profiles.role` enum  

### Rollback posture

Forward-only (repo convention). Disable product routes if needed; leave tables in place.
