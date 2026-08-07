# General Availability Readiness Report

**Product:** VPsych  
**Current version:** `1.0.0-rc.1`  
**Report ID:** `VPSYCH-GA-READINESS`  
**Date (UTC):** 2026-08-07  

> **Do NOT declare General Availability until every criterion below is PASS.**  
> CIDP authorization ≠ GA authorization.

## Success criteria matrix

Aligned with Phase 14 ten-gate framework (`../stage14/GA_DECISION_FRAMEWORK.md` · `evaluateGaReadiness()`).

| # | Criterion | Gate ID | Status at Phase 14 packaging | Evidence required |
|---|-----------|---------|------------------------------|-------------------|
| 1 | Disaster Recovery drill successfully completed and documented | `dr_drill_completed` | **OPEN** | Signed `evidence/dr/DR_EVIDENCE_LOG.md` |
| 2 | Backup and PITR verified | `pitr_validated` | **OPEN** | Staging PITR drill record |
| 3 | Production infrastructure validated (cache, queues, external services) | `production_infrastructure_verified` | **PARTIAL** | Upstash confirmed; provider smokes; CDN rules |
| 4 | Security residuals closed (no unresolved Critical/High ops findings) | `security_residuals_closed` | **PARTIAL** | `SECURITY_REPORT.md` + `evidence/security/` |
| 5 | No unresolved Critical findings (feedback + critical-tier risks) | `no_unresolved_critical_findings` | **PENDING / OPEN** | Feedback queue + `evidence/risk/RISK_REGISTER.md` |
| 6 | Stable pilot metrics | `stable_pilot_metrics` | **PENDING pilot** | CIDP success metrics + trends |
| 7 | Acceptable educational outcomes | `acceptable_educational_outcomes` | **PENDING pilot** | `evidence/education/` |
| 8 | Clinical validation completed (Board-defined scope) | `clinical_validation_completed` | **PENDING** | `evidence/clinical/` · Stage 8 observational |
| 9 | Governance package approved | `governance_package_approved` | **PASS (CIDP/P14 pack)** | Governance attestations + Board sign-off |
| 10 | Release Board formally authorizes `v1.0.0` | `executive_release_board_authorization` | **NOT YET** | Future RDL row |

## Explicit non-claims until GA

- Competency scores are scientifically validated.  
- Public consumer launch readiness.  
- Unlimited multi-tenant mega-scale without ENT-08/RT-S11-02 remediations.

## Promotion procedure (when all PASS)

1. Close open residuals or accept Board-recorded waivers (waivers cannot cover unresolved Critical clinical issues).  
2. Append RDL authorizing `v1.0.0`.  
3. Tag `v1.0.0`; GitHub Release from `CHANGELOG.md`.  
4. Update `package.json` version to `1.0.0`.  
5. Communicate GA scope and limitations to institutions.

## Continuous tracking (CIDP execution)

| Source | What it shows |
|--------|----------------|
| `GET /api/admin/ops/cidp` | `ga_status: NO-GO`, `cidp_status: GO`, success metrics |
| `GET /api/admin/ops/phase14` | Ten-gate evaluation · risk · lessons · evidence domains |
| `GET /api/admin/ops/cidp/weekly` | Weekly executive / clinical / security / research / educational / operations packs |
| `evidence/dr/DR_EVIDENCE_LOG.md` | Drill rows (empty → GA blocked) |
| `evidence/security/SECURITY_EVIDENCE_LOG.md` | Per-deploy security evidence |
| `evidence/governance/GOVERNANCE_ATTESTATIONS.md` | Domain attestations |
| `evidence/risk/RISK_REGISTER.md` | Living risk register |
| `../stage14/` | Phase 14 program package |

## Current recommendation

**Remain on Controlled Institutional Deployment (`1.0.0-rc.1`).**  
**GO for CIDP.**  
**NO-GO for GA** until criteria 1–9 are satisfied.
