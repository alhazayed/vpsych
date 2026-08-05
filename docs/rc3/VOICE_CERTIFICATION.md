# RC3 Wave 2 — Voice Certification

**Verdict: PASS**  
**Evidence ID:** `RC3-W2-EV-20260805T1400Z`  
**Production:** https://vpsych.vercel.app

## Results

| Check | Result | Evidence |
|---|---|---|
| OpenAI STT configured | PASS | Admin health `sttModel: gpt-4o-transcribe` |
| GPT conversation (voice session path shares message API) | PASS | `aiSource: gpt` on text turns |
| ElevenLabs TTS EN | PASS | HTTP 200 `audio/mpeg` 55633 bytes · ~2610 ms |
| ElevenLabs TTS AR | PASS | HTTP 200 `audio/mpeg` 64410 bytes · ~1448 ms |
| Streaming | PASS | `stream: true` accepted; MPEG body returned |
| Voice identity via avatarId | PASS | Resolved for Jordan avatar |
| Anon TTS | PASS (denied) | 401 Unauthorized |
| STT round-trip (TTS→transcribe EN) | PASS | transcript ≈ source; provider `openai` |
| Latency | ACCEPTABLE | TTS &lt; 3s sampled |
| Fallback | Not forced | Real provider path live; no fallback required this run |

Artifacts: `/opt/cursor/artifacts/rc3/wave2/tts_en_US.mp3`, `tts_ar_JO.mp3`.

## Defects

None Critical/High for voice runtime.

## Sign-off

Voice certification **PASS**.
