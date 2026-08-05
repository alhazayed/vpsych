# RC3 — Production Validation

**Board date:** 2026-08-05 (Wave 1 re-attempt #3) · prior boards 2026-08-05 / 2026-08-04  
**Phase:** Prove, do not build  
**Production:** `https://vpsych.vercel.app`  
**GitHub `main`:** `5bf66c07f11d286c305f59398a015614d22b723b` (`chore(db): reconcile migrations… (#103)` — post-merge)
**Prior RC3 audit SHA:** `52a7610` (pre-#103; 28 migrations)
**RC3-C1 re-audit:** 2026-08-04 — **CLEARED** (`main` 54 ≡ production 54)
**Integrity 100/100 rebound:** Allowed for `main`@`5bf66c0` — see `docs/RC3_EVIDENCE_SCOPE.md` (repo 54, prod 54, schema diff 0, prod deploy SHA match).
**Evidence scope:** `docs/RC3_EVIDENCE_SCOPE.md` · **Audit accounts:** `docs/AUDIT_ACCOUNTS.md` · **Governance:** `docs/RELEASE_GOVERNANCE.md` · **Ops runbook:** `docs/RELEASE_OPERATIONS_CHECKLIST.md` · **Decision log:** `docs/RELEASE_DECISION_LOG.md`
**Production deploy:** `dpl_5F6pBTi21VrYWaxmWSRcNnCcxTA4` (target=`production`, SHA=`5bf66c0…`)
**Prior prod deploy (RC1):** `dpl_2mBqyfz…` @ `52a7610`  
**Supabase:** `rrzudbkxigeavfdnidnm` (ACTIVE_HEALTHY, us-east-1)  
**Vercel project:** `prj_qiJ1mQvX0s5lJZ9KJnpWAx4EXjNm`  
**Branch (this report):** `cursor/wave1-reattempt-5f72` (continues RC3 docs from `cursor/wave1-execution-d463`)

**Rule:** Evidence collected only against production / `main` / production Supabase / production Vercel. No localhost, preview deployments, or feature-branch app binaries.

**Engineering status:** Nothing further to build for RC3 unlock. Platform, infrastructure, production, and repository are ready. RC3 is **waiting on operational execution** (Release Manager: reset Auth passwords, sync vault, fix email↔role mapping, **manually** prove login, then launch a fresh Cursor Wave 1 agent). **Credential Verification Gate** (RDL-009) and **Release Governance** (RDL-010) adopted — see `docs/RELEASE_GOVERNANCE.md`.

**Role split:** Release Manager owns secrets/login/trigger · Cursor owns Missions 1–5 evidence + PASS/FAIL (no speculative fixes) · Executive Board owns Wave 1 review and Wave 2 unlock. See `docs/RELEASE_DECISION_LOG.md`.

**Wave 1 attempt (2026-08-04):** STOPPED at preconditions — all four `VPSYCH_AUDIT_*` unset in audit environment. See RDL-006.

**Wave 1 re-attempt (2026-08-05 / RDL-007):** STOPPED — keys present but values equal key names (placeholders). See RDL-007.

**Wave 1 re-attempt (2026-08-05 / RDL-008):** STOPPED — values no longer placeholders, but (1) therapist/admin emails **swapped** across role env vars, and (2) both env passwords fail Auth password-grant for **both** canonical audit emails (`invalid_credentials` 2×2). **RC3-C2 — Evidence collection blocked (vault wiring).** Missions 1–5 not executed. See RDL-008. Evidence: `docs/rc3/evidence/wave1_precondition_stop_2026-08-05T1030.json`.

---

## Audited commit scope (resolves RC2 ↔ RC3 apparent contradiction)

| Claim | Refers to | Migrations | Status |
|---|---|---:|---|
| Repository / Production Integrity **100/100**, “greenfield ≡ production schema” | Proven on PR **#103** @ `5c879f4`; **rebound to** `main` @ `5bf66c0` | **54** | **BOUND** — see `docs/RC3_EVIDENCE_SCOPE.md` |
| RC3 initial audit | **`main` @ `52a7610`** + prod deploy `dpl_2mBqyfz…` | **28** vs **54** | Historical — exposed RC3-C1 |
| RC3-C1 re-audit (post-#103) | **`main` @ `5bf66c0`** + production | **54 ≡ 54** | **C1 CLEARED** |

**Scope rule:** Feature-branch scores are not release-candidate evidence until rebound after merge. Post-#103, integrity **100/100** may be cited for `main` @ `5bf66c0` only (repo 54 ≡ prod 54, schema diff 0, prod deploy SHA match).

**Re-verify timestamp (2026-08-04):** PR #103 **MERGED**. `origin/main` = `5bf66c0` (**54** files). Production = **54** versions (latest `20260804085304`). Exact version parity **PASS**. Prod deploy `dpl_5F6pBTi…` READY on `vpsych.vercel.app`.

```yaml
wave_status:
  wave_1:
    state: waiting          # not an app FAIL — evidence collection blocked on ops prerequisite
    blockers:
      - RC3-C2              # operational prerequisite, not application defect
    cleared:
      - RC3-C1              # PR #103 merged; main@5bf66c0 has 54 ≡ prod 54
    rerun_required: true
    rerun_scope: [mission_1, mission_2, mission_3, mission_4, mission_5]
    last_attempt: "2026-08-05"
    last_decision: RDL-008
    process_adopted: [RDL-009, RDL-010]  # Credential Gate (every release) + Release Governance
    rerun_after:
      - "Reset Auth passwords; sync vault; wire therapist email local=audit.therapist and admin email local=audit.admin"
      - "Credential Verification Gate PASS (manual therapist + admin login on https://vpsych.vercel.app)"
      - "Fresh Cursor agent for Wave 1 only"
  wave_2:
    state: locked
    unlock_when: "wave_1.state == passed"
  wave_3:
    state: locked
    unlock_when: "wave_1.state == passed"
  wave_4:
    state: locked
    unlock_when: "wave_1.state == passed"
  wave_5:
    state: locked
    unlock_when: "wave_1.state == passed"
  wave_6:
    state: locked
    unlock_when: "waves_1_through_5 board-accepted"
  wave_7:
    state: locked
    unlock_when: "wave_6 executive approval"
```

**Governance:** RC4 and RC5 remain **LOCKED** until `wave_1.state == passed`. No exceptions.

---

## Executive verdict

### ⏸ RC3 NOT PASSED — Wave 1 waiting (evidence collection blocked)

| Gate | Result |
|---|---|
| Wave 1 — Zero Critical or High **application** defects | **WAITING** (`wave_status.wave_1.state: waiting`) — cannot certify auth-gated missions until RC3-C2 vault wiring authenticates (correct email↔role mapping + working passwords) |
| Wave 2–5 | **LOCKED** pending Wave 1 PASS |
| Wave 6 — Executive approval | **LOCKED / NOT APPROVED** |
| Wave 7 — Public launch readiness | **LOCKED** |

**Status board:**

| RC3 Item | Status |
|---|---|
| RC3-C1 – Migration parity | ✅ CLOSED |
| RC3-C2 – Audit secrets | 🔴 OPEN (email swap + passwords invalid — RDL-008) |
| Wave 1 | 🟡 Waiting |
| Waves 2–7 | 🔒 Locked |
| RC4 / RC5 | 🔒 Locked |

**Findings:**

| ID | Class | Severity | Finding | Remediation |
|---|---|---|---|---|
| RC3-C1 | Application / schema governance | ~~Critical~~ **CLEARED** | Was: `main`@`52a7610` had 28 vs prod 54. | [#103](https://github.com/alhazayed/vpsych/pull/103) merged `5bf66c0`. Re-audit: **54 ≡ 54**, schema diff 0. Integrity 100/100 rebound allowed. |
| RC3-C2 | **Operational prerequisite** — Release Infrastructure · Owner: **Release Manager** · **Not an application defect** | Critical (blocks evidence) | **Evidence collection blocked.** Auth users + roles OK. Env values no longer placeholders, but therapist/admin emails are **swapped** across role env vars and **neither** env password authenticates either canonical audit email. | Release Manager: (1) set therapist email env local=`audit.therapist`, admin email env local=`audit.admin`; (2) apply vault passwords to those Auth users; (3) verify login on `https://vpsych.vercel.app`; (4) re-run Missions **1–5** only. See `docs/AUDIT_ACCOUNTS.md` + `docs/rc3/WAVE1_RDL008_STOP.md` + RDL-008. |

---

## Preflight (RC2 exit → RC3 entry)

| Check | Evidence | Pass? |
|---|---|---|
| #100 on `main` | `52a7610` | ✅ |
| Production deploy SHA == `main` | `dpl_5F6pBTi…` = `5bf66c0…` (post-#103) | ✅ |
| `/api/health` | 200 `{"ok":true,"service":"vpsych",…}` | ✅ |
| `/robots.txt`, `/sitemap.xml`, `/privacy`, `/terms` | 200 | ✅ |
| Anon `/api/sessions` | **401 JSON** `{"error":"Unauthorized"}` (not 307 HTML) | ✅ |
| Locale cookie `Secure` | `locale=en; … Secure; SameSite=lax` | ✅ |
| Security headers | CSP, HSTS preload, COOP/CORP, XFO DENY, nosniff, Permissions-Policy | ✅ |
| Vercel runtime errors (24h) | None reported | ✅ |
| Migration parity `main` ↔ prod | **54 ≡ 54** @ `5bf66c0` | ✅ **RC3-C1 CLEARED** |

---

## Mission matrix (production evidence)

Legend: **PASS** · **FAIL** · **CONDITIONAL** (data/schema OK, runtime not executed) · **BLOCKED** (credentials)

| # | Mission | Wave | Verdict | Evidence |
|---:|---|---|---|---|
| 1 | UI / UX / Navigation | 1 | **PASS** | Browser prod screenshots; EN/AR RTL; mobile 390px; 0 Critical/High UI defects. Artifacts: `/opt/cursor/artifacts/rc3/screenshots/`, `docs/rc3/M01_UI_UX.md` |
| 2 | Authentication & Authorization | 1 | **BLOCKED (C2 ops)** (public PASS) | Soft auth + anon API/RLS PASS. Therapist/admin login matrix awaits vault `VPSYCH_AUDIT_*` (accounts exist). |
| 3 | Database / Supabase | 1 | **PASS** (parity) | `main`@`5bf66c0` **54 ≡ 54** production. Live DB healthy (56 tables, RLS on). Re-run with audit creds for any auth-gated DB paths. |
| 4 | API Runtime | 1 | **BLOCKED (C2 ops)** (anon PASS) | Anon contract PASS. Authenticated session create/message/end awaits secrets. |
| 5 | AI Runtime | 1 | **BLOCKED (C2 ops)** | Admin OpenAI health gated correctly; live GPT/assessment path awaits secrets. |
| 6–24 | Waves 2–5 missions | 2–5 | **LOCKED** | Informational data notes retained in `docs/rc3/*`; **do not advance** until Wave 1 PASS. |
| 25 | Executive Release Board | 6 | **LOCKED** | Reconvene only after Waves 1–5. |
| 26–30 | Public launch | 7 | **LOCKED** | After Wave 6. |

---

## Wave gates (detail)

### Wave 1 — Platform Validation → **WAITING** (`rerun_required: true`)

Public RC1 surfaces are live. **RC3-C1 CLEARED** (`main`@`5bf66c0`, 54 ≡ 54, schema diff 0, integrity 100/100 rebound). **RC3-C2 — Evidence collection blocked** (ops prerequisite; not a VPsych defect). After vault injection + login verify → Missions **1–5** only — **do not restart** completed infrastructure work or Missions 6–30.

### Waves 2–5 → **LOCKED**

Prior catalog/schema observations (templates, personas, CGE/ACE seeds, etc.) remain on file as **informational** only. They do **not** unlock these waves. Unlock condition: `wave_1.state == passed` with **zero Critical or High**.

### Wave 6 — Executive Release Board → **LOCKED / NOT APPROVED**

Do not reconvene until Waves 1–5 are board-accepted.

### Wave 7 — Public Launch → **LOCKED**

Blocked until Wave 6 approval.

---

## RC3 re-run strategy (Wave 1 only)

| Step | Action | Exit criterion |
|---:|---|---|
| 1 | Resolve **RC3-C1** | ✅ **DONE** — #103 merged; `main`@`5bf66c0`; 54 ≡ 54 |
| 2 | Resolve **RC3-C2** (ops): replace placeholder `VPSYCH_AUDIT_*` values with vault credentials (value ≠ key name); verify therapist then admin login on `https://vpsych.vercel.app` | C2 cleared — unlock Wave 1 execution |
| 3 | Execute **only Missions 1–5** against production + `main`@`5bf66c0` | Wave 1 PASS iff **0 Critical and 0 High** application findings |
| 4 | If Wave 1 PASS → unlock Waves 2–7 in order; **do not** restart C1 / integrity work | Continue RC3 evidence collection |

**RC4 / RC5 remain locked** until Wave 1 PASS. No exceptions.

### Tracked non-blockers (after Wave 1, still fix)

| ID | Severity | Finding |
|---|---|---|
| RC3-H1 | High | Supabase Auth leaked-password protection disabled — treat as Wave 1 High if still open at re-run; otherwise Wave 5 |
| RC3-M1 | Medium | Landing HTML lacks Open Graph tags |
| RC3-M2 | Medium | Advisor WARN on intentional SECURITY DEFINER RPCs |
| RC3-M3 | Medium | Runtime clone preset `cbt-skills-gp-en-copy-msdflwu3` (disabled) |

---

## Artifacts

| Path | Contents |
|---|---|
| `/opt/cursor/artifacts/rc3/screenshots/` | M01/M02 browser evidence |
| `/opt/cursor/artifacts/rc3/wave1_public_probes.json` | HTTP/security probes |
| `/opt/cursor/artifacts/rc3/waves_2_7_evidence.json` | SEO/perf/API samples |
| `/opt/cursor/artifacts/rc3/db_inventory_summary.json` | Live DB counts |
| `docs/rc3/*` | Per-mission briefs |
| `docs/RELEASE_GOVERNANCE.md` | Long-term release policy (roles, RC state machine, gates) — RDL-010 |
| `docs/RELEASE_OPERATIONS_CHECKLIST.md` | Permanent Release Manager runbook (RC3 unlock + every future release) |
| `docs/RELEASE_DECISION_LOG.md` | Append-only release decision trail (RDL-001…) |
| `docs/RC4_BUGFIX_FREEZE.md` | Post-RC3 freeze rules (**locked**) |
| `docs/RC5_RELEASE_CHECKLIST.md` | Tag/release tasks (**locked**) |

---

## RC4 / RC5 pointer

- **RC4** and **RC5** MUST NOT START until `wave_status.wave_1.state == passed`.  
- No waivers. No partial exceptions for tagging `v1.0.0`.
