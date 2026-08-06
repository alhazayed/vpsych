# Release Decision Log

**Immutable, append-only governance trail** for VPsych release candidates and public releases.

**Rules:**

1. **Append only.** Never edit or delete prior rows. Corrections are new rows that reference the prior decision ID.
2. Every major gate (RC approval, wave unlock/block, freeze, tag, public release, board waiver) gets a row.
3. Fill: who decided, why, what evidence, what outcome.
4. No secrets. Point at docs/PRs/SHAs/deploy IDs only.

**Purpose (months/years later):** Who made the decision? Why? What evidence supported it? What was the outcome?

---

## Roles (RC3 onward)

| Role | Responsibility | Does not |
|---|---|---|
| **Release Manager** | Retrieve `VPSYCH_AUDIT_*` from vault; inject into audit environment; verify therapist/admin login; trigger Wave 1 run | Software engineering / speculative fixes |
| **Cursor (certification agent)** | Run Missions 1–5; produce evidence; identify verified defects; re-test after fixes; issue PASS/FAIL | Speculative improvements during certification |
| **Executive Board** | Review wave results; unlock the next wave only if the gate passes; protect process integrity | Bypass operational prerequisites without recorded waiver |

---

## Decision log

| ID | Date (UTC) | Decision | Authority | Evidence | Outcome |
|---|---|---|---|---|---|
| RDL-001 | 2026-08-04 | RC1 Approved | Executive Board | PR [#100](https://github.com/alhazayed/vpsych/pull/100); production deploy of soft-launch remediations; `docs/RC1_CODE_FREEZE.md` | **Approved** — RC1 PASSED |
| RDL-002 | 2026-08-04 | RC2 Approved (infrastructure freeze path) | Executive Board | `#100` on `main` @ `52a7610` / prod `dpl_2mBqyfz…`; `docs/RC2_INFRASTRUCTURE_FREEZE.md`; migration parity tracked as open item → PR #103 | **Approved** — RC2 PASSED; migration parity deferred to RC3-C1 |
| RDL-003 | 2026-08-04 | Migration reconciliation merged | Release engineering / merge to `main` | PR [#103](https://github.com/alhazayed/vpsych/pull/103) → `main` @ `5bf66c0`; repo **54** ≡ prod **54**; schema diff 0; integrity 100/100 rebound (`docs/RC3_EVIDENCE_SCOPE.md`, `docs/REPOSITORY_PRODUCTION_INTEGRITY_SCORES.md`); prod deploy `dpl_5F6pBTi…` | **Merged** — RC3-C1 CLEARED |
| RDL-004 | 2026-08-04 | RC3 Wave 1 blocked — evidence collection | Executive Board / certification board | `docs/RC3_PRODUCTION_VALIDATION.md`; RC3-C2 operational prerequisite (vault `VPSYCH_AUDIT_*` not in audit env); accounts exist (`docs/AUDIT_ACCOUNTS.md`); **not** an application defect | **Waiting** — Wave 1 not started for auth-gated missions; Waves 2–7 / RC4 / RC5 locked |
| RDL-005 | 2026-08-04 | Establish permanent release ops + decision trail | Release Manager / certification | `docs/RELEASE_OPERATIONS_CHECKLIST.md`; this file; three-role model (Release Manager / Cursor / Executive Board) | **Adopted** — process quality gates further RC progress |
| RDL-006 | 2026-08-04 | RC3 Wave 1 attempt STOPPED at preconditions | Independent Release Certification Board (Cursor) | Production SHA=`5bf66c0` ≡ `main`; migrations 54≡54; schema diff 0; all four `VPSYCH_AUDIT_*` **MISSING** in audit environment. Artifact: `/opt/cursor/artifacts/rc3/wave1_precondition_stop.json` | **STOP — RC3-C2 Evidence collection blocked.** Missions 1–5 not started. Wave 2 not started. |
| RDL-007 | 2026-08-05 | RC3 Wave 1 re-attempt STOPPED — placeholder secrets | Independent Release Certification Board (Cursor) | Re-invoke on agent `bc-0963154e…` / branch `cursor/wave1-execution-d463`. SHA/`dpl_5F6pBTi…`/`54≡54` still PASS; audit Auth users still present. All four `VPSYCH_AUDIT_*` **keys present** but each **value equals its own key name** (placeholder misconfiguration). Login verify FAIL (`invalid_credentials`). Evidence: `docs/rc3/evidence/wave1_precondition_stop_2026-08-05.json` (refines RDL-006). | **STOP — RC3-C2 Evidence collection blocked (secrets unusable).** Missions 1–5 not started. Wave 2 not started. |

<!-- APPEND NEW ROWS TO THE TABLE ABOVE. Do not reorder, edit, or delete prior rows. Corrections = new RDL row referencing the prior ID. -->

---

## How to append

1. Allocate the next `RDL-00N` ID (monotonic).
2. Add one row to the decision log table.
3. Link evidence paths that already exist in git (reports, PRs, SHAs, deploy IDs).
4. Update `RELEASE_MANIFEST.md` / wave_status only when the decision changes a gate.
5. Commit message: `docs(release): RDL-00N <short decision>`.

---

## Related documents

| Doc | Role |
|---|---|
| `docs/RELEASE_OPERATIONS_CHECKLIST.md` | Recurring ops runbook |
| `docs/rc3/WAVE1_UNLOCK_CHECKLIST.md` | Current Wave 1 boxes |
| `docs/RC3_PRODUCTION_VALIDATION.md` | RC3 master verdict |
| `docs/RC3_EVIDENCE_SCOPE.md` | Evidence SHA/branch validity |
| `docs/AUDIT_ACCOUNTS.md` | Audit identities (no secrets) |
| `docs/RC4_BUGFIX_FREEZE.md` | Post-RC3 freeze |
| `docs/RC5_RELEASE_CHECKLIST.md` | Tag / GitHub Release |
| `RELEASE_MANIFEST.md` | Machine-readable inventory |
