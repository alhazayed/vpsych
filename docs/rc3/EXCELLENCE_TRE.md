# Excellence Program 1 — Therapy Response Engine (TRE)

**Branch:** `cursor/excellence-tre-0594`  
**TRE:** `1.0.0` · **TRI:** `1.0.0` · **Prompt:** `4.1.0`

## Mission

Build an evidence-informed AI psychiatric patient that changes realistically
over time in response to therapy.

| Layer | Owns |
|---|---|
| **Patient Mind Engine (PME)** | WHO the patient is (personality, emotion, defenses, disclosure, alliance) |
| **Therapy Response Engine (TRE)** | HOW the patient changes across sessions (symptoms, cognition, regulation, insight, functioning, trust, hope, relapse risk) |
| **LLM** | Expression only — never invents contradictory state |

## Modalities

Supportive · CBT · DBT · Motivational Interviewing · ACT · Psychodynamic ·
Family Psychoeducation · Crisis Intervention

(`family_therapy` / `MI` normalize into the TRE modality set.)

## Response drivers

Outcomes depend on:

therapist competence · therapeutic alliance · homework/engagement ·
life events · diagnosis tempo · personality/attachment · resilience ·
medication adherence

Therapy influences:

symptoms · cognition · emotion regulation · insight · functioning ·
disclosure openness · trust · hope · relapse risk · engagement

## Therapy Response Index (TRI)

10 weighted dimensions (sum = 1.0):

symptom trajectory · cognitive change · emotion regulation · insight growth ·
functional gain · alliance/trust · disclosure evolution · hope/engagement ·
relapse realism · modality fit

Admin: `GET/POST /api/admin/tri`  
Registered in VQI metric registry as `TRI`.  
Validation dashboard exposes `indices.TRI`.

## Runtime wiring

1. `processTherapistTurn` ensures `mind.treatment` and appends **Module TRE**
   to the expression block.
2. `beginNextSession` skips coarse alliance→symptom deltas, generates life
   events, then `applyTherapyResponseToMind` (competence from prior turn cues).
3. Treatment state persists inside `case_memory.memory.patient_mind.treatment`.

## Regression gate

`src/lib/tre/tre.test.ts` simulates high- and low-competence courses for
**every active builtin disorder**. Assertions:

- per-session symptom deltas capped (≤10) — no overnight cures/collapses
- high competence does not produce miracle remissions in 6 sessions
- low competence does not falsely label trajectories as `improving`
- TRI is computable with overall ≥ 50 on competent courses

## Success criterion (design target)

> An experienced psychiatrist should recognize believable therapeutic progress
> across multiple sessions.

**Honest status:** Engineering + TRI + per-disorder regressions are shipped.
Psychiatrist recognition remains a **human validation target** (PAS / blinded
review) — not claimed as achieved by this PR alone.

## Limits

- Educational simulation priors, not RCT effect sizes.
- Delirium/medical packages prioritize stabilization over psychotherapy dose.
- TRI scores structural believability of trajectories; they are **not** a
  published psychometric validation of clinical outcomes.
