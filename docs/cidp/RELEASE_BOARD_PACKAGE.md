# Final Release Board Package — CIDP

**Package ID:** `VPSYCH-1.0-RC1-CIDP-BOARD`  
**Version:** `1.0.0-rc.1`  
**Date (UTC):** 2026-08-07  

## Decision requested

Authorize **Controlled Institutional Deployment** of VPsych `1.0.0-rc.1` for governed pilots at medical schools, residency programs, teaching hospitals, mental health centers, and research institutions.

**Not requested:** General Availability / tag `v1.0.0`.

## Board roles

| Role | Focus |
|------|-------|
| Lead Software Architect | Ownership boundaries, no cognition fork |
| Clinical Safety Officer | Fictional SP policy, score claim control |
| DevSecOps Lead | Security, DR, monitoring |
| Product Owner | Institutional package completeness |
| Release Manager | RDL, tag, deploy parity |

## Evidence index

1. `EXECUTIVE_DEPLOYMENT_REPORT.md`  
2. `INSTITUTIONAL_DEPLOYMENT_CHECKLIST.md`  
3. Role manuals: Administrator · Faculty · Resident · Research · IT  
4. `OPERATIONS_MANUAL.md`  
5. `SECURITY_REPORT.md`  
6. `DISASTER_RECOVERY_REPORT.md`  
7. `FEEDBACK_MANAGEMENT.md` + in-app feedback system  
8. `monitoring/*` dashboard & alert configuration  
9. `GA_READINESS_REPORT.md` (explicit NO-GO for GA)  
10. `PILOT_REPORT_TEMPLATE.md`  
11. Stage 12: `../RELEASE_CERTIFICATION.md`, `../PRODUCTION_READINESS.md`, `../SECURITY_AUDIT.md`  
12. `../RELEASE_DECISION_LOG.md` → RDL-029  

## Architecture affirmation

- Clinical Core ownership unchanged.  
- No new patient-state writers.  
- Education observes · Validation measures · Supervisor evaluates therapists · Enterprise manages institutions · Realtime presents.  
- CIDP adds governance, ops dashboards, and feedback only.

## Motions

1. **Motion A — Authorize CIDP** for `1.0.0-rc.1`.  
2. **Motion B — Direct RM** to tag `v1.0.0-rc.1` after merge + CI green.  
3. **Motion C — Refuse GA** until `GA_READINESS_REPORT.md` is all PASS.  
4. **Motion D — Require** pilot reports using `PILOT_REPORT_TEMPLATE.md`.  
5. **Motion E — Execute CIDP** (RDL-030): operate feedback audit trail, weekly reports, governance evidence logs; continue **GO for CIDP / NO-GO for GA**.

## Sign-off block

| Role | Name | Vote (Aye/Nay/Abstain) | Date |
|------|------|------------------------|------|
| Lead Software Architect | | | |
| Clinical Safety Officer | | | |
| DevSecOps Lead | | | |
| Product Owner | | | |
| Release Manager | | | |

**Record outcome in RDL-029 (or successor correction row).**
