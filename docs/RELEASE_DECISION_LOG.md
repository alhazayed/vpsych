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
| RDL-008 | 2026-08-05 | RC3 Wave 1 re-attempt STOPPED — email swap + passwords invalid | Independent Release Certification Board (Cursor) | Agent `bc-fe2c2042…` / branch `cursor/wave1-reattempt-5f72`. SHA/`dpl_5F6pBTi…`/`54≡54`/public gates still PASS; Auth users + roles PASS. Env values **no longer** placeholders (value≠key). Failures: (1) therapist/admin **emails swapped** across role env vars; (2) both env passwords fail password-grant for **both** canonical audit emails (`invalid_credentials` 2×2 matrix). Evidence: `docs/rc3/evidence/wave1_precondition_stop_2026-08-05T1030.json` (refines RDL-007). | **STOP — RC3-C2 Evidence collection blocked (vault wiring).** Missions 1–5 not started. Wave 2 not started. |
| RDL-009 | 2026-08-05 | Adopt Credential Verification Gate before certification | Release Manager / certification board | After second RC3-C2 iteration (RDL-007 placeholders → RDL-008 email swap + invalid passwords), strengthen ops: mandatory `audit_credentials` gate (`email_matches_expected` + `login_success` for therapist and admin); Release Manager must reset Auth passwords, sync vault, fix mapping, and **manually** prove login on `https://vpsych.vercel.app` before launching a fresh Cursor Wave 1 agent. Spec: `docs/RELEASE_OPERATIONS_CHECKLIST.md`, `docs/rc3/WAVE1_UNLOCK_CHECKLIST.md`, `docs/AUDIT_ACCOUNTS.md`. Binding for **every future release**, not only v1.0. | **Adopted** — if gate false → stop certification + RDL entry; do not start Missions 1–5. |
| RDL-010 | 2026-08-05 | Adopt long-term Release Governance policy | Release Manager / certification board | Add immutable `docs/RELEASE_GOVERNANCE.md`: roles, RC1–RC5 state machine, wave unlock rules, operational prerequisites (incl. Credential Verification Gate for every release), evidence requirements, RDL policy, release-phase commit traceability, engineering permit/prohibit rules. Ops checklist remains the runbook; governance is the policy. | **Adopted** — governs v1.0 and all future releases. |
| RDL-011 | 2026-08-05 | Clear RC3-C2 — Credential Verification Gate PASS | Release Manager / Cursor (runbook executor) | Agent `bc-d6e39480…`. Auth+Vault already restored at 12:08Z; this run completed Phases 0–3d with egress. Diagonal password-grant matrix PASS; cookie-auth role separation PASS (therapist 403 / admin 200); browser login PASS both accounts; migrations 54≡54; prod SHA `5bf66c0` / `dpl_5F6pBTi…`. Primary root cause: **password material mismatch**; email swap secondary. Evidence: `docs/rc3/RC3_C2_GATE_PASS.md`, `docs/rc3/evidence/rc3_c2_gate_pass_2026-08-05T1245Z.json`. | **PASS — RC3-C2 cleared.** Wave 1 still requires RM to update persistent Cursor secrets from Vault, then a **fresh** agent. |
| RDL-012 | 2026-08-05 | RC3 Wave 1 — CERTIFIED WITH RECOMMENDATIONS; W1-C1 Critical fixed | Independent Release Certification Board (Cursor) | Agent `bc-633ebfe4…`. Preflight PASS after Vault inject (boot secrets still swapped/stale). Missions 1–5 on production `5bf66c0` / `dpl_5F6pBTi…`. **W1-C1 Critical:** `insert_system_message` / `insert_assistant_message` bodies remained service_role-only after grant-only V1-C1 restore → session create 500; fixed by migration `20260805130453_restore_session_message_rpc_owner_auth` (prod applied; repo 55≡55). Retest create/message/end PASS (`aiSource: gpt`). Residual **RC3-H1** High ops: Auth leaked-password protection disabled. Evidence: `docs/rc3/WAVE1_SUMMARY.md`, `docs/rc3/evidence/wave1_pack_2026-08-05T1305Z.json`. | **⚠ WAVE 1 CERTIFIED WITH RECOMMENDATIONS.** Recommend Board **UNLOCK WAVE 2**; do not start Wave 2 in this run. RM still must fix persistent Cursor secrets. |
| RDL-013 | 2026-08-05 | Unlock RC3 Wave 2 (Clinical Runtime) | Executive Board | Wave 1 CERTIFIED WITH RECOMMENDATIONS (RDL-012). Board authorizes Missions 6–8 + voice/safety on production only. | **AUTHORIZED — Wave 2 may start.** Waves 3–7 remain locked pending Wave 2 PASS. |
| RDL-014 | 2026-08-05 | RC3 Wave 2 — FAILED | Independent VPsych Clinical Certification Board (Cursor) | Agent `bc-633ebfe4…`. Preflight PASS. Production evidence `RC3-W2-EV-20260805T1400Z`. Open Highs: **W2-H1** complex-ptsd create blocked; **W2-H2** consultant preset rejected; **W2-H3/H4** mania/schizophrenia conversational phenotype mismatch. Voice PASS; assessment reproducibility Δ=0 on matched MDD pair. Code fixes for H1/H2 prepared on branch but **not** deployed to production app `5bf66c0`. Evidence: `docs/rc3/WAVE2_SUMMARY.md`, `docs/rc3/evidence/wave2_pack_2026-08-05T1400Z.json`. | **❌ WAVE 2 FAILED.** Do **not** unlock Wave 3. |
| RDL-015 | 2026-08-05 | RC3 Wave 2 independent re-cert — FAILED | Independent VPsych Clinical Certification Board (Cursor) | Fresh agent on production only (`5bf66c0` / `dpl_5F6pBTi…`). Preflight PASS. Independently reproduced **W2-H1–H4** still open. Remediation PR [#112](https://github.com/alhazayed/vpsych/pull/112) @ `7f43ce1` **not** merged/deployed — preview deploys not used. TTS EN/AR PASS; report RLS PASS. Evidence: `docs/rc3/WAVE2_RECERTIFICATION.md`, `docs/rc3/WAVE2_EVIDENCE.md`, `docs/rc3/evidence/wave2_recert_pack_2026-08-05T1545Z.json`. | **❌ WAVE 2 FAILED.** Do **not** unlock Wave 3. Require production deploy then new independent re-cert. |
| RDL-016 | 2026-08-05 | Formalize RDL-015 Board posture — APPLICATION_REMEDIATION_REQUIRED | Executive Board / certification record | Confirms RDL-015: `decision=FAILED`, `status=APPLICATION_REMEDIATION_REQUIRED`, `credential_gate=CLOSED`, browser therapist/admin **PASS** (evidence screenshots), `unlock_wave_3=false`, engineering limited to verified W2-H1–H4 only. RC3-C2 resolved — do not reopen. Failure locus is clinical/runtime application defects, not authentication. Spec: `docs/rc3/RDL-015_BOARD_DECISION.md`, `docs/rc3/W2_VERIFIED_HIGHS.md`. | **Adopted.** Next: remediate H1–H4 only → deploy → new independent Wave 2 re-cert. Wave 3 locked. |
| RDL-017 | 2026-08-05 | RC3 Wave 2 final independent re-cert — FAILED | Independent VPsych Clinical Certification Board (Cursor) | Production-only probes `RC3-W2-FINAL-EV-20260805T1705Z` on `5bf66c0` / `dpl_5F6pBTi…`. Preflight PASS. Independently reproduced **W2-H1–H4** still open. Remediation PR [#114](https://github.com/alhazayed/vpsych/pull/114) **not** on production. TTS EN/AR PASS; assessment generates (Δ=13 Medium residual). Evidence: `docs/rc3/WAVE2_FINAL_CERTIFICATION.md`, `docs/rc3/evidence/wave2_final_pack_2026-08-05T1705Z.json`. | **❌ WAVE 2 FAILED.** Do **not** unlock Wave 3. Require production deploy of remediations then fresh independent re-cert. |

| RDL-018 | 2026-08-05 | Resolve Deployment Drift — authorize post-deploy Wave 2 final re-cert | Executive Board | Drift confirmed; remediation PR [#114](https://github.com/alhazayed/vpsych/pull/114) merged → `main` @ `5aae138`; production `dpl_8Q7YGEH…` contains remediation `8436208`; promotion smoke PASS. Engineering **CLOSED**. Evidence: `docs/rc3/W2_DEPLOYMENT_VERIFICATION.md`, `docs/rc3/W2_RELEASE_PROMOTION.md` (promotion branch). | **AUTHORIZED — post-deploy independent Wave 2 final re-cert.** Wave 3 remains locked until PASS. |
| RDL-019 | 2026-08-05 | RC3 Wave 2 post-deploy final re-cert — PASSED | Independent VPsych Clinical Certification Board (Cursor) | Production-only `RC3-W2-FINAL-RECERT-EV-20260805T1725Z` on `5aae138` / `dpl_8Q7YGEH…`. Preflight PASS. Independently verified **W2-H1–H4 PASS**. Regression TTS/STT/GPT/assessment/RLS/EN/AR PASS. Evidence: `docs/rc3/WAVE2_FINAL_RECERTIFICATION.md`, `docs/rc3/WAVE2_FINAL_SUMMARY.md`, `docs/rc3/evidence/wave2_final_recert_pack_2026-08-05T1725Z.json`. Residual: git missing W1-C1 migration filename (prod has it). | **✅ WAVE 2 PASSED.** Recommend Board **UNLOCK WAVE 3**. Do **not** start Wave 3 in this run. |

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
| `docs/RELEASE_GOVERNANCE.md` | **Long-term release policy** (roles, RC state machine, gates, engineering rules) |
| `docs/RELEASE_OPERATIONS_CHECKLIST.md` | Recurring ops runbook |
| `docs/rc3/RC3_C2_CREDENTIAL_GATE_RUNBOOK.md` | Credential gate remediation steps |
| `docs/rc3/RC3_C2_GATE_PASS.md` | Gate PASS report (RDL-011) |
| `docs/rc3/WAVE1_UNLOCK_CHECKLIST.md` | Current Wave 1 boxes |
| `docs/RC3_PRODUCTION_VALIDATION.md` | RC3 master verdict |
| `docs/RC3_EVIDENCE_SCOPE.md` | Evidence SHA/branch validity |
| `docs/AUDIT_ACCOUNTS.md` | Audit identities (no secrets) |
| `docs/RC4_BUGFIX_FREEZE.md` | Post-RC3 freeze |
| `docs/RC5_RELEASE_CHECKLIST.md` | Tag / GitHub Release |
| `RELEASE_MANIFEST.md` | Machine-readable inventory |
| `scripts/rc3-credential-gate-preflight.mjs` | Phase 2 + 3a preflight before dispatching agents |
