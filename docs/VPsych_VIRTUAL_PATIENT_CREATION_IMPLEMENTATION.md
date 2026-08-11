# VPsych — Virtual Patient Creation Implementation (Phase 3B, Option B)

**Date:** 2026-08-11  
**Branch:** `cursor/phase3b-lifecycle-reconciliation-b432`  
**Authoritative contract:** `docs/VPsych_VIRTUAL_PATIENT_CREATION_CONTRACT.md`  
**Reconciliation:** `docs/VPsych_PHASE3B_LIFECYCLE_RECONCILIATION.md`

---

## Architecture

```text
Admin Wizard (/admin/avatars)
   ↓
Route Handlers (requireApiAdmin + rateLimit + audit)
   ↓
lib/admin/virtual-patient (validate → persist / lifecycle transitions)
   ↓
SECURITY INVOKER RPCs (atomic avatars + optional personas)
   ↓
lifecycle_status write → production sync triggers → is_active projection
   ↓
Runtime: resolveAvatar / createCaseForSession (unchanged)
```

| State | `lifecycle_status` | `is_active` |
|---|---|---|
| DRAFT | `draft` | `false` |
| TESTING | `testing` | `false` |
| PUBLISHED | `published` | `true` |
| ARCHIVED | `archived` | `false` |

**DEACTIVATE ≡ ARCHIVE.** `/deactivate` is a compatibility alias for `/archive`.

---

## APIs

| Method | Path | Behavior |
|---|---|---|
| `POST` | `/api/admin/avatars` | Create `draft` |
| `GET`/`PATCH` | `/api/admin/avatars/[id]` | Load / edit draft\|testing |
| `POST` | `/api/admin/avatars/validate` | Validate without persist |
| `POST` | `/api/admin/avatars/[id]/publish` | Gate → `published` |
| `POST` | `/api/admin/avatars/[id]/archive` | → `archived` |
| `POST` | `/api/admin/avatars/[id]/restore` | `archived` → `draft` |
| `POST` | `/api/admin/avatars/[id]/lifecycle` | `testing` ↔ `draft` |
| `POST` | `/api/admin/avatars/[id]/deactivate` | **Alias** of archive |
| `POST` | `/api/admin/avatars/[id]/duplicate` | New `draft` |
| `POST` | `/api/admin/avatars/[id]/preview` | `resolveAvatar` |

---

## Migration (git only — NOT applied to production)

**File:** `supabase/migrations/20260811084442_admin_virtual_patient_lifecycle_rpcs.sql`

| Concern | Detail |
|---|---|
| Tables | `avatars`, `personas` (INSERT/UPDATE); reads `disorders` |
| Compatibility shim | `ADD COLUMN IF NOT EXISTS lifecycle_status` + sync triggers (no-op on production where already present) |
| Functions | `admin_create_virtual_patient`, `admin_update_virtual_patient`, `admin_duplicate_virtual_patient` |
| Security | **SECURITY INVOKER** + `is_admin()` |
| Grants | EXECUTE to `authenticated`, `service_role`; REVOKE PUBLIC/anon |
| Destructive ops | **None** |
| Rollback | `DROP FUNCTION` the three RPCs; leave production lifecycle column untouched |

**Do not apply to production without separate explicit authorization.**

Admin test-session (PR #188) remains the integration point for TESTING verification; Phase 3C covers persistent Test Conversation UX.

---

## Safety

- Published immutable via PATCH (duplicate to edit)  
- Archive non-destructive; sessions/snapshots/reports untouched  
- RLS unchanged (`is_active` projection)  
- No Clinical Core / ACE / CGE / scoring / auth changes  

---

*End of Phase 3B lifecycle-aware implementation notes.*
