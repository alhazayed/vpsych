# Security Evidence Log — CIDP

Append one row per deployment / material change.

| Timestamp (UTC) | Deploy / event | SHA | Checks | Notes |
|-----------------|----------------|-----|--------|-------|
| 2026-08-07 | CIDP package PR #178 | `919f51c` | CI green | Initial CIDP feedback + dashboards |
| 2026-08-07 | CIDP execution (owner/audit/weekly) | (this PR commit) | lint/typecheck/test/migrations/build | Additive feedback ops columns; weekly reports |

## Continuous verification checklist (per deploy)

- [ ] Unauthenticated sensitive APIs → 401 JSON  
- [ ] Admin routes require `requireApiAdmin`  
- [ ] Feedback + CIDP routes rate-limited  
- [ ] `npm run audit:deps` PASS  
- [ ] No secrets in git  
- [ ] RLS policies present on `institutional_feedback`  
- [ ] Open Critical feedback owned within SLA  

## Residuals (GA blockers)

SEC-S12-01 HIBP · SEC-S12-02 Upstash confirm · SEC-S12-03 Sentry · feedback free-text residual re-ID risk.
