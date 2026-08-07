# Executive Leadership Brief — CIDP

**Version:** `1.0.0-rc.1` · **Status:** GO for CIDP · **NO-GO for GA**

## Executive summary

VPsych is in Controlled Institutional Deployment for selected medical schools, residencies, teaching hospitals, mental health centers, and research collaborators. Architecture Stages 1–12 remain canonical. Clinical Core cognition is unchanged.

## Deployment strategy

1. Onboard institutions via `INSTITUTIONAL_DEPLOYMENT_CHECKLIST.md`.  
2. Operate feedback + CIDP dashboards continuously.  
3. Collect weekly executive / clinical / security reports.  
4. Hold GA until `GA_READINESS_REPORT.md` is all PASS.

## Risk register (executive)

| ID | Risk | Severity | Mitigation |
|----|------|----------|------------|
| E-01 | Score misuse as credential | High | Faculty/resident guides; published limitations |
| E-02 | DR drill incomplete | Medium | Blocks GA only |
| E-03 | PHI in feedback text | High | Heuristics + triage reject |
| E-04 | Provider outage | Medium | Persona fallback; text-only mode |
| E-05 | Multi-instance store limits | Medium | Upstash; ENT-08 backlog |

## Success metrics

Tracked via `GET /api/admin/ops/cidp` → `success_metrics` and weekly executive report:

Deployment success · availability · p95 latency · simulation completion · resident/faculty satisfaction (survey) · supervisor agreement · assessment/validation consistency (observational) · operational stability · research utilization.

## Governance model

Release Board · Clinical Safety · DevSecOps · Product · Release Manager. Evidence under `evidence/governance/`. Decisions append to `../RELEASE_DECISION_LOG.md`.
