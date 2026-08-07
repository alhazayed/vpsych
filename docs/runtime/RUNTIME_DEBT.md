# Runtime Technical Debt

**Stage 4 inventory.** Problems are listed — **not fixed** in this stage.  
Cross-links: Stage 2 ARCH-S2-*, Stage 3 CLIN-S3-*, `../TECHNICAL_DEBT.md`.

---

## Critical / High

| ID | Issue | Impact | Suggested remediation |
|----|-------|--------|------------------------|
| RT-01 | Dual `case_memory` writers + Adaptation `void` save | Lost emotion/adaptation updates under concurrency | Atomic JSONB patch / single writer queue |
| RT-02 | No server-side turn lock | Multi-tab races; duplicate user turns | Conditional request / lease or stricter RPC |
| RT-03 | ElevenLabs fetch without timeout/AbortSignal | Hung TTS invocations | Timeout + propagate client abort |
| RT-04 | God-route orchestration | Hard to test/extend safely | Extract `lib/session-turn` preserving order |
| RT-05 | Unbounded prompt growth (LTM + modules) | Context overflow / cost spikes | Token budget guard before LLM |
| RT-06 | `therapistInterrupted` unused by clients | Dead API; barge-in doesn’t inform CBE | Wire TRM pipeline body field |

---

## Medium

| ID | Issue | Impact | Suggested remediation |
|----|-------|--------|------------------------|
| RT-07 | Emotion ∥ Adaptation trust/rapport overlap | Divergent “feel” cues | Ownership contract + tests |
| RT-08 | Serial soft engines | Extra latency | Parallelize reads only after RT-01 |
| RT-09 | Double history fetch on message | Extra DB RTT | Return insert + use local concat |
| RT-10 | In-memory rate limit multi-instance | Weak abuse control | Require Upstash in prod |
| RT-11 | VQI queue non-durable | Lost recalcs on freeze | Durable outbox or sync compute |
| RT-12 | No APM / trace correlation | Blind p95 | OTel + client correlation id |
| RT-13 | End path all sequential | Slow session close | Soft aftercare async **only if** idempotent |
| RT-14 | GENERATE 502 after user insert | Orphan user turns | Client UX + optional repair tool |
| RT-15 | Stage 2 mermaid Humanization order wrong | Doc drift | Fixed in `RUNTIME_PIPELINE.md` |

---

## Low

| ID | Issue | Notes |
|----|-------|-------|
| RT-16 | No LLM streaming | Product choice; document if changed |
| RT-17 | Gateway 220 vs OpenAI 512 token asymmetry | Align caps intentionally |
| RT-18 | Classic VoiceSession lacks TRM FSM | Flag-gated OK |
| RT-19 | Security audit not on turn success | Optional enrich |
| RT-20 | hasAzureSpeech residue | Stage 2 debt |

---

## Race conditions (explicit)

1. Adaptation upsert vs Emotion update on same `case_memory` row.  
2. Concurrent message POSTs from two tabs.  
3. Client TTS abort vs server still streaming.  
4. End idempotency vs in-flight assess (mitigated by `session_has_report` after status update — assess skipped if report exists).

---

## Circular dependencies (runtime-relevant)

| Cycle | Mitigation today |
|-------|------------------|
| ACE ↔ CGE | Barrel excludes ace-bridge + architecture test |
| scientific ↔ metrics ↔ case | Offline corpora; avoid hot path |
| Case ↔ templates ↔ presets | Generation-time only |

---

## Hidden coupling

- Prompt concatenation order = cognitive coherence.  
- Header contracts for clients.  
- Humanization raw `case_memory` read.  
- Assessment vs patient-agent different history windows.

---

## Unsafe / fragile mutations

| Mutation | Risk |
|----------|------|
| Full jsonb upsert of `case_memory` | Clobber sibling keys |
| Snapshot client patch | Blocked by trigger — good |
| In-process VQI queue | Silent loss |

---

## Bottlenecks

See `PERFORMANCE_MODEL.md` — LLM dominant; serial end path; TTS hang risk.

---

## Governance

When fixing any RT-* item: update this file, `ENGINE_OWNERSHIP` if ownership changes, and architecture tests. Do not “fix” by disabling soft engines or skipping validation.
