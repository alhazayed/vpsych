# VPsych — Phase 3B Lifecycle Reconciliation

**Date:** 2026-08-11  
**Branch:** `cursor/phase3b-lifecycle-reconciliation-b432`  
**Base:** `origin/main` @ `fa9a658`  
**Decision:** **OPTION B** — `lifecycle_status` canonical; `is_active` therapist-visibility projection  

**Scope:** Documentation, contract amendment, and contract-level tests only.  
**Non-scope:** No production writes, no migration apply, no Phase 3B API/RPC implementation, no PR merges, no Phase 3C.

---

## 1. Authoritative decision

| Layer | Role |
|---|---|
| `avatars.lifecycle_status` | **Canonical** admin Virtual Patient lifecycle |
| `avatars.is_active` | **Projection** for therapist RLS / session start |

Production already contains `lifecycle_status` with CHECK:

`draft | testing | published | archived`

Production sync (already applied):

| `lifecycle_status` | `is_active` |
|---|---|
| `draft` | `false` |
| `testing` | `false` |
| `published` | `true` |
| `archived` | `false` |

Therapist RLS remains: `is_active = true OR is_admin()`.  
**Only `published` Virtual Patients are therapist-visible.**

---

## 2. Product semantics

### DRAFT
- Incomplete or being authored  
- Editable by admin  
- Not therapist-visible (`is_active=false`)  
- Create always starts here  

### TESTING
- Ready for administrator verification  
- Not therapist-visible (`is_active=false`)  
- Eligible for admin test / preview workflows  
- Learner-invisible  

### PUBLISHED
- Therapist catalog (`is_active=true`)  
- **Immutable** through normal PATCH authoring  
- Edit path: Duplicate → new Draft → edit → validate → testing → publish  

### ARCHIVED
- Withdrawn from therapist catalog (`is_active=false`)  
- Retained historically; admin-visible  
- Does **not** mutate historical sessions or clinical snapshots  
- May restore → `draft` via explicit admin workflow  

### Deactivate
**Not a fifth state.** For a published patient:

**DEACTIVATE = ARCHIVE** (`published → archived`)

Temporary non-public work belongs in **draft** or **testing**.

UI label: **Archive** (not “Deactivate”).

---

## 3. Allowed state machine

Preserved from PR #188 (`canTransitionLifecycle`) with product safety:

```text
draft     → testing | published | archived
testing   → draft | published | archived
published → archived
archived  → draft
```

Notes:
- `draft → published` and `testing → published` require the publish validation gate.  
- `published → draft|testing` is **forbidden** (no silent demotion); use Duplicate.  
- `draft → archived` is allowed (withdraw unused draft) per PR #188.  
- Self-transitions (`from === to`) are no-ops / allowed.

Canonical operations:

| Operation | Transition |
|---|---|
| CREATE | → `draft` (`is_active=false`) |
| MOVE TO TESTING | `draft|testing → testing` |
| PUBLISH | `draft|testing → published` (gated) |
| ARCHIVE | `published|draft|testing → archived` |
| RESTORE | `archived → draft` |
| DUPLICATE | always creates **new** row at `draft` |

---

## 4. Corrected Phase 3B API contract (design — not implemented here)

Retain `/api/admin/avatars` surface (Phase 2 IA). Intended semantics:

| Method | Path | Behavior |
|---|---|---|
| `POST` | `/api/admin/avatars` | Create `lifecycle_status='draft'` |
| `GET` | `/api/admin/avatars/[id]` | Admin load + validation summary |
| `PATCH` | `/api/admin/avatars/[id]` | Edit **only** when `draft` or `testing` (never published) |
| `POST` | `/api/admin/avatars/validate` | Validate without persist |
| `POST` | `/api/admin/avatars/[id]/publish` | Gate → `published` |
| `POST` | `/api/admin/avatars/[id]/archive` | Canonical withdrawal → `archived` |
| `POST` | `/api/admin/avatars/[id]/duplicate` | New id/slug, `draft` |
| `POST` | `/api/admin/avatars/[id]/preview` | `resolveAvatar` preview (no sandbox chat) |
| Optional | `/api/admin/avatars/[id]/lifecycle` | Explicit status transitions (testing/restore) |

**`/deactivate`:** If retained temporarily for compatibility, it is an **alias for `/archive`** only. Prefer removing it from new UI.

Admin test-session (PR #188) is the **next integration point** for TESTING state. **Phase 3C** covers persistent Test Conversation UX. Not implemented in this reconciliation branch.

---

## 5. Database RPC contract (design — do not apply yet)

Intended eventual RPCs (names may match prior Phase 3B work):

| Function | Required behavior |
|---|---|
| `admin_create_virtual_patient` | Always `lifecycle_status='draft'`; never publish |
| `admin_update_virtual_patient` | Refuse when `published`; never set `published` via update |
| `admin_duplicate_virtual_patient` | New row `lifecycle_status='draft'`; no session/report/learner copy |

Publish / archive / restore should either:
- use dedicated routes that UPDATE `lifecycle_status` (triggers project `is_active`), or  
- use a transition helper that enforces the state machine  

**SECURITY INVOKER** + `is_admin()` defense in depth. No RLS weakening. No service-role bypass for authoring.

### Migration strategy

| Artifact | Action |
|---|---|
| Existing prod column `lifecycle_status` | **Do not recreate** |
| Git file `20260808171439_avatar_lifecycle_status.sql` vs prod `20260808172816` | Documented drift — reconcile carefully later; **do not auto-rename prod** |
| Prior Phase 3B file `20260809155313_admin_virtual_patient_atomic.sql` (on PR #190 only) | **Do not apply as-is** to production; it is `is_active`-only and unaware of lifecycle |
| Eventual corrected migration | **New** migration that introduces/updates lifecycle-aware RPCs only — Option **B** relative to that file (replace before merge into main, or follow with a superseding migration). Must **not** `ADD COLUMN lifecycle_status` |

**This branch creates no migration files and applies none.**

---

## 6. Safety invariants

1. `lifecycle_status` is canonical.  
2. `is_active` is a projection.  
3. `is_active=true` **MUST** correspond to `lifecycle_status='published'`.  
4. `draft` / `testing` / `archived` MUST NOT be therapist-visible.  
5. Published records are immutable through normal authoring.  
6. Duplicate creates a new draft.  
7. Archive is non-destructive.  
8. Historical sessions are never modified by lifecycle changes.  
9. Clinical snapshots are never rewritten by lifecycle changes.  
10. No Clinical Core / ACE / CGE / scoring changes.  
11. No RLS weakening.  
12. SECURITY INVOKER RPCs remain protected by `is_admin()`.  
13. No real-user patient data may enter Virtual Patient authoring.  
14. Virtual Patient training content remains separate from real patient data.

---

## 7. Production version drift note

| Location | Version / name |
|---|---|
| PR #188 git migration | `20260808171439_avatar_lifecycle_status.sql` |
| Production `schema_migrations` | `20260808172816` / `avatar_lifecycle_status` |

- **Production schema is authoritative for live state.**  
- Repository migration history must be reconciled carefully (no duplicate apply).  
- Do not rename production migration rows.  
- Do not re-apply the lifecycle column migration.

Live seed rows (do not modify):

| Slug | `lifecycle_status` | `is_active` |
|---|---|---|
| `maya-chen` | `published` | `true` |
| `jordan-hale` | `published` | `true` |

---

## 8. PR strategy (advisory — no PR mutations in this task)

| PR | Status |
|---|---|
| **#188** | Reference architecture for lifecycle; **superseded as merge target** |
| **#190** | **Keep DRAFT**; do not merge until lifecycle reconciliation is adopted in implementation |
| **#192** | **Superseded** (content folded into #190 historically) |
| **#194** | Documentation lineage; **requires this lifecycle amendment** to be authoritative |

---

## 9. What this branch changes

| Kind | Changed? |
|---|---|
| Contract docs | **Yes** |
| Reconciliation planning doc | **Yes** (this file) |
| Contract-level lifecycle pure module + tests | **Yes** |
| Application authoring APIs / wizard | **No** |
| Database migrations | **No** |
| Production | **No** |

---

## 10. Next authorized steps (out of scope here)

1. Review & approve this reconciliation.  
2. Implement corrected Phase 3B on a **new** implementation branch based on this contract (or amend #190 carefully after approval).  
3. Author lifecycle-aware RPC migration (**without** recreating `lifecycle_status`).  
4. Explicit authorization required before any production migration apply.  
5. Live verification only after apply authorization.  
6. Phase 3C Test Conversation remains separate.

---

*End of Phase 3B lifecycle reconciliation preparation.*
