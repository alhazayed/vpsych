# Clinical Voice Profiles (CVP) — Mission 3

## Objective

Every standardized patient owns a **unique clinical voice profile**. The
ElevenLabs `voice_id` stays fixed; clinical delivery parameters (rate, pitch,
energy, prosody, breathing, hesitations, speaker boost, pronunciation) change
**live** with affect.

```
Avatar → voice_profiles (registry + clinical params)
  → Clinical Voice Profile Manager
    → liveSwitchVoice(emotion)
      → ElevenLabs voice_settings / browser modulation
```

## Emotion modulation

| Emotion | Delivery |
|---------|----------|
| Depressed | Slower rate, low energy, flat prosody, longer pauses |
| Anxious | Faster rate, short breaths, edged prosody |
| Manic | Pressured speech, elevated pitch/energy |
| Psychotic | Inappropriate pauses, fragmented prosody, irregular breathing |
| Neutral | Baseline profile (no overlay) |

When `emotion_modulation` is false on a profile, live switching is a no-op
(baseline returned with the requested emotion label only).

Disorder slugs map to emotion bands when the client omits `emotion`
(`mdd-*` → depressed, `bipolar-mania` → manic, `schizophrenia` → psychotic,
anxiety/PTSD → anxious).

## Schema

Migration: `supabase/migrations/20260807120000_clinical_voice_profiles.sql`

Extends `public.voice_profiles`:

| Column | Type | Notes |
|--------|------|-------|
| `speech_rate` | float 0.5–1.8 | Baseline relative rate |
| `pitch` | float 0.5–1.8 | Baseline relative pitch |
| `energy` | enum | low / moderate / high / labile |
| `prosody` | enum | flat / measured / anxious_edge / pressured / fragmented / labile |
| `breathing` | enum | calm / short / deep / irregular / held |
| `hesitation_frequency` | float 0–1 | Delivery hesitation tendency |
| `speaker_boost` | float 0–1 | ElevenLabs `similarity_boost` |
| `emotion_modulation` | bool | Enable live affect overlays |
| `pronunciation_ar` | text | Arabic pronunciation guidance |
| `pronunciation_en` | text | English pronunciation guidance |
| `updated_at` | timestamptz | Admin editor touch |

RLS unchanged: authenticated read active (or admin); admin write.

## Code

| Module | Role |
|--------|------|
| `src/lib/clinical-voice/` | Types, emotion deltas, validation, Voice Profile Manager |
| `src/app/api/voice/tts` | Applies `liveSwitchVoice` when a registry profile is resolved |
| `src/app/api/admin/voice-profiles/[id]` | Editor PATCH (clinical fields + `is_active`) |
| `src/app/api/admin/voice-profiles/[id]/live-switch` | Effective-params preview (no TTS) |
| `src/components/admin/VoiceManagementPanel.tsx` | Voice Profile Manager UI + editor + live switch |

## APIs

| Endpoint | Purpose |
|----------|---------|
| `PATCH /api/admin/voice-profiles/:id` | Save clinical profile / toggle active |
| `POST /api/admin/voice-profiles/:id/live-switch` | Preview effective params for an emotion |
| `POST /api/voice/tts` | Accepts `emotion` (+ existing `disorderSlug`); sets `X-Voice-Emotion` |

## Compatibility

- Existing avatar → voice_profile → voice_id resolution unchanged.
- Pre-migration rows get clinical defaults via column defaults + pronunciation backfill.
- Pace/energy disorder prosody (CB-HCF-007) remains the fallback when no clinical profile is loaded.
- `VoiceProfile` in `lib/types.ts` carries optional clinical fields for gradual rollout.

## Tests

`src/lib/clinical-voice/manager.test.ts` — emotion maps, live switch identity lock,
validation clamps, disorder inference, modulation off.
