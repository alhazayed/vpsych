# Final Hands-Free Acceptance Certification

**Date (UTC):** 2026-08-06  
**Method:** Real browser runtime only (Chrome desktop + mobile emulation)  
**Rule:** Do not certify from code or unit tests.  
**Verdict:** **FAIL**

---

## Summary

The therapist **cannot** complete a continuous conversation without manual interaction after Start Session.

| Environment | Therapy Room available? | Hands-free 10-turn loop | Verdict |
|---|---|---|---|
| Production `vpsych.vercel.app` | No (`NEXT_PUBLIC_THERAPY_ROOM_MODE` unset) | No — Classic push-to-talk mic required | **FAIL** |
| Preview (PR #149) before flag | No | No — Classic push-to-talk mic required | **FAIL** |
| Preview (PR #149) after enabling flag + redeploy `dpl_4TuHjqK…` | Yes — Classic / Therapy Room toggle present | No — Start enters ERROR; muted mic; **Retry click required** | **FAIL** |

Automatic turns completed without mic / Retry clicks: **0 / 10** (desktop and mobile).

---

## Acceptance checklist (observed)

| Check | Desktop | Mobile (390×844) | Evidence |
|---|---|---|---|
| Press Start Session once | Start works | Start works | Sessions created |
| Microphone opens automatically | **No** — muted / slashed mic | **No** — muted / slashed mic | `02-…error-on-start`, `09-…session-error` |
| Speak naturally → VAD ends recording | Not reached | Not reached | — |
| STT completes | Not reached | Not reached | — |
| GPT responds | Not reached | Not reached | — |
| ElevenLabs plays audio | Not reached | Not reached | — |
| Mic reopens after playback | Not reached | Not reached | — |
| ≥10 consecutive hands-free turns | **0** | **0** | — |
| Pause | Not exercisable (ERROR state) | Not exercisable | Control present, unused |
| Resume | Not exercisable | Not exercisable | — |
| End Session | Works | Works | Completion screens |
| Barge-in | Not reached | Not reached | — |

---

## Exact blockers (runtime)

### 1) Production / flag-off preview — Classic `VoiceSession` mic gate

**Blocking control:** Blue circular microphone button (bottom center).  
**Blocking copy:** “Ready — hold the mic or type a turn”.  
**State transition:** Session active → waits for manual mic / text turn.  
**Why this fails acceptance:** Any turn after Start requires pressing the mic (or typing).

Screenshots:

- `screenshots/03-session-started-classic-mode.webp` (preview, flag off)
- `screenshots/06-production-session-started-classic-mode.webp` (production)

### 2) Flag-on Therapy Room — ERROR + mandatory Retry

After enabling `NEXT_PUBLIC_THERAPY_ROOM_MODE=true` on Preview and redeploying PR #149:

1. Classic / Therapy Room toggle **does** appear.
2. Selecting Therapy Room changes CTA to “Enter Therapy Room”.
3. After **one** Start click, session UI shows:
   - Timer running
   - **Microphone icon with slash** (top-right and/or control bar)
   - Banner: **“Something went wrong. You can retry without losing the transcript.”** with a **Retry** button
4. Continuous Listening / VAD / STT / GPT / TTS loop never begins.
5. Continuing requires a **second manual click** (Retry) — which fails the “Start once, then hands-free” rule even before audio hardware limits are considered.

**Blocking component / state:** Therapy Room conversation error surface after Start → `ERROR` with Retry CTA; mic remains muted.  
**Likely browser event behind the UI (not used for certification):** `getUserMedia` failure in this VM (no capture device). Certification still fails on the **observed** requirement for manual Retry after Start.

Screenshots:

- `screenshots/01-desktop-therapy-room-mode-selected.webp`
- `screenshots/02-desktop-therapy-room-error-on-start.webp` ★ critical
- `screenshots/08-mobile-therapy-room-mode-selected.webp`
- `screenshots/09-mobile-therapy-room-session-error.webp` ★ critical

---

## Environments exercised

| Item | Value |
|---|---|
| Production | `https://vpsych.vercel.app` |
| Preview (hands-free PR) | `https://vpsych-git-cursor-hands-free-th-9d8847-alhazayed-1540s-projects.vercel.app` |
| Redeploy with flag | `dpl_4TuHjqKPvmuRLYv8xqUNqyGuxH3v` → `https://vpsych-n3opqoyqe-alhazayed-1540s-projects.vercel.app` |
| Git SHA under test | `98b37651ab9398c321af21f4cf9d71e2779645fe` (PR #149) |
| Browser | Chrome 148 / Ubuntu cloud agent desktop |
| Viewports | ~1280×800 desktop; ~390×844 iPhone 12 Pro emulation |
| Therapist account | Preview QA therapist (confirmed via login) |
| Patient | Jordan Hale |

Ops note (Preview only): `NEXT_PUBLIC_THERAPY_ROOM_MODE=true` was added to the Vercel **Preview** target so Therapy Room could be exercised. Production was **not** changed.

---

## Supersedes prior paper certification

`docs/HANDS_FREE_THERAPY_ROOM_CERTIFICATION.md` claimed “CERTIFIED for production” from FSM/unit-test evidence. That document is **not** an acceptance certification. This runtime report **overrides** it: **FAIL**.

---

## What would be required to re-certify

1. Therapy Room reachable in the environment under test (flag on + redeploy).
2. After **one** Start click: Listening without Retry and without mic button.
3. Observed cycle ×10: VAD → STT → GPT → ElevenLabs → auto mic reopen.
4. Pause, Resume, End, and barge-in observed on desktop **and** mobile.
5. No per-turn mic clicks after Start.

Until those are observed in a real browser, the feature remains **uncertified / FAIL**.
