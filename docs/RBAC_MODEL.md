# RBAC Model — Stage 10

Permissions are **centralized** in `src/lib/enterprise/rbac.ts`. Route Handlers must consult `hasPermission` / `authorizeTenantAction` rather than inventing ad-hoc role checks.

## Roles

| EnterpriseRole | Scope | Maps from |
|----------------|-------|-----------|
| system_owner | Platform | Operational elevation (profiles.admin + policy) |
| global_admin | Platform | `profiles.role = admin` |
| organization_admin | Tenant | `institution_admin` |
| program_director | Tenant | `program_director` |
| supervisor | Tenant | `supervisor` (Stage 10 enum) |
| faculty | Tenant | `faculty` / `instructor` |
| resident | Tenant | `resident` |
| student | Tenant | `student` |
| therapist | Tenant | `therapist` / `psychologist` / `gp` |
| observer | Tenant | `observer` |
| research_coordinator | Tenant | `research_coordinator` |
| guest | Tenant | `guest` |
| support | Platform/tenant | `support` |

Platform role (`profiles.role`) remains `therapist | admin` — enterprise membership is additive.

## Permission catalogue (selected)

- `tenant.*` · `users.*` · `programs.*` · `courses.*` · `assignments.*`
- `sessions.read_own` · `sessions.read_tenant` · `sessions.observe`
- `reports.read_own` · `reports.read_tenant` (admin product surface only)
- `libraries.*` · `analytics.*` · `certificates.*`
- `research.*` · `security.*` · `webhooks.manage` · `integrations.manage`
- `observability.read` · `support.impersonate_readonly`

## Invariants

1. Students cannot `courses.manage` or `reports.read_tenant`.  
2. Observers may `sessions.observe` but not grade.  
3. Cross-tenant only for `system_owner` / `global_admin`.  
4. Therapist-facing APIs never return `session_reports` bodies.
