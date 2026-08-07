# Controlled Institutional Deployment Package (CIDP)

**Certification ID:** `VPSYCH-1.0-RC1-CIDP`  
**Product version:** `1.0.0-rc.1`  
**Baseline:** Stage 12 Production Release Certification (`VPSYCH-1.0-RC1-STAGE12`)  
**Date (UTC):** 2026-08-07  
**Audience:** Medical schools · psychiatry residency programs · teaching hospitals · mental health centers · research institutions

> This is **not** General Availability and **not** a public beta.  
> This is a **governed institutional deployment** under published limitations.

## Ownership invariants (binding)

| Layer | Owns | Must not |
|-------|------|----------|
| Clinical Core | Cognition / patient state | Be forked or rewritten by CIDP |
| Education | Observation of learning | Write clinical_snapshot |
| Validation | Measurement | Assign diagnoses |
| Supervisor | Therapist evaluation | Change patient mind |
| Enterprise | Institutions / RBAC / feedback / dashboards | Duplicate patient state |
| Realtime | Presentation | Mutate ClinicalCore |
| Ops / CIDP | Deployment, monitoring, DR, pilot governance | Add cognition |

## Package index

| Artifact | Path |
|----------|------|
| Executive deployment report | `EXECUTIVE_DEPLOYMENT_REPORT.md` |
| Institutional deployment checklist | `INSTITUTIONAL_DEPLOYMENT_CHECKLIST.md` |
| Operations manual | `OPERATIONS_MANUAL.md` |
| Administrator guide | `ADMINISTRATOR_GUIDE.md` |
| Faculty guide | `FACULTY_GUIDE.md` |
| Resident guide | `RESIDENT_GUIDE.md` |
| Research guide | `RESEARCH_GUIDE.md` |
| IT operations guide | `IT_OPERATIONS_GUIDE.md` |
| Security report | `SECURITY_REPORT.md` |
| Disaster Recovery report | `DISASTER_RECOVERY_REPORT.md` |
| Pilot report template | `PILOT_REPORT_TEMPLATE.md` |
| GA readiness report | `GA_READINESS_REPORT.md` |
| Final Release Board package | `RELEASE_BOARD_PACKAGE.md` |
| Feedback management | `FEEDBACK_MANAGEMENT.md` |
| Dashboard / monitoring config | `monitoring/` |
| Stage 12 prerequisites | `../RELEASE_CERTIFICATION.md`, `../DEPLOYMENT_GUIDE.md`, `../DISASTER_RECOVERY.md` |

## In-app surfaces

| Surface | Auth | Purpose |
|---------|------|---------|
| `/feedback` | Authenticated | Structured institutional feedback |
| `/admin/feedback` | Admin | Triage queue |
| `/admin/cidp` | Admin | CIDP operational dashboards |
| `GET /api/admin/ops/cidp` | Admin | Dashboard JSON |
| `GET /api/admin/ops/metrics` | Admin | Stage 12 ops snapshot |

## Related decisions

Append-only log: `../RELEASE_DECISION_LOG.md` (RDL-028 Stage 12 RC; RDL-029 CIDP).
