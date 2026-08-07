# General Availability Decision Framework

**Binding for:** transition from CIDP (`1.0.0-rc.1`) → GA (`v1.0.0`)  
**Code:** `src/lib/ops/phase14-ga-gates.ts` · `evaluateGaReadiness()`  
**UI:** `/admin/cidp` Phase 14 panel · `GET /api/admin/ops/phase14`

## Rule

VPsych shall remain:

- **GO** — Controlled Institutional Deployment  
- **NO-GO** — General Availability  

until **every** gate below is **PASS** and the Executive Release Board appends an authorizing RDL row.

## Gates

| # | Gate ID | Requirement |
|---|---------|-------------|
| 1 | `dr_drill_completed` | Disaster Recovery drill completed and logged |
| 2 | `pitr_validated` | Point-in-Time Recovery validated |
| 3 | `production_infrastructure_verified` | Production infrastructure verified |
| 4 | `security_residuals_closed` | Security residuals closed |
| 5 | `no_unresolved_critical_findings` | No unresolved Critical findings (feedback + critical-tier risks) |
| 6 | `stable_pilot_metrics` | Stable pilot metrics over observation window |
| 7 | `acceptable_educational_outcomes` | Acceptable educational outcomes |
| 8 | `clinical_validation_completed` | Clinical validation completed (Board-defined scope) |
| 9 | `governance_package_approved` | Governance package approved |
| 10 | `executive_release_board_authorization` | Executive Release Board authorization |

## Evaluation semantics

| Status | Meaning |
|--------|---------|
| PASS | Evidence accepted |
| OPEN | Required evidence missing or failed |
| PARTIAL | Partial ops proof |
| PENDING | Awaiting pilot observation |
| NOT_YET | Board motion not taken |

`ga_status = GO` **iff** every gate is PASS.

## Explicit non-claims

Even after GA, do not claim competency scores are scientifically validated unless a separate Board unlock and evidence package say so.

## Promotion procedure

See `FINAL_V1_AUTHORIZATION_PACKAGE.md` and `../cidp/GA_READINESS_REPORT.md`.
