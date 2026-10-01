# Voice fidelity browser harness

Drives the **real** voice-layer modules (`vad.ts`, endpoint controller, speech
queue) in headless Chromium with a fake microphone fed from synthetic WAV
fixtures. It measures endpoint timing, premature submits, barge-in detection and
capture, media stop latency, and progressive-queue gaps. It does not exercise
real STT, LLM or TTS, and it is not a listening test. Not part of CI.

```bash
# 1. playwright-core outside package.json
npm i --no-save playwright-core@1.56
# 2. optional "before" comparison: a worktree of the base ref
git worktree add /tmp/vpsych-base <base-ref>
ln -s "$PWD/node_modules" /tmp/vpsych-base/node_modules
# 3. run (CHROMIUM_PATH overrides the default /opt/pw-browsers path)
node scripts/voice-fidelity/drive.mjs --base /tmp/vpsych-base
```

Results print to stdout and are saved to `$TMPDIR/vpsych-voice-fidelity/results.json`.
STT is simulated (400 ms). The fragment transcript depends on how much audio
the speculative snapshot holds. Chrome's fake device restarts its file
whenever the mic is re-opened, so a "before" barge-in capture re-hears the
whole utterance and is an artifact. See `docs/VOICE_CONVERSATION_FIDELITY.md` §4.
