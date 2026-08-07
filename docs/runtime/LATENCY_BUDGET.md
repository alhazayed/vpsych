# Latency Budget

Budgets below mix **implemented limits** with **architectural targets**. Where no code enforces a budget, it is marked Target only.

---

## Hard limits (implemented)

| Resource | Limit | Source |
|----------|-------|--------|
| Session duration | 40 minutes | `MAX_SESSION_SECONDS` |
| Message body | 4000 chars | message route |
| OpenAI request timeout | 60s default | `OPENAI_TIMEOUT_MS` |
| Rate: messages | 120 / user / h | rate-limit |
| Rate: STT | 120 / user / h | |
| Rate: TTS | 60 / user / h | |
| Rate: start | 30 / user / h | |
| Rate: end | 20 / user / h | |

---

## Turn latency budget (target)

End-to-end therapist → patient audio (voice mode):

| Stage | Target p50 | Target p95 | Notes |
|-------|------------|------------|-------|
| STT | 500ms | 2s | OpenAI Whisper path |
| Soft engines + resolve | 50–150ms | 400ms | CPU + DB loads |
| Adaptation/Emotion persist | overlap | — | Emotion awaited; Adaptation void |
| LLM completion | 1.5–4s | 12s | Dominates; 60s hard timeout |
| Assistant persist | 50–150ms | 500ms | RPC |
| TTS TTFB | 300ms–1s | 3s | ElevenLabs; no server timeout |
| **E2E voice turn** | **3–6s** | **15s** | Soft target — not enforced |

Text-only skips STT/TTS (~1–5s typical).

---

## Bottlenecks (actual)

1. **LLM generation** — largest latency & cost.  
2. **Serial soft engines** — Emotion awaited before CBE/Humanization/LLM.  
3. **History reload** after user insert — extra DB round trip.  
4. **ElevenLabs** without AbortSignal/timeout — can hang until platform limit.  
5. **End path** — assess LLM + ACE + LTM + report + QL sequential.

---

## Concurrency vs latency

- No parallel Emotion ∥ CBE ∥ Humanization today (could race ownership).  
- `void` adaptation save reduces await but risks OWN-01 race.  
- Client `void playPatientSpeech` returns message UI before audio ends.

---

## Measurement gap

No APM histograms in-repo. Latency budgets are architectural guidance until Observability stage adds metrics (see `OBSERVABILITY.md`, `RUNTIME_DEBT.md`).
