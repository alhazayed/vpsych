# RC3 Wave 2 — Release Promotion (Deployment Drift Resolution)

**Evidence ID:** `RC3-W2-PROMO-EV-20260805T1720Z`  
**Date (UTC):** 2026-08-05  
**Authority:** Executive Board — RDL-017 · Deployment Drift confirmed · Engineering COMPLETE  
**Role:** Release Manager (no new application code)  
**Constraints:** No Wave 2 certification · No Wave 3 · No clinical logic changes

---

## Decision gate (pre-merge)

```
A) READY TO MERGE
Canonical PR: #114 (https://github.com/alhazayed/vpsych/pull/114)
Expected production SHA: merge commit of 8436208 onto main
```

**PR #112 is not the merge path** (incomplete for W2-H2; overlaps #114).

---

## Execution (completed)

| Step | Result |
|---|---|
| Mark #114 ready for review | Done (was draft → blocked merge) |
| Merge #114 → `main` | **MERGED** `2026-08-05T17:17:53Z` |
| Merge commit | `5aae13806c984cb19a9c2e920d14014b548d4400` |
| Remediation commit on main | `8436208453858b15d214b72ece061cfda8923565` is ancestor of `origin/main` |
| CI on merge | **SUCCESS** — run `31029363109` |
| Vercel production deploy | `dpl_8Q7YGEHKesAWt3yNzcJ87cEYYYH2` · `target=production` · `READY` |
| Production alias | `https://vpsych.vercel.app` → deploy above |
| Production SHA | **`5aae13806c984cb19a9c2e920d14014b548d4400`** |
| Contains remediation `8436208`? | **YES** |
| Production health | **PASS** `{"ok":true,"service":"vpsych"}` |
| Production smoke | **PASS 8/8** (not Wave 2 certification) |

Deployment drift **resolved** for the RDL-016 application remediation.

---

## 1. PR review

| | PR [#112](https://github.com/alhazayed/vpsych/pull/112) | PR [#114](https://github.com/alhazayed/vpsych/pull/114) |
|---|---|---|
| Title | Wave 2 remediation — W2-H1–H4 clinical Highs | Wave 2 application remediation W2-H1–H4 (**RDL-016**) |
| Head | `7f43ce1` · `cursor/wave2-remediation-0594` | `8436208` · `cursor/w2-application-remediation-0594` |
| Base | `main` | `main` |
| Mergeable (pre-merge) | MERGEABLE / CLEAN | MERGEABLE / CLEAN |
| CI verify | SUCCESS | SUCCESS |
| Vercel preview | SUCCESS | SUCCESS |
| Reviews | none | none |
| State now | OPEN (superseded — do not merge) | **MERGED** |

### Canonical selection

**Merge exactly one: #114.**

Reasons:

1. Explicit RDL-016 application remediation; single clean commit on `5bf66c0`.
2. Complete W2-H2 fix: `mapDbRowToPreset` + preview route no longer spreads undefined builtin + consultant builtin catalog.
3. PR #112 **does not** change `src/app/api/admin/presets/preview/route.ts` or `instructor-presets/catalog.ts` — insufficient for the verified `Unknown target learner: undefined` defect.
4. PR #112 also bundles Wave 1 cert docs + migration noise unrelated to this promotion.
5. Overlapping phenotype/validation work must not be double-merged.

---

## 2. Promotion chain (verified)

```
origin/main @ 5bf66c0
        ↓
merge #114 → 5aae138 (parents: 5bf66c0, 8436208)
        ↓
Vercel production dpl_8Q7YGEHKesAWt3yNzcJ87cEYYYH2
        ↓
Production SHA 5aae138 (alias vpsych.vercel.app)
        ↓
/api/health ok
```

---

## 3. Production smoke (not certification)

Evidence: `/tmp/w2-promo-smoke.json` (session artifact)

| Check | Result |
|---|---|
| `/api/health` | PASS |
| Therapist password-grant | PASS |
| Admin password-grant | PASS |
| Avatars query (Supabase user JWT) | PASS |
| `POST /api/sessions` PTSD beginner | PASS (200) |
| `POST /api/sessions` CPTSD beginner (deploy presence) | PASS (200; no Missing DSM-5) |
| `GET /api/health/openai` (admin) | PASS |
| `POST /api/admin/presets/preview` consultant slug (deploy presence) | PASS (200) |

**Smoke: PASS.**  
Deploy-presence probes confirm remediated paths are live. They are **not** Wave 2 clinical certification.

---

## 4. Explicit non-actions

- No application logic changes in this promotion.
- PR #112 **not** merged.
- Wave 2 **not** re-certified here.
- Wave 3 remains **LOCKED**.
- Board may dispatch independent Wave 2 re-cert against production `@ 5aae138` separately.

---

## Summary

| Item | Value |
|---|---|
| Gate | **A) READY TO MERGE** (executed) |
| Canonical PR | **#114** |
| Remediation SHA | `8436208453858b15d214b72ece061cfda8923565` |
| Production SHA | `5aae13806c984cb19a9c2e920d14014b548d4400` |
| Production deploy | `dpl_8Q7YGEHKesAWt3yNzcJ87cEYYYH2` |
| Drift | **RESOLVED** |
