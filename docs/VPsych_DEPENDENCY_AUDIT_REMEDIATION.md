# VPsych — Dependency Audit Remediation (nanoid)

**Date:** 2026-08-09  
**Branch:** `cursor/admin-ux-phase2-b432`  
**PR:** https://github.com/alhazayed/vpsych/pull/190 (Phase 2 Admin UX; user referenced “#316” — that PR number is not present in this repository)  
**Advisory:** [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) — `nanoid < 3.3.17` HIGH  

---

## 1. Root cause

CI `verify` → `npm run audit:deps` (`npm audit --omit=dev --audit-level=high`) failed because the production dependency tree resolved **`nanoid@3.3.16`** via the existing root **`overrides.postcss: ^8.5.25`** pin, which installed **`postcss@8.5.25`** (`dependencies.nanoid: ^3.3.16`).

This was **not introduced by Phase 2 Admin UX code**. The same `postcss` override exists on `main`. The advisory / registry floor moved: `postcss@8.5.26` requires `nanoid: ^3.3.17`.

## 2. Vulnerable dependency

| Field | Value |
|---|---|
| Package | `nanoid` |
| Installed (before) | `3.3.16` |
| Vulnerable range | `< 3.3.17` |
| Severity (npm) | HIGH |
| Advisory | GHSA-2v37-7h3g-55p8 — custom generators can loop indefinitely when `size` is zero |
| Patched minimum | `3.3.17` (registry also has `3.3.18`) |

## 3. Dependency path

**Before:**

```text
vpsych
└─ overrides.postcss ^8.5.25 → postcss@8.5.25
   └─ nanoid@3.3.16

Consumers of overridden postcss:
- next@16.2.12 (production) — was postcss 8.4.31
- @tailwindcss/postcss (dev)
- vite / vitest (dev)
```

`nanoid` is **transitive only** (not a direct dependency in `package.json`).

## 4. Production / runtime exposure

- Appears under `npm audit --omit=dev` because **Next.js** depends on `postcss`, forced through the root override.
- PostCSS usage of nanoid (build-time CSS input ids): `require('nanoid/non-secure')` then `nanoid(6)` — fixed non-zero size, **not** customAlphabet / customRandom with `size === 0`.
- VPsych application source has **zero** imports of `nanoid` / `customAlphabet` / `customRandom`.
- Vulnerable generator loop is **not reachable** from VPsych app code or from observed PostCSS call sites.

## 5. Nanoid usage in VPsych

| Search | Result |
|---|---|
| `from 'nanoid'` / `require('nanoid')` | **None** in repo TS/JS |
| `customAlphabet` / `customRandom` / `customGenerator` | **None** |
| `nanoid(` in app code | **None** |
| Transitive use | PostCSS build tooling only (`nanoid(6)`) |

## 6. Exact remediation

**Chosen approach (preferred order #2):** upgrade the existing parent override to the patched PostCSS release.

```diff
  "overrides": {
-   "postcss": "^8.5.25",
+   "postcss": "^8.5.26",
    "sharp": "^0.35.0"
  }
```

Then `npm install` to refresh the lockfile.

**Not used:** `npm audit fix --force`, new direct `nanoid` dependency, CI audit weakening, Phase 2 UX changes.

**Why not lockfile-only?** A lockfile-only bump of `nanoid` under `postcss@8.5.25` would work today (`^3.3.16` allows 3.3.17+), but bumping PostCSS to `8.5.26` raises the declared floor to `^3.3.17` and matches upstream’s advisory fix.

## 7. Files changed

| File | Change |
|---|---|
| `package.json` | `overrides.postcss`: `^8.5.25` → `^8.5.26` |
| `package-lock.json` | `postcss` 8.5.25 → 8.5.26; `nanoid` 3.3.16 → 3.3.18; lockfile root version sync `0.1.0` → `1.0.0-rc.1` (matches `package.json`); optional darwin `fsevents@2.3.3` metadata entry |
| `docs/VPsych_DEPENDENCY_AUDIT_REMEDIATION.md` | This report |

No application source, workflow, or Admin UX files modified.

## 8. Lockfile changes

| Package | Before | After |
|---|---|---|
| `nanoid` | 3.3.16 | **3.3.18** |
| `postcss` | 8.5.25 | **8.5.26** |
| `fsevents` (optional, darwin, dev) | absent in lock | 2.3.3 (npm install metadata; not Linux/prod runtime) |

No unrelated production package upgrades (Next, React, AI SDKs, etc. unchanged).

## 9. Compatibility assessment

| Check | Result |
|---|---|
| Stay on nanoid major 3 | Yes (`3.3.18`) — no major jump to nanoid 4/5 |
| PostCSS major 8 | Yes (`8.5.26` patch) |
| Node engines (`nanoid`) | `^10 \|\| ^12 \|\| ^13.7 \|\| ^14 \|\| >=15` — fine for CI Node 22 |
| Next 16.2.12 | Continues to consume overridden PostCSS 8.x |
| ESM/CJS | PostCSS still uses `nanoid/non-secure` CJS require — unchanged pattern |
| Peer deps | No new peer conflicts observed |

## 10. Security assessment

| Classification | **P1 — production dependency vulnerability requiring remediation** |
|---|---|
| Why not P0 | Vulnerable custom-generator zero-size path is not invoked by VPsych or by PostCSS’s `nanoid(6)` usage; not an active exploit vector in product runtime |
| Why not P2/P3 alone | Package is present in the **production** tree (`next` → overridden `postcss` → `nanoid`); CI correctly gates on `--omit=dev --audit-level=high` |
| After fix | `npm audit --omit=dev --audit-level=high` → **0 vulnerabilities** |

## 11. Test results

| Check | Result |
|---|---|
| `npm run audit:deps` | **PASS** (0 vulnerabilities) |
| `npm run lint` | **PASS** (0 errors; 13 pre-existing warnings) |
| `npm run typecheck` | **PASS** |
| `npm test` | **PASS** (82 files / 660 tests) |
| `npm run test:migrations` | **PASS** (local structure; remote skipped — no `SUPABASE_DB_URL`) |
| `npm run test:perf-smoke` | **PASS** |
| `npm run build` | **PASS** |

## 12. CI result

Workflow `.github/workflows/ci.yml` unchanged:

- Still runs `npm run audit:deps` before lint/typecheck/test/migrations/perf/build  
- Still uses `--omit=dev --audit-level=high`  
- Audit step **not** removed or weakened  

Local reproduction of the full verify sequence: **PASS**. GitHub Actions status on the PR should turn green after push (not weakened).

## 13. Remaining vulnerabilities

None reported by `npm audit --omit=dev --audit-level=high` after remediation.

---

## Resolved path (exact)

```text
overrides.postcss ^8.5.26 → postcss@8.5.26 → nanoid@3.3.18
```

## Phase 2 regression

Build includes `/admin`, `/admin/avatars`, `/admin/avatars/[id]`, `/admin/avatars/new`, `/admin/diagnostics`. Components `AdvancedDetails`, `StatusBadge`, `AdminPageHeader`, `ClinicalPreviewSummary`, `VirtualPatientLibrary`, `VirtualPatientDetail` unchanged by this remediation. Completeness unit tests still pass.

**STOP:** No Phase 3 Virtual Patient create implementation in this change.
