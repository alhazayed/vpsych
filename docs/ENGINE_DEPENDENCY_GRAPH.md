# Engine Dependency Graph (certified)

```
Personality Engine (traits, Module 2b)
        │
        ▼
Adaptation Engine (therapist influence → rapport/trust/withdrawal)
        │
        ▼
Patient Memory (durable longitudinal facts → prompt inject)
        │
        ▼
Emotion Engine (affect state machine → expression block)
        │
        ▼
Conversation Behaviour Engine (avoidance/silence/disclosure gate)
        │
        ▼
LLM Prompt Assembly (resolveAvatar + fidelity + extras)
        │
        ▼
Humanization Layer (PRESENTATION ONLY: hesitations/pauses/fillers/cadence)
        │
        ├──────────────► Clinical Voice (identity + emotion modulation TTS)
        │
        └──────────────► NBE / Avatar Animation (nonverbal from emotion)
                │
                ▼
        Final Patient Response (text + voice + animation + client hints)
```

## Ownership matrix

| Engine | Owns | Must not |
|--------|------|----------|
| Personality | Big Five / attachment / speech style traits | Diagnosis, affect state |
| Adaptation | Rapport/trust velocity, judgment/interrupt reactions | Durable biography |
| Patient Memory | Longitudinal facts, retrieve/compress | Invented memories |
| Emotion | Affect variables, modes, expression | Personality traits |
| CBE | Behavioural choices, silence, disclosure gates | Vocal identity |
| Prompt Assembly | Template composition | Clinical decisions |
| Humanization | Delivery micro-behaviours only | Memory/emotion/adaptation/personality |
| Clinical Voice | Speaker identity, prosody | Animation state |
| NBE | Nonverbal animation | Text content |

## Cross-engine imports (non-test)

Verified: **zero** direct imports between the eight engine packages.
Composition occurs only at the message route / resolveAvatar / TTS surfaces.
