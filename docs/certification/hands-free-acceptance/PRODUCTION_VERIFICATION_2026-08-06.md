# Production Hands-Free Verification — 2026-08-06

**URL:** https://vpsych.vercel.app  
**Deploy:** `dpl_3i6sevWdwXAHzagoegCWMGmHLbq4` (`95b1feac`)  
**Flag:** `NEXT_PUBLIC_THERAPY_ROOM_MODE=true`  
**Harness:** `scripts/hands-free-acceptance.mjs` (`TURNS=10`, Chrome fake mic)  
**Artifacts:** `/opt/cursor/artifacts/hands-free-prod-10b/`

## Results

| Check | Result |
|---|---|
| Start Session / Enter Therapy Room once | ✓ |
| Mic opens automatically (`LISTENING`) | ✓ |
| 10 consecutive hands-free turns (STT→GPT→speak→re-listen) | ✓ **10/10** |
| Zero push-to-talk / mic Start-Stop controls | ✓ `pushToTalkButtonsSeen: 0` |
| Pause | ✓ |
| Resume | ✓ |
| Barge-in returns to listen | ✓ |
| End Session | ✓ |
| ElevenLabs TTS HTTP 200 | ✗ **quota_exceeded (0 credits)** |

`report.json`:

```json
{
  "completedTurns": 10,
  "elevenLabsTurns": 0,
  "targetTurns": 10,
  "pauseOk": true,
  "resumeOk": true,
  "endOk": true,
  "bargeInOk": true,
  "pushToTalkButtonsSeen": 0,
  "pass": true
}
```

Avatar speech used **browser TTS fallback** because ElevenLabs returned:

```
quota_exceeded — You have 0 credits remaining
voices attempted: EXAVITQu4vr4xnSDxMaL (Sarah), XB0fDUnXU5powFXDhCwa (Charlotte)
```

## Blocker for Part 2 (voice quality)

Top up the Production ElevenLabs account (or replace `ELEVENLABS_API_KEY` with a funded `sk_…` key), then re-run:

```bash
TURNS=10 PREVIEW_URL=https://vpsych.vercel.app REQUIRE_ELEVENLABS=1 \
  npm run test:hands-free
npm run test:voice-compare
```
