# Performance Report — VPsych Version 1.0 RC1 (Stage 12)

**Date:** 2026-08-07 · **Cert:** `VPSYCH-1.0-RC1-STAGE12`  
**Budgets:** `docs/runtime/LATENCY_BUDGET.md` · Stage 10/11 perf reports

## Summary

Stage 12 certifies **performance posture and methodology** for institutional production. Full 1000-concurrent-session / 100000-user drills are **ops load tests** against staging with provider quotas — not executed against production in this agent. CI enforces `npm run test:perf-smoke` so latency/timeout invariants cannot silently drift.

## Latency budgets (canonical)

| Path | p50 target | p95 target | Hard stop |
|------|------------|------------|-----------|
| Voice E2E (STT→message→TTS) | 3–6 s | ≤ 15 s | Provider timeouts |
| OpenAI chat/assessment | — | — | `OPENAI_TIMEOUT_MS` default 60s |
| ElevenLabs TTS | — | — | `ELEVENLABS_TIMEOUT_MS` default 30s (**Stage 12**) |
| Public `/api/health` | < 200 ms | < 500 ms | No upstream I/O |

## Hardening delivered in Stage 12

| Item | Effect |
|------|--------|
| ElevenLabs `AbortSignal.timeout` | Prevents hung TTS workers (RT-03) |
| Admin dashboard rate limits | Protects scientific export routes under burst |
| `X-Request-Id` | Enables latency tracing across STT/message/TTS |
| `/api/admin/ops/metrics` | In-app ops snapshot (env, enterprise, realtime) |

## Stress / scale methodology (staging)

| Scenario | Method | Pass criteria |
|----------|--------|---------------|
| API load | k6/Artillery on `/api/health`, authed message path | Error rate < 1%; p95 within budget |
| 1000 concurrent sessions | Staged ramp; Upstash required | No cascade 429 storms; DB CPU < alert |
| 100000 users (registered) | DB volume test + RLS plan analysis | Session list queries indexed; no seq scans on hot paths |
| Realtime / SSE | Burst `/message/stream` with flag on staging only | Soft-fail; classic path unaffected when flag off |
| Memory / CPU | Vercel metrics + Node inspector on staging | No unbounded prompt growth incidents (RT-05 residual) |

## Snapshot evidence (historical + local)

| Source | Result |
|--------|--------|
| Mission Omega health | ~90 ms |
| Stage 8/9/10/11 unit perf reports | PASS (component-level) |
| Stage 12 `test:perf-smoke` | Markers for budgets + TTS timeout |
| Vitest suite | Includes ops + ElevenLabs timeout tests |

## Residuals

| ID | Item |
|----|------|
| PERF-S12-01 | Execute signed staging load drill at 1000 sessions before unconstrained GA marketing |
| PERF-S12-02 | Multi-instance enterprise/realtime stores (ENT-08, RT-S11-02) |
| RT-05 | Unbounded prompt token growth — monitor |

## Verdict

**Performance Complete for RC** — budgets enforced in code/docs/CI; mega-scale drill remains an ops gate for GA marketing claims, not an architecture redesign.
