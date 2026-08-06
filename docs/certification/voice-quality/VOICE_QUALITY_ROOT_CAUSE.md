# Avatar Voice Quality — Root Cause & Fix

**Date (UTC):** 2026-08-06  
**Branch:** `cursor/hands-free-voice-quality-8cb7`

---

## 1. Root cause (robotic SP voice)

| Factor | Pre-fix | Effect |
|---|---|---|
| Missing `use_speaker_boost` | Not sent in `voice_settings` | Thinner, less human timbre |
| High depression stability (`0.62`) | Flat delivery for MDD / low energy | Sounds like TTS narration |
| No `output_format` | Provider default only | No explicit CD-quality MP3 |
| No text normalization / pause prep | Dense paragraphs to the model | Missing breath / hesitation rhythm |
| AR default Adam | Male multilingual fallback | Less natural for many AR SPs |
| Flash/turbo temptation | Low-latency models sound assistant-like | Clinical realism drops |

Not caused by browser decoding when ElevenLabs returns `audio/mpeg` successfully.
Browser SpeechSynthesis fallback remains robotic — barge-in / abort paths must not
fall into it unless ElevenLabs truly fails (already gated in `playPatientSpeech`).

---

## 2. Files / functions

| File | Change |
|---|---|
| `src/lib/voice/prosody.ts` | Natural SP defaults + `use_speaker_boost`; cap slow/low stability &lt; 0.55 |
| `src/lib/voice/elevenlabs/service.ts` | `output_format`, `apply_text_normalization`, TTS text prep |
| `src/lib/voice/tts-text.ts` | Pause / ellipsis / hesitation prep |
| `src/lib/voice/config.ts` | Model/format constants; AR default → Charlotte |
| `src/lib/voice/voice-comparison.ts` | Casting rubric + recommended voices |
| `scripts/compare-elevenlabs-voices.mjs` | Live multi-voice generate + score |

---

## 3. Target settings

```json
{
  "model_id": "eleven_multilingual_v2",
  "output_format": "mp3_44100_128",
  "voice_settings": {
    "stability": 0.38,
    "similarity_boost": 0.82,
    "style": 0.28,
    "use_speaker_boost": true
  },
  "apply_text_normalization": "auto"
}
```

Recommended defaults: **Sarah** (EN), **Charlotte** (AR).  
Run `node scripts/compare-elevenlabs-voices.mjs` with `ELEVENLABS_API_KEY` to regenerate
audio evidence and confirm the winner on the live plan.
