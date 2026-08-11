# VPsych — Phase 3A Contract Amendment

**Date:** 2026-08-10 (Amendment 1) · 2026-08-11 (Amendment 2 — lifecycle)  
**Branch (Amendment 2):** `cursor/phase3b-lifecycle-reconciliation-b432`  
**Amended document:** `docs/VPsych_VIRTUAL_PATIENT_CREATION_CONTRACT.md`  
**Companion:** `docs/VPsych_PHASE3B_LIFECYCLE_RECONCILIATION.md`

---

## Amendment 2 — Lifecycle Option B (2026-08-11)

### Finding

Production Supabase (`rrzudbkxigeavfdnidnm`) already contains `avatars.lifecycle_status` with CHECK (`draft|testing|published|archived`) and bidirectional sync triggers with `is_active`, introduced by PR #188’s migration (git `20260808171439`; production row `20260808172816`).

Phase 3A / early Phase 3B contracts incorrectly claimed:

- `is_active` is the lifecycle authority  
- inactive ≡ draft  
- archive does not exist on avatars  
- no lifecycle enum column  

Those assumptions are **false against production**.

### Decision

**OPTION B:** `lifecycle_status` is canonical; `is_active` is the therapist-visibility projection.

### Corrected contract areas

| Section | Correction |
|---|---|
| Header / §1 | Option B table; lifecycle column mandatory on create |
| §2.1 / §2.4 | `lifecycle_status` inventory + sync triggers |
| §12 publication | Published immutable; duplicate-to-edit |
| §13 duplicate | Reset to `draft` |
| §14 | Full four-state lifecycle + state machine |
| §15 | Archive implemented via `lifecycle_status` |
| §17–§21 | Create/publish/archive API & atomicity wording |
| §22–§23 | Risks / approvals updated |

### Explicit non-change attestation (Amendment 2)

| Artifact | Changed? |
|---|---|
| Production database | **No** |
| Migrations applied | **No** |
| New `.sql` migration files | **No** |
| Authoring APIs / wizard implementation | **No** |
| Clinical Core / ACE / CGE / scoring / RLS / auth | **No** |
| Contract + reconciliation docs | **Yes** |
| Contract-level lifecycle pure module + tests | **Yes** |

### PR posture (advisory)

| PR | Posture |
|---|---|
| #188 | Reference; superseded as merge target |
| #190 | Keep DRAFT until implementation adopts Option B |
| #192 | Superseded |
| #194 | Lineage; insufficient alone after lifecycle amendment |

---

## Amendment 1 — Human personality / inventory (2026-08-10)

**Original branch:** `cursor/phase3a-contract-amendment-5e36`  
**Trigger:** Phase 3B pre-flight **CONTRACT MATCH: FAIL** (human-personality runtime discrepancy)  
**Scope:** Documentation correction only.

### 1. Finding

Phase 3B pre-flight correctly stopped. The Phase 3A contract incorrectly assumed that unknown/new avatar slugs without persisted `human_personality` produce soft-absent / weak Module 2b traits (“empty soul” patients).

Actual runtime in `src/lib/personality-engine/resolve.ts`:

1. Frozen session snapshot  
2. DB `avatars.human_personality` map  
3. Builtin catalog by slug (`maya-chen`, `jordan-hale` only)  
4. **`synthesizeHumanPersonalityFromAvatar()`** — always returns a valid `HumanPersonalityProfile`

`resolveAvatar()` therefore always attaches Module 2b. Missing authored HP is an **authored-quality** gap, not Module 2b runtime absence.

Secondary pre-flight gaps (documentation inventory only):

- `voice_profiles` clinical delivery columns (`20260807120000_clinical_voice_profiles.sql`) omitted from §7  
- `disorders_require_clinical_code` (DSM-5 **or** ICD-11) omitted from clinical/validation contract  
- `avatars.updated_at` overstated as always sync-trigger maintained  
- Wizard described in ways that implied a `VirtualPatientWizard` component; Phase 2 uses an inline `/admin/avatars/new` shell

### 2. Quality-gate interpretation

| Layer | Meaning |
|---|---|
| **RUNTIME SAFETY** | Missing authored `human_personality` does **not** break Module 2b. Synthesis keeps a valid profile available. |
| **AUTHORED TRAINING QUALITY** | PUBLISHED Virtual Patients should have deliberately authored, clinically coherent human personality when the publish contract requires it. Prefer authored over synthesis. |

### 3. Explicit non-change attestation (Amendment 1)

| Artifact | Changed? |
|---|---|
| Application `.ts` / `.tsx` (at amendment time) | **No** |
| Database schema | **No** |
| Migrations | **No** |
| APIs | **No** |
| Documentation | **Yes** |

---

## Sequence (authoritative)

```text
CONTRACT AMENDMENT 1 (HP runtime)     — historical
CONTRACT AMENDMENT 2 (lifecycle B)    — this branch
  → review / approve reconciliation
  → Phase 3B implementation authorization (separate)
  → lifecycle-aware RPC migration authored (separate; not applied here)
  → explicit production apply authorization (separate)
  → live verification (separate)
```

This reconciliation branch **stops** after docs + contract-level tests. It does **not** implement Phase 3B APIs, apply migrations, or merge PRs.

---

*End of Phase 3A contract amendment ledger.*
