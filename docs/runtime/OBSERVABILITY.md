# Observability

**Live posture:** structured `console.*` logs + HTTP provenance headers + security audit RPC.  
**Absent:** OpenTelemetry, Sentry, Prometheus, Datadog (search of `src/` empty for product APM).

---

## Logs

| Area | Events (examples) |
|------|-------------------|
| message route | emotion/CBE/humanization soft-fail; cbe_direct; assistant reply provenance |
| patient-agent | provider failover, errors |
| end route | ACE/LTM/QL warnings; assessment |
| adaptation/emotion stores | persist warnings |
| rate-limit | Upstash missing in production |
| voice | TTS/STT failures |

**Format:** ad hoc `console.info/warn/error` objects — not a unified schema.

---

## Response headers (telemetry to clients)

| Header | Path | Meaning |
|--------|------|---------|
| `X-AI-Source` | message/end | gpt \| gateway \| persona_fallback \| cbe_direct |
| `X-AI-Model` | message/end | Model id when present |
| `X-AI-Error-Kind` | message/end | Prior failure kind |
| `X-CBE-Primary` | message | Primary behaviour kind |
| `X-Humanization` | message | Enabled / behaviours signal |
| `X-Quality-Ledger-Id` | end | Sealed ledger id |
| `X-Voice-*` | TTS | Voice resolution / modulation |

Clients **must** treat `X-AI-Source` / body `aiSource` as truth for whether the reply was model-backed.

---

## Security audit

- `logSecurityEvent` → `log_security_event` RPC.  
- Used on admin auth denials and some admin voice changes.  
- Best-effort; never fails the request.  
- Not emitted on every successful patient turn.

---

## Clinical telemetry

| Signal | Where |
|--------|-------|
| Emotion mode / variables | message JSON `emotion` |
| CBE plan fields | message JSON + headers |
| Humanization behaviours / voiceHints | message JSON |
| Immersion metrics | sessions.immersion_metrics (TRM) |
| Adaptation | Not fully returned as first-class client packet (block in prompt) |

---

## Performance / cost telemetry

| Need | Status |
|------|--------|
| Latency histograms per stage | Missing |
| Token usage per turn | Missing (not parsed from provider usage into metrics store) |
| $ cost per session | Missing |
| TTS duration | Missing |
| Trace IDs across STT→message→TTS | Missing |

---

## Tracing story (actual)

One HTTP request = one informal “span” via logs. Client voice turn = three HTTP requests without a shared correlation id (unless client adds one — not standard today).

---

## Observability rules

1. Never log raw secrets, full transcripts to third-party APM without review.  
2. Never omit `aiSource` on patient replies.  
3. Soft-fail must `console.warn` with sessionId.  
4. Adding Sentry/OTel is allowed only with CSP/`security-headers` updates + this doc revision.
