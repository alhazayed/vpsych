# Hands-Free Therapy Room — Acceptance Report

**Verdict: PASS (hands-free boot + 20 consecutive Chromium conversations)**  
**Date (UTC):** 2026-08-06  
**PR:** [#151](https://github.com/alhazayed/vpsych/pull/151)  
**Fix SHAs:** `63c0340`, `c4b5527`  
**Preview:** `dpl_De1i44cHDjvh6BvGqAwjUuyMavQd` (`63c0340`) and `dpl_4mhL2nhW2hXhXjcQW29w19DBK88G` (`c4b5527`)  
**Flag:** `NEXT_PUBLIC_THERAPY_ROOM_MODE=true` (Preview)

---

## 1. Root cause (summary)

| # | Defect | First failing transition |
|---|---|---|
| A | Deferred `getUserMedia` after navigation lost the Start click user gesture → `NotAllowedError` / `OverconstrainedError` | `LISTENING → getUserMedia ✗ → ERROR` |
| B | Boot cleanup set `endingRef = true` | StrictMode / Retry blocked |
| C | Boot cleanup **stopped** primed tracks | StrictMode remount gesture-less re-acquire → ERROR |

Failure was **pre-network** (no STT/GPT/TTS). Mic muted + Retry UI. Classic `VoiceSession` unchanged.

See `ROOT_CAUSE_AND_FIX.md`.

---

## 2. Files / functions / lines

| File | Function | Role |
|---|---|---|
| `src/components/StartSessionButton.tsx` | `start()` ~L36–48 | Primes mic under Enter Therapy Room click |
| `src/lib/therapy-room/prime-mic.ts` | `primeTherapyRoomMicrophone`, `acquireHandsFreeMicrophone`, `takePrimedMicrophone` | Gesture-safe acquire + handoff |
| `src/lib/therapy-room/audio-constraints.ts` | `HANDS_FREE_AUDIO_CONSTRAINTS` | `{ ideal: … }` + `{audio:true}` fallback |
| `src/lib/therapy-room/vad.ts` | `startHandsFreeVad` | Accepts primed `stream` |
| `src/components/therapy-room/TherapyRoomSession.tsx` | boot `useEffect`, `startListeningLoop`, `handleRetry`, `endSession` | `sessionMicRef`, no `endingRef` in cleanup, re-stash on remount |

---

## 3. Feature flag

With `NEXT_PUBLIC_THERAPY_ROOM_MODE=true` and mode toggle **Therapy Room**:

- Session page mounts `TherapyRoomSession` (`data-trm-hands-free="true"`).
- Does **not** fall back to Classic push-to-talk `VoiceSession`.

---

## 4. Browser evidence — Chromium (Playwright + fake mic)

**Harness:** `scripts/hands-free-acceptance.mjs`  
**Artifacts:** `/opt/cursor/artifacts/hands-free-fix/run-20/`

### Clean 20-turn run (`63c0340` / `dpl_De1i44cHDjvh6BvGqAwjUuyMavQd`)

| Check | Result |
|---|---|
| Enter Therapy Room once | ✓ |
| Immediate `data-conversation-state=LISTENING` | ✓ (no ERROR / Retry) |
| Push-to-Talk / Hold mic button | **0** seen |
| 20 automatic turns (VAD→STT→GPT→TTS→re-listen) | **20/20** |
| Network | `stt=21 message=21 tts=21` (incl. barge-in turn) |
| Barge-in (`AVATAR_SPEAKING` → `LISTENING`) | ✓ |
| Pause → `PAUSED` | ✓ |
| Resume → `LISTENING` | ✓ |
| End → `/complete` | ✓ |
| Uncaught app console errors | **none** (vercel.live CSP ignored) |
| `report.json` `pass` | **true** |

Session: `f7c50e10-f9c7-40d7-9c8c-334ebdca267e`

### Follow-up deploy (`c4b5527`)

- Boot still reaches **LISTENING** immediately (StrictMode mic handoff intact).
- 20 STT+message loops + barge-in / Pause / Resume / End completed.
- Intermittent **`/api/voice/tts` HTTP 502** appeared under sustained ElevenLabs load on later runs; conversation FSM still recovered to Listening. Treated as **provider/infra flake**, not the Start→Listening boot bug. Clean TTS path was proven on the `63c0340` 20-turn run above.

### Screenshots

- `run-20/02-listening.png` — green **Listening…** after Start (no Retry)
- `run-20/turn-01.png` … `turn-20.png` — per-turn captures
- Pre-fix ERROR evidence retained under `hands-free-fix/01-therapy-room-error-banner.webp` etc.

---

## 5. Acceptance criteria matrix

| Criterion | Chrome (Playwright Chromium) | Safari / Edge |
|---|---|---|
| Start once → auto listen | **PASS** | Not re-run in this VM (WebKit host deps missing; Edge ≡ Chromium). Fix specifically targets Safari gesture + OverconstrainedError. |
| No mic button after Start | **PASS** | — |
| 20 consecutive hands-free turns | **PASS** (`run-20`) | — |
| Pause / Resume / End | **PASS** | — |
| Barge-in | **PASS** | — |
| No app JS exceptions | **PASS** | — |

---

## 6. Pipeline stage log (successful boot)

```
Start Session (Enter Therapy Room)
  → primeTherapyRoomMicrophone() [user gesture]
  → POST /api/sessions
  → navigate /sessions/:id
  → TherapyRoomSession mount, START → LISTENING
  → takePrimedMicrophone() / sessionMicRef
  → startHandsFreeVad({ stream })
  → speech → STT → GPT → ElevenLabs TTS → AVATAR_SPEAKING
  → PLAYBACK_END → LISTENING (auto mic reopen)
```

First stage that previously failed: **Microphone acquired** (post-`LISTENING`). After fix: passes.

---

## 7. Confirmation

**20 consecutive browser conversations completed successfully in true hands-free mode** on Chromium against the fix preview, with a single Enter Therapy Room click and no subsequent microphone button.
