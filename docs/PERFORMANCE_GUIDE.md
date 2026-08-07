# Performance Guide — Stage 11 Realtime

## Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Interaction latency (VAD / barge-in / local avatar) | **&lt;250ms** where supported | Enforced as soft target via latency controller |
| E2E voice turn p50 | 3–6s | LLM-dominated; see `LATENCY_BUDGET.md` |
| E2E voice turn p95 | ≤15s | Soft |
| Hands-free silence commit | 700–1000ms (default 850) | Therapy Room + Realtime silence detector |
| Mic reopen after playback | ≤300ms | Hands-free budget |

## Streaming throughout

- SSE progressive reveal for partial UI  
- Audio buffer manager with drop-on-overflow  
- Quality adaptation shrinks TTS chunks / max tokens on poor RTT  
- Speaker pipeline interrupt clears queue immediately  

## Minimal dropped audio

- High-water backpressure pauses producers  
- Overrun drops oldest chunks first  
- Underrun counted for observability  

## Scalability

| Layer | Strategy |
|-------|----------|
| Edge / app | Stateless Route Handlers on Vercel |
| Rate limits | Per-user budgets (`msg`, `msg-stream`, `stt`, `tts`) |
| Media | No server-side long-lived media sockets in v1; HTTPS streaming |
| Metrics | In-memory façade (multi-instance → Upstash/APM later) |
| Cognition | Unchanged soft-engine composition; no duplicated LLM calls on stream adapter beyond classic turn |

## Measurement

`createLatencyController` + `realtimeMetrics` record PHI-free stage samples. Admin: `GET /api/admin/realtime`.
