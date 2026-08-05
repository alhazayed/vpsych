# RC3 Wave 2 — Deployment Verification

**Evidence ID:** `RC3-W2-DEPLOY-EV-20260805T1712Z`  
**Date (UTC):** 2026-08-05  
**Board:** Release Verification (not engineering, not certification)  
**Authority:** Wave 2 failed; verified remediation must be checked for production presence  
**Role:** Determine why remediated behavior is absent from production  
**Constraints observed:** No code changes · No deploy · No Wave 3 · No re-certify

---

## Verdict

```
DEPLOYMENT DRIFT
Production is not running the remediated code.
```

**Outcome class:** **A) DEPLOYMENT DRIFT**

Production alias `https://vpsych.vercel.app` runs git SHA `5bf66c0` (`dpl_5F6pBTi21VrYWaxmWSRcNnCcxTA4`, `target=production`, ref=`main`). Remediation commits `7f43ce1` (PR #112) and `8436208` (PR #114) are **not** ancestors of `origin/main`, and both PRs remain **OPEN / unmerged**. Preview deployments exist for those branches but are **not** aliased to production.

Per verification rule §4: production SHA **predates** remediation → **STOP**. Steps 5–6 (runtime/env/cache path analysis) are out of scope once drift is proven.

---

## 1. Remediation commit inventory

### Canonical application remediation (RDL-016)

| Field | Value |
|---|---|
| **Commit SHA** | `8436208453858b15d214b72ece061cfda8923565` (`8436208`) |
| **Subject** | `fix(rc3): remediate Wave 2 Highs W2-H1–H4 (RDL-016)` |
| **Committed** | 2026-08-05 16:57:59 +0000 |
| **Parent** | `5bf66c07f11d286c305f59398a015614d22b723b` (current `main`) |
| **Branch** | `cursor/w2-application-remediation-0594` |
| **PR** | [#114](https://github.com/alhazayed/vpsych/pull/114) — **OPEN**, `mergedAt: null`, base=`main` |
| **Addresses** | W2-H1, W2-H2, W2-H3, W2-H4 |

**Files changed vs `origin/main` (18 files):**

| File | Finding |
|---|---|
| `src/lib/case-engine/validation.ts` | W2-H1 — ICD-11 required; DSM-5 optional when ICD-11 present |
| `src/lib/scenario-templates/validation.ts` | W2-H1 — same coding policy |
| `src/lib/case-engine/catalog.ts` | W2-H1/H3/H4 — CPTSD builtin; enriched mania/SZ packages |
| `src/lib/case-engine/persist.ts` | W2-H3/H4 — `enrichDisorderFromBuiltin()` |
| `src/lib/ai/prompt-engine.ts` | W2-H3/H4 — SYNDROME AUTHORITY |
| `src/lib/avatars/resolve.ts` | W2-H3/H4 — strip Module 2 current-state on diagnosis override |
| `src/lib/instructor-presets/types.ts` | W2-H2 — `consultant_psychiatrist` |
| `src/lib/instructor-presets/catalog.ts` | W2-H2 — builtin consultant + `mapDbRowToPreset()` |
| `src/app/api/admin/presets/preview/route.ts` | W2-H2 — stop spreading undefined builtin |
| Tests + `docs/rc3/W2_*.md` | coverage / report |

### Earlier remediation attempt

| Field | Value |
|---|---|
| **Commit SHA** | `7f43ce121701a806295cb020e1501dbff70303e0` (`7f43ce1`) |
| **Subject** | `fix(rc3): remediate Wave 2 High findings W2-H1–H4` |
| **Committed** | 2026-08-05 14:12:36 +0000 |
| **Branch** | `cursor/wave2-remediation-0594` |
| **PR** | [#112](https://github.com/alhazayed/vpsych/pull/112) — **OPEN**, `mergedAt: null`, base=`main` |
| **Note** | Shares clinical validation / phenotype / types changes with #114, but **does not** change `src/app/api/admin/presets/preview/route.ts` or add `mapDbRowToPreset` / consultant builtin catalog — incomplete for W2-H2 relative to #114. Also not on `main`. |

---

## 2. Presence on `origin/main`

| Check | Result |
|---|---|
| `origin/main` tip | `5bf66c07f11d286c305f59398a015614d22b723b` (2026-08-04) |
| `git merge-base --is-ancestor 8436208 origin/main` | **exit 1 — NOT on main** |
| `git merge-base --is-ancestor 7f43ce1 origin/main` | **exit 1 — NOT on main** |
| PR #112 / #114 merge state | both **OPEN**, `mergedAt: null` |

### Source markers on `origin/main` (pre-remediation)

| Marker | `origin/main` @ `5bf66c0` | Remediation @ `8436208` |
|---|---|---|
| `validateDsmIcd` requires DSM-5 unconditionally | **Yes** (`if (!disorder.dsm5_code)`) | No — ICD-11 first; DSM-5 only if both missing |
| `consultant_psychiatrist` in `TARGET_LEARNERS` | **Absent** | Present |
| Preview route `...findPresetBySlug(...)!` spread | **Present** (root of `undefined` learner) | Replaced by `mapDbRowToPreset` fallback |
| `SYNDROME AUTHORITY` in `prompt-engine.ts` | **Absent** | Present |
| `enrichDisorderFromBuiltin` | **Absent** | Present |
| CPTSD builtin in `catalog.ts` | **Absent** | Present |

---

## 3. Production deployment SHA

| Field | Value |
|---|---|
| **Production URL** | https://vpsych.vercel.app |
| **Vercel project** | `vpsych` · `prj_qiJ1mQvX0s5lJZ9KJnpWAx4EXjNm` |
| **Team** | `alhazayed-1540s-projects` · `team_1GRDAL9LNCLMp13s2sbE08Fh` |
| **Deployment ID** | `dpl_5F6pBTi21VrYWaxmWSRcNnCcxTA4` |
| **Ready state** | `READY` |
| **target** | **`production`** |
| **Alias** | `vpsych.vercel.app`, `vpsych-alhazayed-1540s-projects.vercel.app`, `vpsych-git-main-…` |
| **git ref** | `main` |
| **git SHA** | **`5bf66c07f11d286c305f59398a015614d22b723b`** |
| **Commit message** | `chore(db): reconcile migrations so git is canonical with production (#103)` |
| **Created** | ~2026-08-04 (matches `main` tip; predates remediation commits dated 2026-08-05) |
| **`/api/health`** | `{"ok":true,"service":"vpsych"}` (live check 2026-08-05T17:12Z) |
| **Cache** | `x-vercel-cache: MISS`, `cache-control: no-store` on health — not a stale-CDN explanation for missing app code |

### Remediation preview (not production)

| Field | Value |
|---|---|
| **Deployment ID** | `dpl_27hN4RhF4haggqu5DhZv5w9Kmwuk` |
| **git SHA** | `8436208453858b15d214b72ece061cfda8923565` |
| **git ref** | `cursor/w2-application-remediation-0594` |
| **PR** | #114 |
| **target** | **`null` (preview)** |
| **Aliases** | branch alias only — **not** `vpsych.vercel.app` |

PR #112 also has a completed preview deploy (`9WgwFhdcp6h1NVmAoMX7PMJ2XJ3t`) — likewise not production.

**Does production contain remediation commits?** **No.** Production SHA ≡ `origin/main` tip ≡ `5bf66c0`. Remediation SHAs are descendants of that tip on unmerged feature branches only.

---

## 4. STOP — production predates remediation

| Ordering | |
|---|---|
| Production / `main` | `5bf66c0` · 2026-08-04 |
| Remediation #112 | `7f43ce1` · 2026-08-05 14:12Z · **after** prod |
| Remediation #114 | `8436208` · 2026-08-05 16:57Z · **after** prod |

**Rule §4 satisfied → STOP.**

Do **not** attribute Wave 2 failure on production to:

- build-artifact corruption of remediated code  
- feature flags hiding remediations  
- stale edge cache of a remediated binary  
- production rollback *from* remediation (remediation never promoted)  
- runtime branch mismatch inside a remediated deploy  
- wrong Vercel project (prod alias is correctly project `vpsych`)  
- wrong Supabase project as the *primary* explanation for missing app-layer validation/phenotype code  

Those §5 investigations apply only when production SHA **includes** remediation.

---

## 5–6. Deferred (not applicable)

Because production does not contain the remediations, **RUNTIME DRIFT** and **FALSE REMEDIATION** are not selected.

Informational consistency check (explains observed prod symptoms without claiming runtime drift):

| Finding | Production code path still active (`5bf66c0`) | Matches live fail mode |
|---|---|---|
| **W2-H1** | `validateDsmIcd` → `Missing DSM-5 code for complex-ptsd` | Final re-cert 400 identical |
| **W2-H2** | Preview spreads `findPresetBySlug(...)!` when slug not builtin → `target_learner: undefined` | Final re-cert `Unknown target learner: undefined` |
| **W2-H3 / H4** | No SYNDROME AUTHORITY / no `enrichDisorderFromBuiltin` / thin packages | Depressive/hypersomnia phenotype on mania & SZ |

This is **expected pre-remediation behavior**, not evidence that remediations run then fail.

---

## Outcome classification

| Class | Definition | Selected? |
|---|---|---|
| **A) DEPLOYMENT DRIFT** | Production is not running the remediated code | **YES** |
| B) RUNTIME DRIFT | Production contains remediation but executes an older path | No — remediation absent from prod SHA |
| C) FALSE REMEDIATION | Fixes never actually corrected verified findings | No — not evaluable on production; remediations exist only on unmerged branches / preview deploys |

---

## Root cause (deployment)

1. Engineering remediations for W2-H1–H4 were committed on feature branches and opened as PRs **#112** and **#114**.  
2. Neither PR was merged to `main`.  
3. Vercel production continues to serve the last `main` deploy (`5bf66c0` / `dpl_5F6pBTi…`).  
4. Independent Wave 2 re-certs correctly probed `vpsych.vercel.app` and therefore reproduced the pre-remediation Highs.

**Required next action (out of scope for this verification):** merge remediation to `main`, promote to production, then re-run independent Wave 2 certification. This document does **not** unlock Wave 3, does **not** certify Wave 2, and does **not** merge or deploy.

---

## Evidence sources

- `git` ancestry vs `origin/main`  
- GitHub PR API: #112, #114 (`state=OPEN`, `mergedAt=null`)  
- Vercel MCP: `get_deployment` for `dpl_5F6pBTi21VrYWaxmWSRcNnCcxTA4` (production) and `dpl_27hN4RhF4haggqu5DhZv5w9Kmwuk` (PR #114 preview)  
- Live `GET https://vpsych.vercel.app/api/health`  
- Blob comparison: `origin/main` vs `8436208` for validation / presets / prompt / catalog markers  
- Prior independent fail evidence: `RC3-W2-FINAL-EV-20260805T1705Z` (production still at `5bf66c0`)
