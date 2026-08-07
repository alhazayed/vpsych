# General Availability Readiness Report

**Product:** VPsych  
**Current version:** `1.0.0-rc.1`  
**Report ID:** `VPSYCH-GA-READINESS`  
**Date (UTC):** 2026-08-07  

> **Do NOT declare General Availability until every criterion below is PASS.**  
> CIDP authorization ≠ GA authorization.

## Success criteria matrix

| # | Criterion | Status at CIDP packaging | Evidence required |
|---|-----------|--------------------------|-------------------|
| 1 | Disaster Recovery drill successfully completed and documented | **OPEN** | Signed `DISASTER_RECOVERY_REPORT.md` evidence pack |
| 2 | Backup and PITR verified | **OPEN** | Staging PITR drill record |
| 3 | Production infrastructure validated (cache, queues, external services) | **PARTIAL** | Upstash confirmed; provider smokes; CDN rules |
| 4 | Security audit: no unresolved Critical or High findings | **PASS (app)** / ops residuals | `SECURITY_REPORT.md` + close SEC-S12-* |
| 5 | Institutional pilot: zero unresolved Critical clinical or operational issues | **PENDING pilot** | `PILOT_REPORT_TEMPLATE.md` |
| 6 | Platform stability across agreed pilot observation period | **PENDING pilot** | CIDP metrics + incident log |
| 7 | Governance documentation finalized and approved | **PASS (CIDP pack)** | This package + Board sign-off |
| 8 | Clinical, educational, validation, research workflows verified in production | **PARTIAL** | Credential Gate production smokes |
| 9 | Release Board formally authorizes `v1.0.0` | **NOT YET** | Future RDL row |

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
| `GET /api/admin/ops/cidp/weekly` | Weekly executive / clinical / security packs |
| `evidence/dr/DR_EVIDENCE_LOG.md` | Drill rows (empty → GA blocked) |
| `evidence/security/SECURITY_EVIDENCE_LOG.md` | Per-deploy security evidence |
| `evidence/governance/GOVERNANCE_ATTESTATIONS.md` | Domain attestations |

## Current recommendation

**Remain on Controlled Institutional Deployment (`1.0.0-rc.1`).**  
**GO for CIDP.**  
**NO-GO for GA** until criteria 1–9 are satisfied.
