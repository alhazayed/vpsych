# Research Guide — Controlled Institutional Deployment

**Audience:** Research coordinators · investigators · IRBs / ethics boards  
**Version:** `1.0.0-rc.1`

## Data governance

- VPsych simulations use **fictional** patients only.  
- Training transcripts may still contain trainee-identifiable content — treat as confidential educational records.  
- Roles: research_coordinator / platform admin for exports; therapists cannot read `session_reports`.  
- Register studies in enterprise research metadata before multi-site analysis.

## De-identification

Exports and dashboards must:

1. Exclude real patient PHI (none should exist — reject if found).  
2. Prefer hashed / opaque user IDs where protocols allow.  
3. Strip free-text that re-identifies trainees when sharing externally.  
4. Never publish admin report narratives publicly.  
5. Label all competency metrics as **unvalidated formative scores**.

## Export

- Admin research / Quality Ledger export APIs (see `API_GUIDE.md`, Stage 8/10 docs).  
- CIDP dashboards expose **counts and aggregates only** — no transcripts.  
- Keep export manifests with study IDs and date ranges.

## Validation

- Stage 8 Scientific Validation Platform is **observational**.  
- Inter-rater agreement and realism scores on CIDP dashboards are operational snapshots, not published psychometrics.  
- Do not claim criterion validity until an external study publishes coefficients.

## Metrics suitable for pilot analysis

| Metric class | Allowed | Notes |
|--------------|---------|-------|
| Session completion / abandonment counts | Yes | No narrative |
| Latency / uptime | Yes | Ops |
| Formative score distributions (admin) | Conditional | IRB + no public claim of validity |
| Supervisor agreement (aggregate) | Conditional | Educational observation |
| Raw transcripts | Restricted | Protocol + DUA |

## Longitudinal analysis

- Prefer enterprise longitudinal tracks and Quality Ledger timelines.  
- Align cohorts by institution / program / campus — not by cross-tenant joins without Board approval.  
- Document protocol amendments when changing export schemas.
