# Tenant Model — Stage 10

## Tenant root

**Organization** ≡ `public.institutions` (Mission 18).  
Stage 10 adds `tenant_type` and extends child tables under the same `institution_id` foreign key.

## Tenant types

| Type | Typical use |
|------|-------------|
| `university` | Medical schools, international universities |
| `hospital` | Teaching hospitals, residency sponsors |
| `clinic` | Mental health centers |
| `corporate` | Private training corporations |
| `government` | MoH / licensing board programs |
| `private_organization` | Independent colleges / institutes |

## Isolation rule

Every enterprise row that carries learner or org data is stamped with `institution_id` (API layer: `organization_id`).

```
assertTenantAccess({
  actorRole, actorOrganizationId, resourceOrganizationId, permission
})
```

- Org-scoped roles: `actorOrganizationId === resourceOrganizationId` required.  
- Platform `global_admin` / `system_owner`: may cross tenants only with explicit permission.  
- Shared/platform libraries: readable when `approval_status = approved`.

## Session stamp

`sessions.institution_id` (Mission 23) is the runtime tenant scope. Stage 10 bridge reads it (or `profiles.primary_institution_id`) for analytics — never rewrites clinical_snapshot.

## RLS

Stage 10 migration enables RLS on all `enterprise_*` tables using existing helpers:

- `is_institution_member(institution_id)`
- `can_manage_institution(institution_id)`
- `is_platform_admin()`
- `user_institution_ids()`

Policies wrap `auth.uid()` in `(select …)` where new.

## Verification

`verifyMutualIsolation` + enterprise tests assert no row leakage between synthetic tenants A/B.
