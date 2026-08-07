# Avatar Architecture — Stage 11

**Code:** `src/lib/realtime/avatar-controller.ts` + `src/lib/nbe/*`  
**Principle:** Avatar animation is presentation. Emotion/NBE own behaviour intent; avatar never writes ClinicalCore.

## Layers

```
Emotion / Humanization / CBE cues (read-only)
        ↓
NBE Behavior Engine → Timeline → Animation Scheduler
        ↓
Realtime Avatar Controller (facial, gaze, breath, lip sync)
        ↓
PatientPresence / CSS hooks / viseme classes
```

## Avatar Controller capabilities

| Capability | Implementation |
|------------|----------------|
| Facial expressions | Emotion-hint → expression enum |
| Eye movement / contact | Nonverbal eyeContact + avoidance |
| Blinking | Timed pseudo-random blink window |
| Breathing | Continuous phase oscillator |
| Idle behaviour | `idleIntensity` when not speaking |
| Head movement | Yaw/pitch/roll from gaze + breath |
| Gestures | fidget / self_soothe / open_hand / withdraw |
| Speaking animation | `speakingIntensity` |
| Lip synchronization | `visemeOpen` + `visemeClass()` |
| Emotion-driven animation | Expression map from emotion hints |
| Behavior synchronization | Consumes `NonverbalPresentation` |

## Nonverbal presentation channels

Eye contact, hesitation, pauses, thinking delay, avoidance, body orientation, speech rate/volume/rhythm, emotional congruence — via `buildNonverbalPresentation()` (often from Humanization `voiceHints`).

## What avatar must not do

- Mutate `clinical_snapshot` / ClinicalCore  
- Invent diagnosis or MSE  
- Replace NBE ownership of sustained behaviour plans  
- Bypass Patient Agent for spoken content  
