# Mission 21 — Patient Mind Engine (PME)

**Branch:** `cursor/mission-21-pme-0594`  
**PME:** `1.0.0` · **PMFI:** `1.0.0` · **Prompt:** `4.0.0`

## Architectural shift

The LLM is **expression only**.

The Patient Mind Engine owns:

personality · diagnosis · symptom dynamics · emotion · alliance · resistance ·
disclosure readiness · motivation · cognitive style · defenses · interpersonal
style · therapeutic progress · longitudinal memory · life events

## Modules

| # | Module | Code |
|---|---|---|
| 1 | Relationship memory | `pme/relationship.ts` |
| 2 | Disclosure engine (continuous) | `pme/disclosure.ts` |
| 3 | Defense mechanisms | `pme/defenses.ts` |
| 4 | Emotional state machine | `pme/emotion.ts` |
| 5 | Session arc | `pme/session-arc.ts` |
| 6–7 | Longitudinal + life events | `pme/longitudinal.ts` |
| 8 | Clinical behaviour dynamics | `pme/clinical-dynamics.ts` |
| 9 | Therapist effect model | `pme/therapist-effect.ts` |
| 10 | Internal state + expression | `pme/types.ts`, `expression.ts`, `engine.ts` |

Persistence: `case_memory.memory.patient_mind` (jsonb) via `pme/store.ts`.  
Runtime: `POST /api/sessions/[id]/message` loads → `processTherapistTurn` → saves → injects expression block into prompt Module PME.

## PMFI

Tracks alongside CFI / AVI / ERI / ALE / RRS / VQI / HCFI:

psychological consistency · relationship continuity · behavior realism ·
defense realism · disclosure realism · therapy realism · session continuity ·
emotional continuity · longitudinal realism · patient authenticity

Admin: `GET/POST /api/admin/pmfi`

## Mission 22 preparation

`POST /api/admin/pmfi` accepts transcripts + disorder for blind-study scoring.
Mind summaries expose phase, trust, alliance, defenses, disclosure readiness
for psychiatrist / resident / medical-student authenticity protocols.

## Honest benchmark status

Success criterion: *“I stopped thinking I was talking to an AI and started
thinking about how to help this patient.”*

**Not yet claimed.** PME establishes the computational patient; live
psychiatrist blind studies (Mission 22) are required to validate the benchmark.

## Verification

```
npm run lint && npm run typecheck && npm test && npm run build
```
