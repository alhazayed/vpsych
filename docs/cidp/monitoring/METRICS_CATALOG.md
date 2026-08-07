# CIDP Metrics Catalog

**Version:** `1.0.0-rc.1`  
**Rule:** No patient-identifiable information. Counts and formative aggregates only.

| Metric ID | Panel | Definition | Source |
|-----------|-------|------------|--------|
| uptime | system | Liveness proxy from ops health | `/api/admin/ops/cidp` |
| api_latency_p50_ms | system | Enterprise obs p50 | Stage 10 observability |
| api_latency_p95_ms | system | Enterprise obs p95 | Stage 10 observability |
| sse_p95_ms | system | Realtime avg latency proxy | Stage 11 metrics |
| voice_e2e_p95_ms | system | Budget target / measured | Ops latency budgets |
| queue_depth | system | Enterprise queue depth | Stage 10 observability |
| simulations_completed | clinical | `sessions.status=completed` count | Supabase |
| simulations_abandoned | clinical | `sessions.status=expired` count | Supabase |
| assessments_completed | clinical | Proxy: completed sessions with reports (ops may refine) | Supabase |
| supervisor_completed | clinical | Soft-fail supervisor completions | Future wiring |
| validation_completed | clinical | Soft-fail validation completions | Future wiring |
| active_residents | institution | Membership rollups | Enterprise (optional) |
| active_faculty | institution | Membership rollups | Enterprise (optional) |
| institutions | institution | `institutions` count | Supabase |
| departments | institution | `departments` count | Supabase |
| campuses | institution | `enterprise_campuses` count | Supabase |
| datasets | research | Registered research datasets | Enterprise research |
| validation_runs | research | Validation compute runs | Stage 8 |
| inter_rater_agreement | research | Observational aggregate | Stage 8 |
| realism_score_mean | research | Observational aggregate | Stage 8 |
| authentication_failures | security | Auth failure events | Audit / IdP |
| rbac_violations | security | Denied admin/tenant actions | `security_audit_events` |
| rate_limit_hits | security | 429 outcomes | Edge logs / Upstash |
| audit_events | security | Audit row count | Supabase |
| dau / wau | executive | Active users | Analytics (formative) |
| certification_rate | executive | Org certificates / eligible | Enterprise certs |
| supervisor_agreement | executive | Educational observation | Supervisor aggregates |

Machine-readable panel list: `DASHBOARD_CONFIG.json`.
