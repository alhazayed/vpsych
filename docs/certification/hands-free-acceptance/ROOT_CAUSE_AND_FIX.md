# Hands-Free Therapy Room — Root Cause & Fix

**Date (UTC):** 2026-08-06  
**PR:** #151 (`cursor/hands-free-runtime-fix-e283`)  
**SHA:** see PR #151 tip (includes `63c0340` + StrictMode mic handoff follow-up)

---

## 1. Root cause

Two cooperating defects aborted the first hands-free transition
`IDLE → LISTENING → (getUserMedia) → VAD`.

### A. Deferred `getUserMedia` without a user gesture (primary)

| Step | What happened |
|---|---|
| Therapist clicks **Enter Therapy Room** | Valid user gesture |
| `StartSessionButton` POSTs `/api/sessions` then `router.push` | Gesture ends on navigation |
| `TherapyRoomSession` mounts | Boot `useEffect` runs |
| `setTimeout(…, 400)` then `startHandsFreeVad` → `getUserMedia` | **No transient activation** |

On Safari and some Chromium builds this rejects with `NotAllowedError`.
Exact `echoCancellation` / `noiseSuppression` / `autoGainControl: true` (and
bare `channelCount: 1`) additionally throw `OverconstrainedError` on WebKit.

`startListeningLoop` catch → `dispatch("ERROR")` → status
“Something went wrong… **Retry**”. Automatic Listening never begins.
No STT / GPT / ElevenLabs requests fire (failure is pre-network).

### B. Boot cleanup poisoned `endingRef` (secondary / StrictMode)

```ts
// BEFORE (bug)
return () => {
  endingRef.current = true; // ← reserved for endSession()
  fsm.reset("IDLE");
  ...
};
```

React StrictMode re-runs the effect on the **same** instance. Cleanup left
`endingRef === true`, so `startListeningLoop` and `handleRetry` no-op’d even
after a successful remount `START`.

---

## 2. Files / functions / lines (pre-fix)

| File | Function / region | Issue |
|---|---|---|
| `src/components/StartSessionButton.tsx` | `start()` | Did not prime mic under the Start click |
| `src/components/therapy-room/TherapyRoomSession.tsx` | boot `useEffect` cleanup | Set `endingRef.current = true` |
| `src/components/therapy-room/TherapyRoomSession.tsx` | `startListeningLoop` catch | Mapped any mic failure → FSM `ERROR` |
| `src/lib/therapy-room/vad.ts` | `startHandsFreeVad` | Hard constraints; no fallback |
| `src/lib/therapy-room/audio-constraints.ts` | `HANDS_FREE_AUDIO_CONSTRAINTS` | Bare `true` / `1` (exact on Safari) |

---

## 3. First failing FSM transition

```
IDLE --START--> LISTENING --[getUserMedia]--> ✗ ERROR
```

Speech / STT / GPT / TTS / auto-reopen were never reached.

---

## 4. Minimal fix

1. `primeTherapyRoomMicrophone()` on **Enter Therapy Room** click; stash stream.
2. `TherapyRoomSession` claims stream via `takePrimedMicrophone()` and passes it
   into `startHandsFreeVad({ stream })`.
3. Constraints use `{ ideal: true }` / `{ ideal: 1 }` with `{ audio: true }` fallback
   (`acquireHandsFreeMicrophone`).
4. Boot cleanup uses local `cancelled` + `mountedRef`; **never** sets `endingRef`.
5. Unlock `AudioContext` under the Start gesture.
6. Keep a `sessionMicRef` for the whole session (reuse across listen turns).
7. On boot cleanup, **re-stash** the live mic via `stashPrimedMicrophone` instead
   of stopping tracks — StrictMode remounts reclaim it; stopping caused a second
   gesture-less `getUserMedia` → `NotAllowedError`.
8. Retry re-primes under its click before re-entering `LISTENING`.

Classic `VoiceSession` untouched.

---

## 5. Unified diff

See PR #151.
