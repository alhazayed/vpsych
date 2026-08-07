# Conversation Behaviour Engine (CBE) — Mission 7

## Objective

Patients in training sessions must **not immediately answer everything**. CBE
is a turn-level planner that selects advanced interpersonal behaviours and
injects enactable directives into the patient reply path. The model speaks;
the engine decides *how* the patient engages.

```
Therapist message
  → classify move + sensitive topic
  → estimate rapport (history + difficulty)
  → disclosure gate (withhold | deflect | partial | open)
  → select primary (+ secondary) behaviours
  → Turn brief → merged into per-turn reinforcement
  → generatePatientReplyDetailed (or cbe_direct silence stall)
```

## Behaviours (Mission 7)

| Kind | Intent |
|------|--------|
| `avoidance` | Circle the hard part; logistics / “I don’t know where to start” |
| `denial` | Soft-reject clinical framing without debating |
| `minimization` | Underplay intensity and frequency |
| `guardedness` | Short answers; watch the therapist |
| `lying` | Protective soft-lie / false-compliance — **never** invent hospitals, records, or real people |
| `embarrassment` | Shame in speech; sideways first |
| `crying` | Voice breaks / brief tearfulness — not a sob performance |
| `anger` | Irritability when judged, rushed, or lectured |
| `topic_switching` | Steer to safer adjacent content |
| `silence` | Pause / ellipsis / one-word stall; optional `cbe_direct` short-circuit |
| `therapist_interruption` | React to barge-in: restart, shorten, flatten, or lose the thread |
| `rapport_disclosure` | Standing rule: disclosure follows earned rapport |

## Architecture

| Module | Path | Role |
|--------|------|------|
| Types | `src/lib/conversation-behaviour/types.ts` | Contracts |
| Catalogue | `catalog.ts` | Enactable directives per kind |
| Therapist move | `therapist-move.ts` | Move + sensitive-topic classifiers |
| Rapport | `rapport.ts` | 0–100 rapport + disclosure gate |
| Engine | `engine.ts` | Seeded selection + prompt formatting |
| Barrel | `index.ts` | Public API |

**Determinism:** selection uses `createRng(sessionId:cbe:turnIndex:…)` (same
mulberry32 helper as the Case Engine). Same transcript → same behaviour plan.

**No new tables.** Rapport and gates are derived each turn from message history
+ `sessions.clinical_snapshot.difficulty_modifiers`. Full HCE / PME persistence
remains deferred (`[v1.1]` / experimental PRs).

## Integration

`POST /api/sessions/[id]/message`:

1. Auth → rate limit → validate body (optional `therapistInterrupted`).
2. Resolve avatar + load history.
3. If `CBE_ENABLED` is not `false`, `planConversationBehaviour(…)`.
4. On plan failure → log and continue (best-effort; never block the reply).
5. If `directReply` (silence / interruption stall) → persist as assistant with
   `aiSource: "cbe_direct"`.
6. Else → `generatePatientReplyDetailed({ behaviourReinforcement: promptBlock })`.

Additive response fields (not clinical ground truth for the trainee UI):

- `cbeEnabled`, `cbePrimary`, `cbeDisclosureGate`, `cbeRapport`
- Header `X-CBE-Primary` when present

## Feature flag

| Env | Effect |
|-----|--------|
| unset / anything else | **On** (default) |
| `CBE_ENABLED=false` (or `0` / `off` / `no`) | Skip planning; classic reinforcement only |

## Relationship to other systems

| System | Relationship |
|--------|----------------|
| Case Engine therapy-process cues | Module 1 static process; CBE is **per-turn** |
| HCE (#91/#96) | Broader orchestration + persistence — deferred; CBE is the shippable slice |
| PME (#122) | Mind-state owner when merged; CBE remains a behaviour selector until then |
| Therapy Room barge-in | Client may pass `therapistInterrupted: true` on the next message |

## Tests

`src/lib/conversation-behaviour/conversation-behaviour.test.ts`

- Catalogue completeness (12 kinds)
- Move / topic classification
- Rapport warming + gated disclosure
- Deterministic plans
- Interruption primary
- Substance → denial/minimization/lying bias
- Prompt forbids instant full answers
- Feature flag

## Invariants

1. **Engines decide, model speaks** — except intentional `cbe_direct` stalls.
2. **Never announce behaviour labels** to the patient voice — directives only.
3. **Lying is protective distortion**, not fabricated clinical infrastructure.
4. **Best-effort** — CBE errors never prevent a session reply.
5. Reinforcement / CBE blocks are **not stored** on `session_messages`.

## Rollback

1. Set `CBE_ENABLED=false` and redeploy — message route skips planning.
2. Or revert the Mission 7 commit; no migration to roll back.
