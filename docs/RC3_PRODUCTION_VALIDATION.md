# RC3 — Production Validation

**Board date:** 2026-08-04  
**Phase:** Prove, do not build  
**Production:** `https://vpsych.vercel.app`  
**GitHub `main`:** `5bf66c07f11d286c305f59398a015614d22b723b` (`chore(db): reconcile migrations… (#103)` — post-merge)
**Prior RC3 audit SHA:** `52a7610` (pre-#103; 28 migrations)
**RC3-C1 re-audit:** 2026-08-04 — **CLEARED** (`main` 54 ≡ production 54)
**Integrity 100/100 rebound:** Allowed for `main`@`5bf66c0` — see `docs/RC3_EVIDENCE_SCOPE.md` (repo 54, prod 54, schema diff 0, prod deploy SHA match).
**Evidence scope:** `docs/RC3_EVIDENCE_SCOPE.md` · **Audit accounts:** `docs/AUDIT_ACCOUNTS.md`  
**Production deploy:** `dpl_5F6pBTi21VrYWaxmWSRcNnCcxTA4` (target=`production`, SHA=`5bf66c0…`)
**Prior prod deploy (RC1):** `dpl_2mBqyfz…` @ `52a7610`  
**Supabase:** `rrzudbkxigeavfdnidnm` (ACTIVE_HEALTHY, us-east-1)  
**Vercel project:** `prj_qiJ1mQvX0s5lJZ9KJnpWAx4EXjNm`  
**Branch (this report):** `cursor/rc3-production-validation-b5ac`

**Rule:** Evidence collected only against production / `main` / production Supabase / production Vercel. No localhost, preview deployments, or feature-branch app binaries.

---

## Audited commit scope (resolves RC2 ↔ RC3 apparent contradiction)

| Claim | Refers to | Migrations | Status |
|---|---|---:|---|
| Repository / Production Integrity **100/100**, “greenfield ≡ production schema” | PR **#103** branch `cursor/migration-reconciliation-b5ac` @ `5c879f4` | **54** | Proven on that branch; **not on `main`** |
| RC3 initial audit | **`main` @ `52a7610`** + prod deploy `dpl_2mBqyfz…` | **28** vs **54** | Exposed RC3-C1 |
| RC3-C1 re-audit (post-#103) | **`main` @ `5bf66c0`** + production | **54 ≡ 54** | **C1 CLEARED** |

**These statements are not contradictory** once scoped: the 100/100 scores document work that has **not yet landed on `main`**. RC3 correctly audited the release train (`main`), which still lacks the parity tree. RC2’s open migration-parity item is the same gap RC3-C1 elevates to Critical.

**Re-verify timestamp (2026-08-04 10:51 UTC):** PR #103 **MERGED**. `origin/main` = `5bf66c0` (**54** files). Production = **54** versions (latest `20260804085304`). Exact version parity **PASS**.

```yaml
wave_status:
  wave_1:
    state: failed
    blockers:
      - RC3-C2
    cleared:
      - RC3-C1  # PR #103 merged; main@5bf66c0 has 54 ≡ prod 54
    rerun_required: true
    rerun_scope: [mission_1, mission_2, mission_3, mission_4, mission_5]
    rerun_after:
      - "Dedicated VPSYCH_AUDIT_THERAPIST_* and VPSYCH_AUDIT_ADMIN_* configured"
      - "Audit login verified on https://vpsych.vercel.app"
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

### ❌ RC3 NOT PASSED — Wave 1 gate failed

| Gate | Result |
|---|---|
| Wave 1 — Zero Critical or High technical defects | **FAIL** (`wave_status.wave_1.state: failed`) |
| Wave 2–5 | **LOCKED** pending Wave 1 PASS (prior CONDITIONAL notes are informational only) |
| Wave 6 — Executive approval | **LOCKED / NOT APPROVED** |
| Wave 7 — Public launch readiness | **LOCKED** |

**Blocking Critical (must clear before Wave 1 re-run):**

| ID | Severity | Finding | Remediation |
|---|---|---|---|
| RC3-C1 | ~~Critical~~ **CLEARED** | Was: `main`@`52a7610` had 28 vs prod 54. | [#103](https://github.com/alhazayed/vpsych/pull/103) merged `5bf66c0`. Re-audit: **54 ≡ 54** exact version parity. Local `npm run test:migrations` structure OK. |
| RC3-C2 | **Critical** | Dedicated audit identities missing from the RC3 environment (`VPSYCH_AUDIT_*` unset). Without them Wave 1 cannot certify therapist/admin/AI/voice/session paths. | Provision **permanent** dedicated accounts (not personal): `VPSYCH_AUDIT_THERAPIST_EMAIL/PASSWORD`, `VPSYCH_AUDIT_ADMIN_EMAIL/PASSWORD`. Verify login on production. Re-run Missions **1–5** only. |

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
| 2 | Authentication & Authorization | 1 | **FAIL pending C2** (public PASS) | Soft auth + anon API/RLS PASS. Therapist/admin login matrix **not certified** without dedicated audit accounts. |
| 3 | Database / Supabase | 1 | **PASS** (parity) | `main`@`5bf66c0` **54 ≡ 54** production. Live DB healthy (56 tables, RLS on). Re-run with audit creds still needed for auth-gated DB paths if any. |
| 4 | API Runtime | 1 | **FAIL pending C2** (anon PASS) | Anon contract PASS. Authenticated session create/message/end **not certified**. |
| 5 | AI Runtime | 1 | **FAIL pending C2** | Admin OpenAI health gated correctly; live GPT/assessment path **not certified**. |
| 6–24 | Waves 2–5 missions | 2–5 | **LOCKED** | Informational data notes retained in `docs/rc3/*`; **do not advance** until Wave 1 PASS. |
| 25 | Executive Release Board | 6 | **LOCKED** | Reconvene only after Waves 1–5. |
| 26–30 | Public launch | 7 | **LOCKED** | After Wave 6. |

---

## Wave gates (detail)

### Wave 1 — Platform Validation → **FAIL** (`rerun_required: true`)

Public RC1 surfaces are live. **RC3-C1 CLEARED** (`main`@`5bf66c0`, 54 ≡ 54). Gate still fails on **RC3-C2** (no dedicated audit identities). Re-run Missions **1–5** after C2 clears — **do not restart Missions 6–30**.

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
| 2 | Resolve **RC3-C2**: configure permanent `VPSYCH_AUDIT_THERAPIST_*` + `VPSYCH_AUDIT_ADMIN_*`; verify login on `https://vpsych.vercel.app` | C2 cleared |
| 3 | Re-run **only Missions 1–5** against production + post-merge `main` | Wave 1 PASS iff **0 Critical and 0 High** |
| 4 | If Wave 1 PASS → set `wave_2…wave_5.state: unlocked` and execute those waves; **then** reconvene Executive Board | Waves advance in order |

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
| `docs/RC4_BUGFIX_FREEZE.md` | Post-RC3 freeze rules (**locked**) |
| `docs/RC5_RELEASE_CHECKLIST.md` | Tag/release tasks (**locked**) |

---

## RC4 / RC5 pointer

- **RC4** and **RC5** MUST NOT START until `wave_status.wave_1.state == passed`.  
- No waivers. No partial exceptions for tagging `v1.0.0`.
