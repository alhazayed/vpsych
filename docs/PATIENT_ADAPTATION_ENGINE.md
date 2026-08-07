# Mission 8 — Patient Adaptation Engine

**Version:** `1.0.0`  
**Code:** `src/lib/adaptation/`  
**Runtime:** `POST /api/sessions/[id]/message`

## Intent

Patients react differently depending on therapist behaviour, and evolve across
treatment — not as a static persona script.

| Therapist behaviour | Patient adaptation |
|---|---|
| Warm | Rapport grows **faster** (velocity rises) |
| Judgmental | Patient **withdraws** |
| Interruptions | **Anger** rises |
| Excellent empathy | **Earlier disclosure** readiness |
| Across sessions | State **carries** — never hard-resets |

## Deliverables

| Piece | Module |
|---|---|
| Adaptation Engine | `engine.ts` — `processTherapistTurn`, `beginNextSession` |
| Rapport Model | `rapport.ts` — level + velocity |
| Trust Model | `trust.ts` — gradual trust, rupture/repair |
| Expression | `expression.ts` — Module ADAPTATION prompt block |
| Persistence | `store.ts` — `case_memory.memory.patient_adaptation` |
| Tests | `adaptation.test.ts` |

## Architecture

```
therapist utterance
        │
        ▼
 signalTherapistBehaviour()     ← bilingual heuristics (EN/AR)
        │
        ├─► updateRapport()     ← velocity accelerates under warmth
        ├─► updateTrust()       ← capped per-turn deltas
        └─► applyAdaptationEffects()
                │
                ▼
         stance + effects
         (withdrawal / anger / disclosure_readiness / engagement)
                │
                ▼
         Module ADAPTATION → resolveAvatar → patient LLM
                │
                ▼
         case_memory.patient_adaptation (best-effort)
```

Invariants:

- Adaptation is **best-effort and non-blocking**. Save failures never 500 a turn.
- Trust and rapport **never hard-reset** between turns or sessions.
- Per-turn caps: rapport ≤ ±8, trust ≤ ±6.
- The LLM **enacts** the directive; it does not invent psychology beyond it.
- Diagnosis still lives on `sessions.clinical_snapshot` (Case Engine invariant).

## Prompt injection

`PromptFidelityHints.adaptation_block` is rendered after therapy-process cues
in the patient system prompt (Module ADAPTATION).

`resolveAvatar(..., { adaptationBlock })` attaches the live turn block.

## Treatment continuity

`beginNextSession(state)` carries rapport/trust into the next session with mild
consolidation. Call when starting a returning-patient arc (same therapist /
longitudinal group). Within a single assessment, `processTherapistTurn` alone
evolves the patient turn-by-turn.

## Verification

```bash
npm test -- src/lib/adaptation/adaptation.test.ts
npm run lint && npm run typecheck && npm test && npm run build
```

## Honest scope

This ships the computational adaptation loop and regressions for the four
mission behaviours. Live psychiatrist recognition of “this patient changed
because of how I treated them” remains a human validation target (not claimed
as proven here).
