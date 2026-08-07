# VPsych Cognitive Architecture

**Stage:** 4 — Unified Cognitive Brain & Runtime Orchestration  
**Status:** Phase Complete · Needs Human Review  
**Rule:** Documentation only. Reflects live runtime. Does not redesign Stages 1–3.  
**Clinical ontology:** [`../clinical/CLINICAL_DATA_MODEL.md`](../clinical/CLINICAL_DATA_MODEL.md)  
**System boundaries:** [`../SOFTWARE_ARCHITECTURE.md`](../SOFTWARE_ARCHITECTURE.md)

---

## Mission

Make every runtime subsystem behave as **one psychiatric patient mind** — not a bag of unrelated AIs.

```
One CaseInstanceSnapshot (immutable clinical truth)
        │
        ▼
One turn composition root (message route)
        │
        ├── Adaptation ★ ──┐
        ├── Memory ★       │
        ├── Emotion ★      ├── prompt / behaviour / delivery
        ├── CBE ★          │
        └── Humanization ★ ┘
        │
        ▼
One patient reply (LLM or cbe_direct) + optional voice/animation
```

★ = best-effort; must not block the hard path (user persist, assistant RPC, assessment report).

---

## Package index

| Document | Role |
|----------|------|
| [`ENGINE_CONTRACTS.md`](./ENGINE_CONTRACTS.md) | Per-engine I/O, state, failure, lifecycle |
| [`ENGINE_OWNERSHIP.md`](./ENGINE_OWNERSHIP.md) | Single ownership; conflicts catalogued |
| [`ENGINE_INTERACTIONS.md`](./ENGINE_INTERACTIONS.md) | Allowed / forbidden calls |
| [`ORCHESTRATION.md`](./ORCHESTRATION.md) | Who composes whom |
| [`RUNTIME_PIPELINE.md`](./RUNTIME_PIPELINE.md) | Canonical execution pipelines |
| [`STATE_MACHINE.md`](./STATE_MACHINE.md) | Session + turn + TRM FSM |
| [`FAILURE_RECOVERY.md`](./FAILURE_RECOVERY.md) | Retries, timeouts, partial failure |
| [`LATENCY_BUDGET.md`](./LATENCY_BUDGET.md) | Latency budgets (as implemented / target) |
| [`TOKEN_BUDGET.md`](./TOKEN_BUDGET.md) | Token / completion limits |
| [`PERFORMANCE_MODEL.md`](./PERFORMANCE_MODEL.md) | Cost, concurrency, bottlenecks |
| [`OBSERVABILITY.md`](./OBSERVABILITY.md) | Logs, headers, audit (no APM today) |
| [`RUNTIME_DEBT.md`](./RUNTIME_DEBT.md) | Runtime technical debt — never hidden |

---

## Cognitive principle (implementation)

| Principle | Live reality |
|-----------|--------------|
| One mind | Composition root is `POST /api/sessions/[id]/message` — engines do not call each other as peers |
| One clinical truth | Frozen `clinical_snapshot` (Stage 3 Case Model) |
| One trait colouring | Frozen `human_personality` Module 2b |
| Mutable mind state | Emotion + Adaptation (case_memory) + LTM (dyad table) + ephemeral CBE/Humanization |
| Delivery | Voice/CVP/NBE express affect; they do not own diagnosis |
| Education aftercare | Assessment → ACE/CGE → QL — trainee ontology, not patient mind |

---

## Composition root (canonical)

There is **no** separate `lib/session-turn` orchestrator today. The **message Route Handler** is the cognitive brain for turns. End route is the cognitive brain for session closure.

Future extractions orchestrator (debt RT-04) must preserve the documented order — not invent a new mind.

---

## Certification (Stage 4)

| Criterion | Met? |
|-----------|------|
| One runtime architecture documented | Yes |
| One orchestration model | Yes — route composition roots |
| One state machine | Yes — `STATE_MACHINE.md` |
| One execution pipeline | Yes — `RUNTIME_PIPELINE.md` |
| One ownership model | Yes — with documented conflicts |
| Engine contracts | Yes |
| Dependencies / interactions | Yes |
| Conflicts & debt documented | Yes — not fixed in this stage |

**Release status:** Phase Complete · Needs Human Review  
**Rollback:** docs-only.
