# Operational Metrics Report

**Collectors:** `src/lib/ops/telemetry.ts` · dashboards `buildGaDashboards()`  
**Simulations:** 100-session and 1000-session in-process loads (CI/validation)

## Simulation snapshot (methodology)

| Scenario | Starts | Completion rate | Notes |
|----------|-------:|----------------:|-------|
| 100 sessions | 100 | ~0.975 | Intentional drop/reconnect every 40th |
| 1000 sessions | 1000 | ~0.975 | Same model; not live provider load |

## Live production

Wire host APM (Vercel metrics, optional Sentry) for memory/CPU/network. In-app buffers are single-instance unless replicated via log drain.

## Dashboards

Platform · Deployment · Institution · Research · Education · Supervisor · Realtime · Security · Performance · Audit — `GET /api/admin/ops/dashboards`.
