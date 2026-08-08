# Arabic Speech Preparation — Production Validation (PR #184)

**Date:** 2026-08-08  
**Head:** ASPE branch (`cursor/arabic-speech-preparation-4d3f`)  
**Decision:** **GO WITH CONDITIONS**

## Phase 1 — Architecture audit

| # | Check | Result |
|---|--------|--------|
| 1 | Prep applied only to TTS synthesis | **PASS** — sole call site `src/app/api/voice/tts/route.ts` when `locale === "ar"` |
| 2 | Original dialogue/transcript unchanged | **PASS** — message route does not import ASPE (architecture guard) |
| 3 | Prepared text not persisted as canonical transcript | **PASS** — prepared string is local to the TTS handler → ElevenLabs only |
| 4 | English TTS unchanged | **PASS** — `arabicPrep = null`; `text = rawText` |
| 5 | Arabic locale detection | **PASS** — `normalizeSpeechLocale` (`ar` / `ar-*`) |
| 6 | Clinical meaning preserved | **PASS** — lexicon/abbrev/number orthography only; corpus `safe-no-invent` |
| 7 | Personality / affect / dialect preserved | **PASS** — dialect option unused for rewrite; Levantine corpus |
| 8 | No Arabic→English translation | **PASS** — tests assert no English glosses |
| 9 | Deterministic | **PASS** — unit tests for repeatability + idempotence |
| 10 | No unsafe clinical substitutions | **PASS** — explicit dictionaries; unknown names unchanged |

## Phase 3 / 9 — ElevenLabs spoken QA

| Item | Status |
|------|--------|
| Prepared text actually passed to `elevenLabsService.synthesize({ text })` | **PASS** (code path) |
| `locale=ar` selects Arabic voice path | **PASS** (existing voice config) |
| `X-Voice-Arabic-Prep*` diagnostic only (no dialogue in headers) | **PASS** |
| Side-by-side original vs prepared **audio** listening | **EVIDENCE PENDING** — `ELEVENLABS_API_KEY` not available in this environment; **do not claim spoken success** |

## Phase 10 — LLM

No LLM in live TTS path. Deterministic ASPE only. Any future LLM assist must be optional, off by default, non-authoritative, and never persist.

## Phase 11 — Tests

- ASPE unit + corpus tests: **≥40** meaningful cases (see `prepare.test.ts` + `corpus.ts`)
- Architecture guards for TTS wiring + message-route isolation

## Phase 12 — Privacy

| Check | Result |
|-------|--------|
| No new external service | **PASS** — ElevenLabs only (existing) |
| No persistence of prepared speech | **PASS** |
| No new logging of patient dialogue | **PASS** — TTS logs codes/status only |
| Headers carry stage names, not utterance text | **PASS** |

## Phase 13 — CI

**CI audit failure is pre-existing and unrelated to PR #184.**  
`npm run audit:deps` fails on `nanoid@3.3.16` (GHSA-2v37-7h3g-55p8) already pinned on base `a75bade`. This PR does **not** modify `package.json` / `package-lock.json`. Fix in a separate dependency/security PR.

## Phase 14 — Decision

### GO WITH CONDITIONS

ASPE is architecturally safe to merge for TTS orthography preparation. Merge is appropriate for code/docs/tests, with mandatory follow-ups:

1. **Spoken pronunciation QA (EVIDENCE PENDING):** run the corpus through ElevenLabs (original vs prepared) with Arabic voice; listen for vowel/stress/medical/number errors and over-tashkeel unnaturalness.
2. **Separate deps PR:** bump `nanoid` ≥ 3.3.17 to clear `audit:deps` on CI.
3. **Optional:** wire avatar `speech_name` from profile metadata into `speechNameOverrides` when productized (TTS-only).

### Answers

1. **Files changed:** `src/lib/arabic-speech/*`, TTS route, architecture tests, ASPE docs + this validation doc, CLAUDE/CHANGELOG/ownership/pipeline docs as applicable.
2. **Tests added:** expanded unit suite + deterministic pronunciation corpus.
3. **Test count:** see vitest run on `prepare.test.ts` (target ≥40; corpus + units).
4. **Known limitations:** no live audio validation here; clock hours only 1–12; non-0.5 decimals left as digits; name overrides are explicit-only; Levantine preserved but not dialect-optimized beyond that.
5. **ElevenLabs uses prepared text:** **yes** (code path); **audio quality unproven** (EVIDENCE PENDING).
6. **Clinical meaning preserved:** **yes** (text-level evidence).
7. **English unchanged:** **yes**.
8. **Privacy boundaries preserved:** **yes**.
9. **Should PR #184 be merged:** **yes, with conditions above**.
10. **Follow-up PRs:** (a) nanoid audit fix; (b) ElevenLabs listening QA report with recordings or structured listener checklist.
