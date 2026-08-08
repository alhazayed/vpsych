# Arabic TTS Listening QA — ASPE (follow-up to PR #184)

**Date:** 2026-08-08  
**Branch:** `cursor/arabic-tts-listening-qa-49e0`  
**Decision:** **EVIDENCE PENDING**

## What was executed

1. Expanded `ASPE_PRONUNCIATION_CORPUS` to cover all requested listening categories
   (general, psychiatric terms, abbreviations, numbers, patient dialogues including
   bipolar, Levantine/Jordanian, names/safety).
2. Generated **50/50** Original vs ASPE-prepared ElevenLabs MP3 pairs via authenticated
   TTS on a pre-ASPE host (so local `prepareArabicSpeechText` is what ElevenLabs hears
   for B).
3. Attempted actual listening via computer-use agent on `listen.html` — **agent cannot
   perceive audio** in this environment (`COULD_NOT_HEAR`).
4. No fabricated pronunciation judgments.

## Artifact locations

- `/opt/cursor/artifacts/aspe-listening-qa/manifest.json`
- `/opt/cursor/artifacts/aspe-listening-qa/QA_TABLE.md`
- `/opt/cursor/artifacts/aspe-listening-qa/listen.html`
- `/opt/cursor/artifacts/aspe-listening-qa/audio/*__orig.mp3` / `*__aspe.mp3`
- Harness: `scripts/aspe-listening-qa-dump.ts`, `scripts/aspe-listening-qa.mjs`

## Engineering defect found (text-level) and fixed

| ID | Layer | Defect | Severity | Fix |
|----|-------|--------|----------|-----|
| psy-bpd-shadda | tashkeel / lexicon match | Partial tashkeel (shadda-only `الحدّية`) prevented dictionary match; speech form `الحَدِّيَّة` was not applied | High (medical term orthography for TTS) | `arabicFlexiblePattern` + only skip when surface already equals guided form (`detect.ts`, `analyze.ts`, `medical-terms.ts`) + regression test |

This fix is **text/orthography**; spoken confirmation still requires human listening of the generated `psy-bpd-shadda` pair.

## QA table (audio)

All rows: **Audio Result = GENERATED_NOT_LISTENED** (see artifact `QA_TABLE.md`).

| Metric | Value |
|--------|-------|
| Total test cases (listening corpus) | 50 |
| Audio samples generated | 100 (50 orig + 50 aspe) |
| Samples actually listened to | **0** |
| Defects found (spoken) | 0 (cannot assess) |
| Defects found (text/engine) | 1 (partial-tashkeel match) |
| Defects fixed | 1 |
| Remaining defects (spoken) | Unknown — evidence pending |

## Final decision

### EVIDENCE PENDING

Arabic TTS spoken validation could not be completed because this environment cannot
hear ElevenLabs playback. Audio pairs are generated and ready for human review.

## Answers

1. **Total test cases:** 50 listening cases (corpus also drives unit tests; ASPE suite now 79 tests in `prepare.test.ts`)
2. **Audio samples generated:** 100
3. **Samples listened to:** 0
4. **Defects found:** 1 engine/text defect (partial tashkeel); 0 spoken defects assessed
5. **Defects fixed:** 1 (flexible Arabic lexicon match)
6. **Remaining defects:** Spoken pronunciation unknown until human listen
7. **Should PR #184 be merged:** Yes for engineering/architecture (GO WITH CONDITIONS from prior audit), **after or with** this listening-QA follow-up that includes the partial-tashkeel fix — still **not** a spoken GO
8. **Additional code PR required:** This branch / PR (corpus + harness + tashkeel match fix). Separate human listening pass still required before production spoken GO
9. **Exact remaining evidence:** Human (or audio-capable) review of the 50 A/B pairs in `/opt/cursor/artifacts/aspe-listening-qa/listen.html` (or equivalent), filling Severity/Action in the QA table; re-check especially medical terms, numbers, abbreviations, Levantine preservation, and `psy-bpd-shadda`

## How to re-run generation

```bash
npx tsx scripts/aspe-listening-qa-dump.ts
ASPE_QA_EMAIL=… ASPE_QA_PASSWORD=… node scripts/aspe-listening-qa.mjs
```
