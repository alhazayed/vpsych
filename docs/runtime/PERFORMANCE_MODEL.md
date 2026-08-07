# Performance Model

---

## Runtime cost model (qualitative)

| Path | DB | LLM | TTS/STT | Notes |
|------|----|-----|---------|-------|
| Create session | High (case mint) | None | None | |
| Text turn | Medium | **Dominant** | None | Soft engines CPU+DB |
| Voice turn | Medium | Dominant | STT+TTS | |
| End session | Medium–High | Assessment LLM | None | ACE/QL extra |
| Admin scientific | Variable | Rare | None | Offline corpora possible |

---

## Concurrency model

| Layer | Behaviour |
|-------|-----------|
| Hosting | Vercel serverless — scale-out per request |
| Rate limits | Per-user hourly; Upstash shared or memory local |
| Session turn lock | **None** server-side beyond RPC turn-order |
| case_memory | No row lock / transactional merge |
| OpenAI | Provider-side RPM; app failover on 429 |
| In-memory rate limit | **Not** safe across multiple instances |

---

## Streaming model

| Stream | Present |
|--------|---------|
| LLM token stream to UI | No |
| TTS audio/mpeg body | Yes |
| Supabase Realtime | No |
| SSE progress events | No |

UI waits for full JSON reply then plays audio.

---

## Memory (process)

| Item | Notes |
|------|-------|
| OpenAI client singleton | Per isolate |
| ElevenLabs response cache | Process memory |
| VQI pending queue | Process memory — lost on freeze |
| Rate-limit Map | Process memory fallback |
| NBE scheduler | Client only |

---

## Architectural bottlenecks

1. Serial turn pipeline (LLM bound).  
2. Double history fetch (post-insert select).  
3. End-path sequential assess→ACE→LTM→report→QL.  
4. Dual case_memory writers (correctness under concurrency).  
5. God-route size — maintenance cost, not CPU.  
6. Missing server TTS timeout.  
7. Unbounded prompt growth (LTM + modules).

---

## Scalability posture

| Dimension | Posture |
|-----------|---------|
| Horizontal API | Good with Upstash; weak without |
| DB | RLS + indexes; session_messages growth ops concern |
| LLM | External ceiling — failover helps availability not throughput |
| Voice | ElevenLabs quota separate from chat |

---

## Performance rules (governance)

- Do not bypass soft-fail to “go faster.”  
- Do not parallelize Emotion/Adaptation writes without OWN-01 fix.  
- Do not add streaming without architecture update to this model.  
- Measure before optimizing LLM temperature/caps.
