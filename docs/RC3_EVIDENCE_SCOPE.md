# RC3 Evidence Scope

**Purpose:** Prevent certification confusion across feature branches, open PRs, and the release candidate on `main`.

**Rule:** A result is valid for RC3 decision-making **only** when its SHA/branch matches the row’s “Valid For” column. Never import a feature-branch score onto `main` without an explicit re-bind after merge.

| Evidence | SHA | Branch / PR | Valid For | Status |
|---|---|---|---|---|
| Migration Integrity 100/100 (greenfield ≡ prod schema; schema diff 0) | `5c879f4` (work) → **bound to** `5bf66c0` after merge | PR #103 → **`main`** | Post-merge release candidate on `main` @ `5bf66c0` + prod deploy `dpl_5F6pBTi…` | **BOUND** 2026-08-04 (see below) |
| Version parity 54 ≡ 54 | `5bf66c0` | `main` | Current release candidate | **PASS** |
| RC3 Production Validation (initial) | `52a7610` | `main` (pre-#103) | Historical — Wave 1 FAIL snapshot | Archived |
| RC3 Production Validation (current) | `5bf66c0` | `main` | Current release candidate | In progress — Wave 1 **waiting** on RC3-C2 ops prerequisite (secrets), not an app defect |
| Infrastructure Freeze (RC2) | `52a7610` → superseded by `5bf66c0` for migration item | `main` | RC2 migration gate closed by #103 | Partial → migration item closed |
| Production app deploy | `5bf66c0` | `main` → `dpl_5F6pBTi21VrYWaxmWSRcNnCcxTA4` | Current production | **READY** on `vpsych.vercel.app` |
| Executive Decision | Current `main` SHA | `main` | Current release candidate only | NOT APPROVED until Wave 1 PASS + later waves |

## Binding note — Migration Integrity 100/100

The greenfield structural proof (tables/views/functions/triggers/policies/indexes/columns/enums/EXECUTE grants; function-def and policy MD5 equality) was executed against the migration tree that became PR #103.

**Re-bind conditions (all met 2026-08-04):**

1. PR #103 merged to `main` → SHA `5bf66c0`
2. Repository migrations = **54**
3. Production `schema_migrations` = **54**
4. Version sets identical (0 missing / 0 extra)
5. Production deploy SHA = `5bf66c0` (`dpl_5F6pBTi…`)
6. Production public schema spot counts match the certified inventory (56/9/22/7/123/182/27/666; `rls_off=0`) → **schema diff = 0** for release-critical object classes

Therefore RC3 **may reuse** the 100/100 integrity evidence for `main` @ `5bf66c0`. Do **not** cite `5c879f4` alone as the release-candidate SHA; cite **`5bf66c0`**.

## Invalid citations (do not use)

| Invalid claim | Why |
|---|---|
| “Integrity 100/100 on `main` @ `52a7610`” | That SHA had 28 migrations |
| “RC3 PASS because PR #103 CI was green” | CI ≠ production Wave 1 |
| Any Wave 2–7 PASS before `wave_1.state == passed` | Waves locked |

## Related files

- `docs/RC3_PRODUCTION_VALIDATION.md` — master verdict + `wave_status`
- `docs/rc3/WAVE1_UNLOCK_CHECKLIST.md` — unlock steps
- `docs/AUDIT_ACCOUNTS.md` — permanent certification identities (no secrets)
- `RELEASE_MANIFEST.md` — machine-readable inventory
