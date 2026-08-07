# Observability — Stage 10 (Enterprise)

**Code:** `src/lib/enterprise/observability.ts`  
**Related runtime debt:** `docs/runtime/OBSERVABILITY.md` (APM still deferred)

## Snapshot fields

- health: ok | degraded | down  
- API latency p50 / p95  
- failure rate  
- active sessions  
- queue depth  
- estimated hourly cost  
- scaling hint  

## Performance envelope (design + tested)

| Target | Value |
|--------|------:|
| Organizations | 100 |
| Users | 10,000 |
| Concurrent sessions | 1,000 |

Isolation over 100 orgs × 20 rows and 10k RBAC checks complete under 2s in unit tests.

## Surfaces

Admin enterprise panel + `/api/admin/enterprise` observability block.  
Session end emits `X-Enterprise-Org-Id` breadcrumb when tenant known.
