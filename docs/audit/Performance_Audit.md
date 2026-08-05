# Performance Audit — Section I (PEI)

**Audit:** VEA-2026-08-05 · Production SHA `5aae138` · Observational only

## Live latency samples (this audit)

| Endpoint | Observations |
|---|---|
| `GET /api/health` | ~0.81s, 0.11s, 0.12s (cold then warm) |
| `GET /` | ~0.12–0.14s warm; earlier cold ~1.85s |
| Full voice turn (STT→GPT→TTS) | Not re-timed this audit; prior functional cert ~interactive; session end assessment-dominated (~13s wall historically) |

## Architecture performance evidence

| Area | Evidence | Limitation |
|---|---|---|
| DB indexes / RLS initplan | Migrations `20260731110213_*`, `20260803044719_*` | Not load-tested at declared scale |
| API caching | `/api/*` `no-store` | Correct for PHI-ish transcripts; no CDN API cache |
| TTS cache | In-memory LRU in ElevenLabs service | Per-instance |
| Rate limits | Memory fallback not shared | Scaling risk |
| Session cap | `MAX_SESSION_SECONDS` 40 min | Server-enforced |
| Availability | Health 200 during audit window | No multi-region SLO report |

---

## Dimension scores

| Dimension | Score |
|---|---:|
| Latency (web/API health) | 82 |
| Scalability | 68 |
| Caching | 70 |
| Database efficiency | 78 |
| API speed | 76 |
| Voice latency | 70 |
| Memory usage | 65 (not profiled live) |
| Error rate | 75 (no prod error budget telemetry reviewed) |
| Availability | 80 (point-in-time healthy) |

---

## Performance Excellence Index (PEI)

**PEI = 78 / 100**

Adequate for limited expert preview. Insufficient evidence for high-concurrency institutional exam days.

---

## Findings

| ID | Sev | Finding | Root cause | Impact | Priority |
|---|---|---|---|---|---|
| PF-H1 | High | No published load test at cohort scale | Tooling/ops gap | Exam-day risk | P1 |
| PF-M1 | Medium | Assessment end-path dominates wall time | LLM examiner on end | UX cliff at session complete | P2 |
| PF-M2 | Medium | TTS client buffers full audio before play | Streaming incomplete E2E | Perceived latency | P2 |
| PF-L1 | Low | In-memory TTS cache ephemeral | Serverless | Repeat cost/latency | P3 |

---

## Recommendations

| Rec | Impact | Priority |
|---|---|---|
| Load test: 40 concurrent sessions, voice on | Capacity truth | P1 |
| Publish p50/p95 for message + TTS | Ops SLO | P1 |
| Stream-to-play path for TTS | Perceived speed | P2 |
