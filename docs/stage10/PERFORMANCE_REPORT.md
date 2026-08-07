# Stage 10 — Performance Report

## Envelope

| Metric | Target | Test |
|--------|-------:|------|
| Organizations | 100 | Isolation loop &lt; 2s |
| Users | 10,000 | RBAC checks &lt; 2s |
| Concurrent sessions (design) | 1,000 | Engine 200-run smoke &lt; 3s |

## Notes

Enterprise bridge is pure CPU + optional membership reads; soft-fail path adds negligible latency when tables missing. Large research exports remain Stage 8 validation-owned; Stage 10 provides study manifests only.
