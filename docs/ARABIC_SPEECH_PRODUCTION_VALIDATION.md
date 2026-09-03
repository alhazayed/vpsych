# Arabic Speech Preparation — Production Validation (PR #184)

**Date:** 2026-08-08  
**Head:** ASPE branch + listening-QA follow-up  
**Decision:** **EVIDENCE PENDING** (spoken) / engineering **GO WITH CONDITIONS**

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
| Side-by-side original vs prepared **audio** generation | **PASS** — 50/50 pairs generated (see `docs/ARABIC_TTS_LISTENING_QA.md`) |
| Side-by-side original vs prepared **listening** | **EVIDENCE PENDING** — environment cannot hear playback (`COULD_NOT_HEAR`); do not claim spoken success |

## Phase 10 — LLM

No LLM in live TTS path. Deterministic ASPE only. Any future LLM assist must be optional, off by default, non-authoritative, and never persist.

## Phase 11 — Tests

- ASPE unit + corpus tests in `prepare.test.ts` (expanded listening corpus + partial-tashkeel regression)
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
`npm run audit:deps` fails on `nanoid@3.3.16` (GHSA-2v37-7h3g-55p8) already pinned on base. Fix in a separate dependency/security PR.

## Phase 14 — Decision

### EVIDENCE PENDING (spoken) · GO WITH CONDITIONS (engineering)

ASPE remains architecturally safe to merge for TTS orthography preparation. Spoken pronunciation quality is **not** validated until a human listens to the generated A/B corpus.

Follow-ups:

1. **Human listening** of `/opt/cursor/artifacts/aspe-listening-qa/` (or regenerate via `scripts/aspe-listening-qa.mjs`).
2. **Separate deps PR:** bump `nanoid` ≥ 3.3.17.
3. Optional: wire avatar `speech_name` overrides when productized (TTS-only).

See `docs/ARABIC_TTS_LISTENING_QA.md` for generation counts and the partial-tashkeel fix.
