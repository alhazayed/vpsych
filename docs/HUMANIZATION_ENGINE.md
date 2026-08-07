# Humanization Engine — Mission 10

**Status:** Implemented on main (additive)  
**Code:** `src/lib/humanization/`  
**Goal:** Make trainees forget they are talking to AI — while remaining
clinically accurate for the session diagnosis and risk profile.

---

## What it is

A **Humanization Layer** that runs once per therapist turn and coordinates
four engines before the patient model speaks:

```
Therapist message
        │
   Emotion Engine ──► affect + intensity
   Behavior Engine ─► pace / cooperation / defenses
   Memory Engine ───► recall + prior-session cues
   Voice Engine ────► pause / prosody hints
        │
   Clinical gates (suppress unsafe / phenotype-wrong behaviours)
        │
   Humanization Layer (2–4 micro-behaviours)
        │
   Module 1 prompt cue + per-turn reinforcement + TTS hints
```

The organising principle matches HCE: **engines decide, the model speaks.**
State selection is deterministic (seeded RNG) so the same transcript yields
the same behaviour set — wording still varies with the LLM.

This Mission does **not** replace the deferred full HCE Conversation Director
(v1.1 #91/#96). It ships the humanization surface now and integrates cleanly
with Emotion / Voice / Memory / Behavior adapters that HCE can later absorb.

---

## Behaviours

Patients may occasionally enact (catalog in `catalog.ts`):

| Id | Example |
|----|---------|
| thinking_pause | Hold silence before first word |
| hesitation | Trail off / soft restart |
| false_start | "I— yeah, wait…" |
| self_correction | Soft-correct a mis-spoken detail |
| laughter | Brief nervous / dry laugh |
| crying | Voice fragments — never announce tears |
| breathing | Audible breath / sigh / catch |
| filler_words | One–two natural fillers |
| changing_mind | Flip mid-turn on severity |
| asking_therapist_questions | "is that weird?" |
| remembering_previous_sessions | Imperfect follow-up recall |
| emotionally_reacting | Affect before content |
| small_talk | Opening / closing only |
| humor | Dry self-deprecation — never about risk |
| fatigue | Shorter, slower answers |
| silence | Near-empty turn |
| interruptions | "No—" / "Wait—" |
| uncertainty | Approximate dates / causes |
| look_away | Gaze-down phrasing |
| forget | Lose a minor detail mid-answer |
| rephrase | Same feeling, plainer words |
| distracted | Drift then return |
| be_emotional | Affect shift mid-turn |

---

## Clinical gates

Humanity never overrides clinical accuracy. Gates (`clinical-gates.ts`)
suppress, among other rules:

- Humour / laughter / small talk during **active risk** or **safety_check**
- Crying unless affect is sad/tearful/ashamed at intensity ≥ 6
- Prior-session memory cues when no `case_memory` continuity exists
- Small talk outside opening/closing
- Low-energy behaviours (fatigue, silence, long thinking pauses) for
  pressured / manic phenotypes
- High-activation humour/interruptions for low-energy MDD phenotypes
- Affiliative behaviours after therapist invalidation

Every plan's prompt cue ends with: *never break clinical disclosure/risk
rules to perform humanity.*

---

## Integration

| Surface | Wiring |
|---------|--------|
| `POST /api/sessions/:id/message` | Builds turn plan; appends Module 1 cue + per-turn reinforcement; returns `humanization`, `voiceHints` |
| Prompt engine | Optional `fidelity.humanization_cue` slot in Module 1 |
| Voice / TTS | Stability/style overrides + `pause_before_ms` before playback |
| Conversation pipeline / VoiceSession | Passes voice hints into `playPatientSpeech` |
| Memory | Reads `case_memory.memory` (`humanization.prior_session_notes`, HCE episodic, longitudinal notes) |

### Feature flag

```bash
# Default: enabled whenever the session has a clinical_snapshot.
HUMANIZATION_ENABLED=false   # hard disable
```

---

## Client response (additive)

```json
{
  "humanizationEnabled": true,
  "humanization": {
    "behaviors": ["hesitation", "filler_words", "uncertainty"],
    "nonverbal": ["…"],
    "voiceHints": {
      "pause_before_ms": 700,
      "speech_rate": 0.82,
      "stability": 0.62,
      "style": 0.15,
      "speech_pace": "slow",
      "speech_energy": "low"
    },
    "affect": { "primary": "sad", "intensity": 5 }
  },
  "voiceHints": { "…": "same as humanization.voiceHints" }
}
```

Older clients ignore these fields safely.

---

## Testing

```bash
npm test -- src/lib/humanization/humanization.test.ts
npm run typecheck
```

See `docs/HUMANIZATION_ACCEPTANCE_REPORT.md` for the Mission 10 acceptance pack.
