# Voice & Speech Human Evaluation Protocol

Repeatable manual listening procedure for the Stage 1–3 speech pipeline.

**This protocol has not yet been executed.** Stages 1–3 are verified by
automated tests only. No audio has been generated or listened to, so no claim
about Arabic naturalness is supported yet. Running this document is what closes
that gap.

> **Voice identity remains unchanged because Stage 4 requires separate
> approval.** The Arabic patient is still voiced by an American English premade
> voice (`pNInz6obpgDQGcFmaJgB` / `EXAVITQu4vr4xnSDxMaL`). Accent and lexical
> stress problems are expected to persist regardless of the scores below.

## 1. What changed, and what it can and cannot fix

| Layer | Stage 1–3 effect | Can it fix accent? |
|---|---|---|
| Speech-text normalization | Arabic digits, punctuation, medication names, acronyms, gemination | No |
| Segmentation + pauses | Conversational chunking, inter-segment silence | No |
| `previous_text` / `next_text` | One prosodic contour across a turn | No |
| `speed` / `use_speaker_boost` | Clinical pace finally reaches the provider | No |
| **Voice identity (Stage 4)** | **not implemented** | **Yes — this is the one that can** |

## 2. Test corpus

`src/lib/voice/speech-text/corpus.ts` — 50 development-only sentences:

- 10 Jordanian conversational (`ar-conv-*`)
- 10 Arabic clinical / psychiatric (`ar-clin-*`)
- 10 emotionally nuanced Arabic (`ar-emo-*`)
- 10 difficult pronunciation cases (`ar-hard-*`)
- 10 English regression (`en-reg-*`)

These are synthetic test sentences. They must never be written into
`personas/`, `avatars`, `sessions`, `session_messages`, or `clinical_snapshot`.
`speech-text.test.ts` enforces that no production module imports them.

## 3. Generating samples

Requires `ELEVENLABS_API_KEY` and a running dev server. For each corpus entry,
capture **two** clips:

- **A — current pipeline**: `POST /api/voice/tts` with the raw corpus `text`,
  no `previousText` / `nextText`.
- **B — Stage 1–3 pipeline**: drive it through `playPatientSpeech`, or replay
  the per-segment requests that `prepareSpeech(text, locale)` produces,
  including `previousText` / `nextText`.

Present A and B blind and in randomized order.

## 4. Raters

At least two, one of whom **must** be a native Jordanian/Levantine Arabic
speaker. Raters must not have read this document's expectations section before
scoring.

## 5. Scoring

Per sample, 1–5 (1 = unacceptable, 3 = usable, 5 = indistinguishable from a
real patient):

| Dimension | Arabic | English |
|---|---|---|
| Pronunciation | ☐ | ☐ |
| Intelligibility | ☐ | ☐ |
| Naturalness | ☐ | ☐ |
| Prosody | ☐ | ☐ |
| Pacing | ☐ | ☐ |
| Emotion | ☐ | ☐ |
| Clinical realism | ☐ | ☐ |

Free-text: note any word that was mispronounced, any pause that felt
theatrical, and any place the patient sounded like a narrator rather than a
person.

## 6. Turn-taking checks (live session, not clips)

Run a real session and record PASS/FAIL:

| Check | How to test | Result |
|---|---|---|
| Finished speech respected | Speak a full sentence, stop. Patient replies only after you finished. | ☐ |
| Partial STT ignored | Say "I noticed that lately…", pause ~1s mid-sentence, continue. Patient must **not** answer during the pause. | ☐ |
| No premature patient response | Repeat with pauses of 0.5s, 1.0s, 1.5s. | ☐ |
| Barge-in works | Start speaking while the patient is talking. Audio fades out within ~150ms and the mic reopens. | ☐ |
| Barge-in re-arms | Interrupt, let the patient resume, interrupt again in the same turn. | ☐ |
| Max recording terminates | Hold the mic past 20s. Capture ends and the turn is sent. | ☐ |

## 7. Ship gate

Stage 1–3 is only considered successful if **all** hold:

1. No Arabic dimension regresses (B ≥ A on every dimension, per rater).
2. Arabic **Intelligibility** improves by ≥ 0.5 mean.
3. English shows no regression on any dimension.
4. All six turn-taking checks PASS.

If Arabic Pronunciation does not improve, that is the **expected** result —
pronunciation is dominated by voice identity and is Stage 4's scope. Record it
and do not attempt to compensate with more aggressive text transformation.

## 8. Known limitations to expect

- **Voice identity**: American English voice on Arabic text (Stage 4).
- **Numeral gender**: Arabic cardinals are spelled in citation form. `٢ ولاد`
  becomes `اثنين ولاد` rather than the idiomatic `ولدين`, because the layer
  does not parse the counted noun. Bounded and documented in `lexicon-ar.ts`.
- **Years and long numbers**: emitted as digits (`2019`), not spelled.
- **Unknown Latin tokens**: left as-is. `clinic` in
  `راجعت الـ PTSD clinic مرتين` is still voiced with English phonology. Only
  lexicon entries are transliterated; the layer does not invent
  transliterations.
- **`voice_profiles.pronunciation_ar` / `pronunciation_en`**: contain
  descriptive prose, not machine-usable rules. They remain **non-operational**
  and are not consumed at synthesis time. No parser was invented for them.
- **`language_code`**: verified unsupported for `eleven_multilingual_v2` and
  deliberately not sent. Revisit only with a model change (Stage 4).
