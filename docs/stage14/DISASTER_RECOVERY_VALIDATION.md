# Disaster Recovery Validation

**Procedures:** `../DISASTER_RECOVERY.md` · `../cidp/DISASTER_RECOVERY_REPORT.md`  
**Evidence log:** `../cidp/evidence/dr/DR_EVIDENCE_LOG.md`

## Required exercises

Backups · Restore testing · Point-in-Time Recovery · Database recovery · Infrastructure recovery · Secrets recovery · Application recovery

## Evidence row fields

Date · Reviewer · Institution (or `platform`) · Result · Evidence pointers · Corrective actions

## GA linkage

| Gate | Requires |
|------|----------|
| `dr_drill_completed` | ≥1 successful drill row |
| `pitr_validated` | ≥1 successful PITR row |

Empty DR log ⇒ GA **NO-GO**.
