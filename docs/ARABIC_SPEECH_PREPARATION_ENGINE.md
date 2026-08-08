# Arabic Speech Preparation Engine (ASPE)

## Objective

Transform Arabic dialogue into **speech-ready orthography** for Arabic-capable
TTS (ElevenLabs and browser fallback via the same `/api/voice/tts` path).

ASPE does **not** rewrite, summarize, translate, or clinically modify dialogue.
Priority: **pronunciation accuracy > literary elegance**.

```
Patient reply text (stored / displayed unchanged)
  → POST /api/voice/tts (locale=ar)
    → prepareArabicSpeech()
      → ElevenLabs synthesize(speech-ready text)
```

Stored transcripts and UI copy are never mutated — only the bytes sent to TTS.

## Transforms (deterministic)

| Stage | Behavior |
|-------|----------|
| Sanitize | Strip emoji, markdown emphasis, English stage directions |
| Abbreviations | `ADHD` → اضطراب فرط الحركة وتشتت الانتباه; `OCD` → الوَسْوَاس القَهْرِي; … |
| Numbers | `3 أيام` → `ثلاثة أيام`; `2 مرات` → `مرتين`; `10 دقائق` → `عشر دقائق` |
| Clinical tashkeel | Selective diacritics on psych terms (قلق، فصام، ذهان، هلوسة، انتحار، ثنائي القطب، …) |
| Names | Light guidance for frequent SP names (ليان، رامي، …) |

Dialect / personality speech is **preserved**. A `dialect` option is accepted
(from CVP `voice_profiles.dialect` when present) but never used to MSA-ize
Levantine patient turns.

## Code

| Module | Path |
|--------|------|
| Barrel | `src/lib/arabic-speech/` |
| Prepare | `prepare.ts` → `prepareArabicSpeech` / `prepareArabicSpeechText` |
| Lexicons | `abbreviations.ts`, `medical-terms.ts`, `numbers.ts` |
| Tests | `prepare.test.ts` |

## Integration

`src/app/api/voice/tts/route.ts` runs ASPE when `locale === "ar"` after voice
resolution and before `elevenLabsService.synthesize`.

Response headers (telemetry only):

| Header | Meaning |
|--------|---------|
| `X-Voice-Arabic-Prep` | `1` when orthography changed, else `0` for Arabic |
| `X-Voice-Arabic-Prep-Stages` | Comma list of stages that fired |

## Invariants

1. Never change clinical meaning or invent diagnoses / symptoms.
2. Never remove clinically meaningful content.
3. Selective tashkeel only — not mechanical full vocalization.
4. Numbers expanded only when a known Arabic unit follows (bare years stay digits).
5. Pure English strings pass through unchanged.
6. Output is speech text only — no transliteration, IPA, markdown, or commentary.

## Compatibility

- English TTS path unchanged.
- CVP emotion / prosody settings unchanged.
- Humanization stability/style overlays unchanged.
- Patient Agent reply ownership unchanged (Voice owns TTS surface only).
