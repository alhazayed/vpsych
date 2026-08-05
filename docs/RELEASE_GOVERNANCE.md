# Release Governance

**Status:** Adopted (RDL-010)  
**Scope:** Every VPsych release candidate and public release (v1.0, v1.1, …)  
**Nature:** Immutable long-term **policy**. Day-to-day steps live in `docs/RELEASE_OPERATIONS_CHECKLIST.md`. Version-specific evidence lives in RC / wave reports.

This document defines *who decides*, *what must be true*, and *what is forbidden* during a release. It does not replace mission briefs or technical certification reports.

---

## 1. Purpose

1. Keep certification focused on **validating the product**, not diagnosing operational setup.
2. Separate **Release Infrastructure** failures from **application defects**.
3. Make wave unlock, engineering freezes, and public-release decisions auditable years later.
4. Apply the same gates to every future version — not only the current RC cycle.

---

## 2. Roles and responsibilities

| Role | Owns | Does not |
|---|---|---|
| **Release Manager** | Vault / Auth credential sync; Credential Verification Gate; production SHA & migration preflight; triggering certification agents; cutover logistics (tag, GitHub Release, monitoring) | Speculative engineering; rewriting product requirements mid-cert |
| **Cursor (certification agent)** | Re-check gates; run unlocked wave missions only; produce evidence; identify **verified** defects; PASS/FAIL recommendation; append RDL on STOP/PASS/FAIL | Speculative fixes; feature work; unlocking later waves; inventing credentials |
| **Executive Board** | Accept or reject wave results; unlock the next wave; approve RC4/RC5/public release; record waivers in the RDL | Bypassing operational prerequisites without a recorded waiver |

Three-role model is mandatory. One person may hold more than one role only if the RDL records that dual-hat for the cycle.

---

## 3. Release lifecycle (RC1–RC5)

```text
RC1  Code freeze / soft-launch remediation candidate
  │
RC2  Infrastructure freeze (parity, deploy, ops readiness)
  │
RC3  Production validation (prove, do not build)
  │     Credential Verification Gate MUST PASS before Wave 1
  │     Waves 1 → 5 (certification) → Wave 6 Executive Board → Wave 7 public readiness
  │
RC4  Bugfix freeze (verified defects from RC3 only)
  │
RC5  Release checklist (tag, GitHub Release, manifest, monitoring)
  │
Public Release
```

| Phase | Intent | Engineering allowed? |
|---|---|---|
| RC1 | Freeze a candidate; remediate soft-launch blockers | Yes — only for RC1-scoped verified defects |
| RC2 | Freeze infrastructure; prove deploy/parity readiness | Yes — only for RC2-scoped infra defects (e.g. migration reconciliation) |
| RC3 | Prove production behavior with evidence | **No** speculative work. Docs/evidence only unless a verified Critical/High app defect is filed |
| RC4 | Fix **only** board-accepted RC3 defects | Yes — scoped to the RC4 defect list |
| RC5 | Tag / publish / cut over | No product changes except RC5 checklist items |
| Between public releases | Normal engineering | Yes — outside an active RC freeze |

Do not skip RC phases. Do not treat CI green or a feature-branch score as production certification.

---

## 4. Certification waves (RC3)

| Wave | Scope | Unlock when |
|---|---|---|
| Wave 1 | Missions 1–5 (UI, AuthZ, Database, API, AI) | Preflight + **Credential Verification Gate** PASS |
| Wave 2 | Next certified mission block (per RC3 plan) | `wave_1.state == passed` and Executive Board unlock |
| Wave 3 | … | Prior wave board-accepted |
| Wave 4 | … | Prior wave board-accepted |
| Wave 5 | … | Prior wave board-accepted |
| Wave 6 | Executive Board review | Waves 1–5 board-accepted |
| Wave 7 | Public launch readiness | Wave 6 executive approval |

**Rules:**

- Later waves stay **locked** until earlier waves pass.
- Re-runs after a fix cover **only the affected wave/missions**, not the full historical mission set, unless the changed artifact invalidates earlier evidence.
- RC4 and RC5 stay **locked** until Wave 1 has passed and governance allows progression (normally after Waves 1–5 + Wave 6 for public release).

---

## 5. Mandatory pre-certification checks

Before **any** authenticated certification wave on **any** version:

| Check | Required |
|---|---|
| `email_matches_expected` (therapist + admin) | ✅ |
| `login_success` (therapist + admin, **manual** on production first) | ✅ |
| Production SHA verified (deploy ≡ intended release SHA) | ✅ |
| Migration parity verified (repo ≡ production `schema_migrations`) | ✅ |
| Schema diff = 0 (release-critical object classes) | ✅ |

```yaml
precondition:
  require:
    - audit_credentials.therapist.email_matches_expected
    - audit_credentials.therapist.login_success
    - audit_credentials.admin.email_matches_expected
    - audit_credentials.admin.login_success
    - production_sha_verified
    - migration_parity_verified
    - schema_diff_zero
  if_false:
    stop_certification: true
    create_rdl_entry: true
    do_not_execute_missions: true
    do_not_create_engineering_work: true
    category: Release Infrastructure   # not an application defect
```

**Credential Verification Gate** (RDL-009; binding for every future release):

- Therapist env email local = expected audit therapist identity; password unlocks that Auth user.
- Admin env email local = expected audit admin identity; password unlocks that Auth user.
- No role swap. No placeholder values (`value == key name`).
- Release Manager proves **manual** login on production before launching Cursor.
- Cursor re-checks the gate; on failure → STOP + RDL; never invent credentials.

Operational how-to: `docs/RELEASE_OPERATIONS_CHECKLIST.md`  
Identities (no passwords): `docs/AUDIT_ACCOUNTS.md`

---

## 6. Operational prerequisites vs application defects

| Class | Examples | Owner | Engineering? |
|---|---|---|---|
| **Release Infrastructure** | Missing/placeholder/swapped audit secrets; Auth password not synced to vault; wrong deploy alias | Release Manager | No — fix ops, append RDL, re-gate |
| **Application defect** | AuthZ hole, API leak, broken session pipeline, UI Critical/High on production | Engineering (via board) | Only after verified finding + phase allows it |
| **Evidence / scope error** | Citing feature-branch scores as `main` evidence | Certification | Correct docs; re-bind per evidence scope rules |

RC3-C2-class stops are Release Infrastructure until proven otherwise.

---

## 7. Evidence requirements

1. Evidence is collected **only** against production / intended release SHA / production Supabase / production Vercel — never localhost, preview deployments, or unmerged feature-branch app binaries (unless the report explicitly scopes a non-release experiment).
2. Every cited score or PASS must declare its **Valid For** SHA/branch (`docs/RC3_EVIDENCE_SCOPE.md` or successor for later versions).
3. Feature-branch results are not release-candidate evidence until rebound after merge.
4. Artifacts (JSON probes, screenshots, mission briefs) must not contain passwords or usable secret values.
5. Cursor PASS/FAIL is a **recommendation**; Executive Board acceptance is the unlock.

---

## 8. Decision logging policy

`docs/RELEASE_DECISION_LOG.md` is **append-only**.

Required RDL rows include (non-exhaustive):

- RC phase approvals and freezes
- Wave unlock / block / STOP / PASS / FAIL
- Adoption of governance or ops process changes
- Waivers (must state what is waived, by whom, and expiry)
- Public release approval or refusal
- Tag / GitHub Release events

**On any failed mandatory pre-certification check:** stop certification, append an RDL entry, do not execute missions, do not open engineering work.

---

## 9. Traceability for release-phase commits

During an active RC cycle:

| Change type | Allowed | Traceability |
|---|---|---|
| Evidence / governance / ops docs | Yes | Commit message cites RDL or wave id (e.g. `docs(rc3): RDL-00N …`) |
| Verified Critical/High app fix | Only when the current RC phase permits engineering | Links finding id + mission; board-visible |
| Speculative refactors, features, “while we’re here” | **Forbidden** | — |
| Migration / schema | Only via new append-only migrations; never edit applied migrations | Migration tests + RDL if it affects parity claims |

`RELEASE_MANIFEST.md` must be updated when gate state, SHA, deploy id, or approval status changes.

---

## 10. Conditions that permit or prohibit engineering

**Prohibit (typical RC3 waiting / in-flight certification):**

- Speculative improvements
- Unrelated refactors
- Starting Waves 2–7 early
- RC4/RC5 cutover work before unlock
- “Fixing” Release Infrastructure issues in application code

**Permit:**

- Docs and evidence required by this governance
- Fixes for **board-accepted, verified** defects in the phase that allows them (RC1/RC2 scoped; RC4 defect list)
- Hotfixes for production Sev-0 with Executive Board waiver recorded in the RDL

---

## 11. After manual login succeeds (happy path)

Nothing in the process changes:

1. Start a **fresh** Cursor agent (picks up updated secrets).
2. Cursor validates the Credential Verification Gate (+ SHA / parity / schema diff).
3. If the gate passes → unlock Wave 1 → execute Missions **1–5** only.
4. Cursor produces evidence and a PASS/FAIL recommendation.
5. Executive Board decides whether to unlock Wave 2.
6. No speculative fixes, no feature work, no RC4/RC5 unless governance unlocks them.

---

## 12. Document system

| Document | Role | Mutability |
|---|---|---|
| **`docs/RELEASE_GOVERNANCE.md`** (this file) | Long-term policy for every release | Policy changes require an RDL row |
| `docs/RELEASE_OPERATIONS_CHECKLIST.md` | Recurring Release Manager runbook | Update as ops procedures evolve; keep aligned with this policy |
| `docs/RELEASE_DECISION_LOG.md` | Append-only decision trail | Append only |
| `RELEASE_MANIFEST.md` | Machine-readable inventory for the active candidate | Update on gate/SHA/approval changes |
| `docs/RC*_*.md` / `docs/rc3/*` | Version/cycle-specific evidence | Per cycle |
| `docs/RC3_EVIDENCE_SCOPE.md` (or successor) | SHA/branch validity of cited evidence | Per cycle |
| `docs/AUDIT_ACCOUNTS.md` | Permanent audit identities (no passwords) | Identity changes require RDL + rotation notes |
| Wave unlock checklists | Boxes for the active wave | Per cycle |

---

## 13. Current release snapshot (informational)

```text
RC1  ✅ PASSED
RC2  ✅ PASSED
RC3  🟡 WAITING
        ├── Infrastructure        ✅
        ├── Repository            ✅
        ├── Production            ✅
        ├── Migration Parity      ✅
        ├── Credential Gate       ⏳ Waiting (RDL-008; gate policy RDL-009)
        ▼
Wave 1 (M1–M5) → … → Executive Board
```

This snapshot is not policy; update it in `RELEASE_MANIFEST.md` / RC3 reports as the cycle advances. The rules above remain binding after v1.0.
