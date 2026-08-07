# Operations Monitoring

## Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Public liveness + version |
| `GET /api/admin/ops/metrics` | Env + enterprise/realtime snapshot |
| `GET /api/admin/ops/dashboards` | Platform / institution / research / education / supervisor / realtime / security / performance / audit |
| `GET /api/admin/ops/validation` | GA operational validation suite |
| `GET /api/admin/feedback` | Feedback ledger |

## Telemetry (`src/lib/ops/telemetry.ts`)

Collects API/LLM/voice/realtime/avatar/DB latency, session start/end/drop, reconnects, errors, queue depth, tenant utilization. In-process ring buffer — configure Vercel Analytics / log drains / Sentry for multi-instance production APM.

## Alerts (recommended ops)

- `/api/health` failing  
- Error rate > 5%  
- TTS timeout spike (`TTS_TIMEOUT`)  
- Critical feedback > 0 open  
- Migration parity drift
