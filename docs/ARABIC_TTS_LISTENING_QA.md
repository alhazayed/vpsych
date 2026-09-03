# Arabic TTS Listening QA — ASPE (follow-up to PR #184 / #185)

**Date:** 2026-08-08  
**Branch:** `cursor/arabic-tts-listening-qa-49e0`  
**Spoken decision:** **EVIDENCE PENDING**

## PR #185 merge readiness (engineering)

**Technically ready to merge** for code/docs/tests (corpus expansion, listening harness, partial-tashkeel match fix).  
**Not** a spoken-audio GO. Do not treat merge as pronunciation validation.

## Audio corpus location

On the cloud agent / review machine:

| Path | Contents |
|------|----------|
| `/opt/cursor/artifacts/aspe-listening-qa/` | Full QA pack |
| `/opt/cursor/artifacts/aspe-listening-qa/listen.html` | Human listening UI |
| `/opt/cursor/artifacts/aspe-listening-qa/audio/` | 100 MP3s (`{id}__orig.mp3`, `{id}__aspe.mp3`) |
| `/opt/cursor/artifacts/aspe-listening-qa/manifest.json` | Generation metadata |
| `/opt/cursor/artifacts/aspe-listening-qa/human-reviews.template.json` | Empty review sheet |
| `/opt/cursor/artifacts/aspe-listening-qa.zip` | Downloadable zip of the pack |
| `/opt/cursor/artifacts/aspe-listening-qa/README.md` | Operator instructions |

This pack is **synthetic speech-validation audio only** — separate from clinical patient data / transcripts.

## How to open / listen

```bash
cd /opt/cursor/artifacts/aspe-listening-qa
python3 -m http.server 8765
# open http://127.0.0.1:8765/listen.html
```

Or unzip `aspe-listening-qa.zip` locally and open `listen.html` in a browser.

Each card shows: case ID, clinical category, original Arabic, ASPE-prepared Arabic, Original ▶, ASPE ▶.

## How to record defects

In `listen.html` (defaults are **NOT REVIEWED**; nothing auto-PASSes):

1. Play **Original ▶** then **ASPE ▶**
2. **Defect:** Yes / No
3. **Severity:** Critical / High / Medium / Low (if Yes)
4. **Human QA status:** NOT REVIEWED · PASS · MINOR ISSUE · CLINICALLY SIGNIFICANT ISSUE
5. **Comment**
6. **Export reviews JSON** → save `aspe-human-reviews.json`

## Recommended minimum personal review

Listen to **at least 20 pairs**, including all of:

- All psychiatric terms + abbreviations: `psy-*`, `abbr-*` (~17)
- Number/dose/clock/age: `gen-percent`, `gen-dose`, `gen-half-dose`, `gen-clock`, `gen-age`
- One of each patient type: `pat-anxious`, `pat-depressed`, `pat-ocd`, `pat-trauma`, `pat-bipolar`, `pat-psychotic`, `pat-adolescent`
- Levantine: `lev-amman`, `lev-irbid`, `lev-natural-chat`
- Partial-tashkeel regression: `psy-bpd-shadda`

Prefer **all 50** before production spoken GO.

## Decision after human listening

| Human findings | Decision |
|----------------|----------|
| No clinically significant issues; minors acceptable or fixed | **GO** (spoken validated) or **GO WITH CONDITIONS** if minors remain documented |
| Any clinically significant pronunciation defect remains | **NO-GO** until smallest-layer fix + re-listen of affected cases |
| Review not completed | Keep **EVIDENCE PENDING** |

## Access note

Audio was generated in this environment and is on disk under `/opt/cursor/artifacts/`.  
This agent **cannot hear** the files; only a human (or audio-capable reviewer) can complete spoken QA.

## Rebuild UI only (no new TTS)

```bash
node scripts/aspe-listening-qa-build-ui.mjs
```

## Regenerate audio (optional)

```bash
npx tsx scripts/aspe-listening-qa-dump.ts
ASPE_QA_EMAIL=… ASPE_QA_PASSWORD=… node scripts/aspe-listening-qa.mjs
node scripts/aspe-listening-qa-build-ui.mjs
```
