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
      → identify (1–6) → minimal correct (7–8) → speech text (9)
      → ElevenLabs synthesize(speech-ready text)
```

Stored transcripts and UI copy are never mutated — only the bytes sent to TTS.

## Pipeline (every Arabic dialogue)

| Step | Action |
|------|--------|
| 1 | Identify pronunciation ambiguities |
| 2 | Identify medical / psychiatric terms |
| 3 | Identify names (explicit overrides only) |
| 4 | Identify abbreviations |
| 5 | Identify numbers (digit + unit, %, clock, doses) |
| 6 | Identify words likely mispronounced by TTS |
| 7 | Apply **minimal** pronunciation corrections |
| 8 | Preserve original clinical meaning |
| 9 | Output final speech-ready Arabic text |

## Dictionaries (versioned)

| Dictionary | Module | Version export |
|------------|--------|----------------|
| Medical / psychiatric speech | `dictionary.ts` | `MEDICAL_SPEECH_DICTIONARY_VERSION` |
| Explicit speech names | `names.ts` | `SPEECH_NAME_DICTIONARY_VERSION` |
| Latin abbreviations | `abbreviations.ts` | catalog constant |

`canonical → speech` entries are deterministic, testable, and isolated from
clinical case JSON. Names are **never guessed** — unknown names pass through;
runtime `speechNameOverrides` may supply TTS-only `display_name → speech_name`.

## Transforms (deterministic)

| Stage | Behavior |
|-------|----------|
| Sanitize | Strip emoji, markdown emphasis, English stage directions |
| Abbreviations | `ADHD` / `OCD` / `PTSD` / … → Arabic clinical names |
| Numbers | units, `%`, `الساعة N`, `N.5 ملغ`, doses up to 999 |
| Clinical tashkeel | Selective diacritics from medical dictionary |
| Names | Explicit catalog + optional runtime overrides only |
| Medications | Latin brand/generic → Arabic TTS spelling |

Dialect / personality speech is **preserved**. A `dialect` option is accepted
(from CVP) but never used to MSA-ize Levantine patient turns.

## Code

| Module | Path |
|--------|------|
| Barrel | `src/lib/arabic-speech/` |
| Analyze | `analyze.ts` |
| Prepare | `prepare.ts` |
| Dictionary | `dictionary.ts`, `names.ts`, `abbreviations.ts`, `numbers.ts` |
| Corpus | `corpus.ts` |
| Tests | `prepare.test.ts` |

## Integration

`src/app/api/voice/tts/route.ts` runs ASPE when `locale === "ar"` after voice
resolution and before `elevenLabsService.synthesize`.

Optional body field: `speechNameOverrides` (TTS-only; not persisted).

Response headers (telemetry only — no dialogue content):

| Header | Meaning |
|--------|---------|
| `X-Voice-Arabic-Prep` | `1` when orthography changed, else `0` for Arabic |
| `X-Voice-Arabic-Prep-Stages` | Comma list of stages that fired |

## Invariants

1. Never change clinical meaning or invent diagnoses / symptoms.
2. Never remove clinically meaningful content.
3. Selective tashkeel only — not mechanical full vocalization.
4. Numbers expanded only for known patterns (bare years stay digits).
5. Pure English strings pass through unchanged.
6. No LLM in the live TTS path (deterministic preferred).
7. Prepared text is ephemeral — never the canonical transcript.
8. Unknown personal names are not rewritten by guesswork.

## CI note

`npm run audit:deps` failure on `nanoid < 3.3.17` is **pre-existing and
unrelated to PR #184**. Do not bump lockfile in this PR; track a separate
dependency/security PR if required.

## Compatibility

- English TTS path unchanged.
- CVP emotion / prosody settings unchanged.
- Humanization stability/style overlays unchanged.
- Patient Agent reply ownership unchanged (Voice owns TTS surface only).

## Validation

See `docs/ARABIC_SPEECH_PRODUCTION_VALIDATION.md`.
