# Phase 7 — Release Merge Conflict + Failure Handling Protocol

**Governing principle:** Preserve verified Phase 1–6 behavior unless a conflict resolution is demonstrably required by the target branch. Never resolve a conflict merely to make Git or CI green.

Applies to: merge conflicts, PR conflicts, CI/build/test failures, deployment failures, production smoke failures, security regressions, cron failures.

---

## 1. General rule

```text
STOP → CLASSIFY → INSPECT EVIDENCE → RESOLVE ONLY THE ACTUAL CONFLICT
  → TEST → REVERIFY → CONTINUE
```

Never: failure → broad rewrite → unrelated cleanup → force merge.

---

## 2. Conflict classification

| Class | Examples | Policy |
|-------|----------|--------|
| **A Mechanical** | import order, formatting, adjacent non-overlap, translation key order, generated metadata | May auto-resolve if behavior unchanged |
| **B Functional** | AdminPageHeader forks, session filters, learner queries, analytics, navigation | STOP; inspect; verify behavior |
| **C Security** | `requireAdmin`, middleware, RLS, cron auth, service-role, ID-based authz | HIGH RISK — STOP; do not auto-pick a side |
| **D Tenancy** | `institution_id`, memberships, historical NULL | HIGH RISK — never invent ownership |
| **E Lifecycle** | ACTIVE/COMPLETED/EXPIRED, `/end`, passive expiry, reports | HIGH RISK — do not change semantics |

Only **A** may be resolved automatically. For **B–E**: STOP · DO NOT MERGE · DO NOT DEPLOY.

---

## 3. Security conflicts

Default: **STOP**.

Required evidence before continuing:

```text
anonymous → admin denied
therapist → admin denied
admin → admin allowed
cron: no/wrong secret → rejected; correct → allowed
```

Never: remove auth checks, client-only authz, public-ize APIs, trust browser tenant IDs, expose service role.

---

## 4. Tenancy conflicts

```text
new session → server stamps institution; browser never trusted for authz
historical NULL institution_id → remains NULL unless approved migration
```

Never: fabricate memberships, infer history from current membership, backfill the 603 NULL rows, invent institution-admin.

---

## 5. Lifecycle conflicts

Preserve exactly:

```text
ACTIVE
├── /end before limit → COMPLETED + assessment
├── /end at/after limit → EXPIRED + assessment
└── passive expiry → EXPIRED + no report
```

Boundary: `started_at + max_duration_sec`. No heartbeat. No passive-expiry reports. Do not weaken CAS/idempotency to resolve a merge.

Required regressions: before / exactly at / after limit; passive expiry; completed+cron; expired+cron; cron twice.

---

## 6. Translation / navigation

- EN/AR key parity for Phase 1–6 strings; no silent Arabic deletion or EN substitution; verify RTL after resolution.
- Core routes must remain reachable: `/admin`, `/admin/learners`, `/admin/learners/[id]`, `/admin/sessions`, `/admin/sessions/[id]`, `/admin/reports`, `/admin/analytics`, `/admin/content`, `/admin/enterprise`, `/admin/research`, `/admin/diagnostics`. Do not invent or drop routes to “fix” nav conflicts.

---

## 7. Test / CI / build failures

| Type | Meaning | Action |
|------|---------|--------|
| 1 Existing | Fails on target main before and after | Document; do not blame release |
| 2 Merge regression | Passed before, fails after | STOP; root-cause; fix; rerun |
| 3 Environment | Missing env, infra, provider | Do not change app behavior; retry |
| 4 Flaky | Only with repeated-run evidence | Never label flaky for convenience |

Gate: **new deterministic failures = 0**. Typecheck: no new `any` / `@ts-ignore` / unsafe casts. Build fail → STOP DEPLOYMENT. CI `verify` fail → DO NOT MERGE FURTHER / DO NOT DEPLOY.

---

## 8. PR conflict / failed merge

Do not resolve only in the GitHub UI. Inspect merge-base, files, ours/theirs/base. Prefer updating the release branch from current target. No shared-history rewrite unless required. After resolution: local tests + typecheck + build, then CI.

Failed merge: never immediate `--force` / `--ours` / `--theirs`. If conflicted and uncertain → `git merge --abort`. No half-resolved trees.

---

## 9. Deployment / smoke / security / data / cron

- Deploy fail: classify build vs env vs infra; fix env without weakening auth/lifecycle.
- Smoke fail after deploy: DO NOT declare verified; rollback or promote known-good if regression.
- Security regression (therapist→admin, wrong cron secret succeeds, cross-object access, service-role to client): STOP · ROLL BACK IF DEPLOYED · fix · re-run security + CI · redeploy.
- Unexpected data mutation (esp. 603 NULL sessions, statuses, reports, memberships): stop; no corrective SQL until cause understood.
- Cron: distinguish endpoint / auth / scheduler / DB / app. Fix scheduler without weakening auth. Expiry bugs → STOP automated production expiry until verified.

---

## 10. Rollback

Use when: security regression, unauthorized access, destructive mutation, broken auth, lifecycle corruption, widespread failure. Roll back to **last known-good production deployment**. Then fix forward via PR/CI.

---

## 11. No “quick fix”

Do not: disable RLS, bypass `requireAdmin`, expose service role, remove failing tests, skip CI, disable typecheck, fabricate memberships, backfill historical tenancy, alter lifecycle, enable retention, add roles, make cron unauthenticated, hard-code credentials.

---

## 12. Incident record

Every release-blocking failure → append `docs/PHASE7_RELEASE_INCIDENTS.md` with: Timestamp, Commit, Branch, PR, Environment, Failure class, Affected component, Observed/Expected, Root cause, Resolution, Tests, Security/Data/Deployment impact, Final status. No secrets.

---

## 13. Final release gate

```text
merge conflicts resolved
new test failures = 0
typecheck PASS · build PASS · GitHub CI GREEN
security regression = 0
production smoke PASS · EN · AR/RTL · mobile PASS
cron authentication PASS · controlled expiry PASS · idempotency PASS
historical NULL sessions unchanged
retention purge disabled
```

If any release-critical item is unresolved: **RELEASE = BLOCKED**.

---

## 14. Status report format

```text
STATUS: CLEAR / BLOCKED / ROLLBACK / RESOLVED
FAILURE CLASS: Mechanical / Functional / Security / Tenancy / Lifecycle /
               Test / CI / Build / Deployment / Runtime / Cron
AFFECTED: …
ROOT CAUSE: …
ACTION: …
VERIFICATION: …
REMAINING RISK: …
NEXT STEP: …
```

Never describe a release as safe/ready/green unless the corresponding verification was performed.
