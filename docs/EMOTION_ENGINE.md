# VPsych Emotion Engine (Mission 2) v1.0

## Objective

Every AI standardized patient possesses a **continuously evolving emotional
state**. Therapist interventions modify dimensional affect; **trust gates
future responsiveness**; derived expression drives voice, facial animation,
word choice, hesitation, and body language.

```
Therapist turn
  → classify intervention (or accept explicit label)
    → apply trust-gated deltas with disorder inertia
      → decay toward baseline + fatigue creep
        → update mode (engaged / guarded / withdrawn / …)
          → derive Expression packet
            → persist in case_memory.memory.emotion
            → inject prompt block + return to client
```

## Emotional variables (0–100)

| Variable | Role |
|----------|------|
| `baseline_mood` | Slow temperament prior from disorder (immutable per tick) |
| `current_mood` | Moment-to-moment mood (decays toward baseline) |
| `stress` | Acute load |
| `fear` | Threat / anxiety activation |
| `anger` | Irritability / hostility |
| `hope` | Forward-looking affect |
| `trust` | Sticky; gates how much positive interventions land |
| `rapport` | Sticky alliance warmth |
| `fatigue` | Session drain + disorder prior |
| `motivation` | Readiness to engage / change |

## Interventions → deltas (examples)

| Intervention | Effect |
|--------------|--------|
| **Validation** | trust↑ anger↓ stress↓ hope↑ rapport↑ |
| **Empathy** | hope↑ trust↑ fear↓ rapport↑ |
| **Hostility** | trust↓ rapport↓ anger↑ stress↑ hope↓ motivation↓ → **withdrawal** |
| Invalidation | alliance rupture |
| Rupture repair | trust↑ anger↓ (when sustained) |
| Advice (premature) | motivation↓ trust↓ |
| Confrontation | anger↑ stress↑ (trust cost if premature) |

Trust gating: when trust is low, positive gains to trust / rapport / hope /
mood / motivation are attenuated (35–100% scale). Hostile deltas always apply
at full strength.

## Modes

`engaged` · `guarded` · `withdrawn` · `activated` · `collapsed` · `warming`

Withdrawal sticks after repeated hostility or trust≤25 with anger≥55.
Warming requires a sustained alliance streak with adequate trust/rapport.

## Expression layer

`deriveExpression(state)` produces a deterministic packet:

| Channel | Driven by |
|---------|-----------|
| **Voice** | rate / volume / pitch / pause_scale + ElevenLabs stability/style |
| **Facial animation** | discrete `facial_affect` + `animation_hooks` |
| **Word choice** | prompt directives (short answers, hedges, hopeful phrasing, …) |
| **Hesitation** | `hesitation_ms` before first spoken token |
| **Body language** | nonverbal cue ids (`look_away`, `cross_arms`, `fidget`, …) |
| **Openness** | trust×rapport×(1−fear) — gates disclosure richness |

The LLM **expresses** this state; it must not invent contradictory affect.

## TypeScript module

`src/lib/emotion/`

| File | Role |
|------|------|
| `types.ts` | Contracts + version |
| `baselines.ts` | Disorder → initial variables + inertia |
| `interventions.ts` | Intervention → deltas + trust gating |
| `classify.ts` | Heuristic utterance → intervention |
| `state-machine.ts` | init / tick / decay / mode |
| `expression.ts` | Emotion → voice / face / words / body |
| `store.ts` | `case_memory.memory.emotion` persistence |
| `engine.ts` | Session-turn façade |
| `index.ts` | Public barrel |

## APIs

| Endpoint | Purpose |
|----------|---------|
| `GET /api/sessions/[id]/emotion` | Current state + expression (inits if missing) |
| `POST /api/sessions/[id]/emotion` | Tick / simulate / reset |

### POST body

```json
{
  "message": "That makes sense — anyone would feel that way.",
  "intervention": "validation",
  "secondary": ["empathy"],
  "simulate": false,
  "reset": false
}
```

- `simulate: true` — dry-run; no persist
- `reset: true` — re-seed from disorder baseline
- If `intervention` omitted, `message` is classified heuristically

### Session message integration

`POST /api/sessions/[id]/message` runs the Emotion Engine **best-effort**
before patient reply generation:

1. Tick + persist emotion (soft-fail on missing `case_instance_id` / DB)
2. Append `expressionPromptBlock` to the system prompt
3. Return additive `emotion` packet (mode, variables, expression, applied)

Failures never block the reply path or report generation.

## Persistence

Sidecar only — **no new migration**:

```
case_memory.memory.emotion  → EmotionState jsonb
```

Uses existing `case_memory` RLS (session ownership via case instance).
Writer prefers service role via `messageRpcClient` (same pattern as message RPCs).

## Compatibility

| Path | Status |
|------|--------|
| Existing sessions / reports | Unchanged |
| Case Engine snapshots | Read `primary_diagnosis.slug` for baselines |
| Therapy Room / PME bridges | Expression cue ids are compatible |
| HCE (deferred v1.1) | Can consume this engine as the affect spine |
| ACE / CGE | Independent; no import cycle |

## Invariants

1. **Baseline mood is not mutated by interventions** — only current mood moves.
2. **Trust is sticky** — slow mean-reversion; hostility still cuts hard.
3. **Trust changes future responses** — openness + gated intervention gains.
4. **No RNG in expression** — identical state → identical packet.
5. **Locale never changes emotion priors** — diagnosis/disorder slug only.
6. Soft-fail: missing tables / case memory must not 500 the message route.

## Tests

```
src/lib/emotion/emotion.test.ts
```

Covers baselines, intervention deltas (validation / empathy / hostility),
classifier, trust gating, withdrawal mode, expression channels, parse round-trip.

```bash
npm test -- src/lib/emotion/emotion.test.ts
```

## Rollback

1. Remove additive `emotion` field usage from clients (optional).
2. Revert message-route emotion block — replies work without it.
3. Clear sidecar keys if desired: `memory = memory - 'emotion'`.
4. Delete `src/lib/emotion/` + `/api/sessions/[id]/emotion`.

No schema drop required.

## Honest limitations

- Intervention classification is **heuristic keyword** rules, not a clinical
  NLP model. Explicit `intervention` on the Emotion API is authoritative.
- Scores are **not validated** psychometric instruments.
- Full HCE Conversation Director / streaming prosody remains v1.1 deferred;
  this engine supplies the continuous affect substrate those layers need.
