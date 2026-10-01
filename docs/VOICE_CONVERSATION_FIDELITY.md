# Voice — Human Conversation Fidelity

**Scope:** voice interaction layer only. No schema, migration, RLS, auth,
message-API contract, clinical prompt, reasoning, scoring or report change.
**Base:** `cursor/soft-release-desktop-f2a6` (PR #259 — Phase 9.1 fencing +
9.2/9.2R progressive TTS). The turn fence, AbortSignal cancellation, chunker,
ordered queue, legacy/browser fallbacks and first-audio telemetry described in
the mission live on that branch, not on `main`.
**Status:** engineering complete; automated + headless-browser verified.
**Human listening / live-mic verification has NOT been done** (see §8).

---

## 1. Phase 0 — audit of the existing voice layer

### 1.1 Map

| Concern | Where | Notes |
|---|---|---|
| Classic UI (default) | `components/VoiceSession.tsx` | Push-to-talk (mic toggle). No VAD. Interim Web Speech for the draft only. |
| Hands-free UI (flag) | `components/therapy-room/TherapyRoomSession.tsx` | `NEXT_PUBLIC_THERAPY_ROOM_MODE` + `interaction_mode=therapy_room`. Energy VAD, auto mic reopen, barge-in monitor. |
| Clinic room UI | `components/therapy-room/TherapyRoom.tsx` | Push-to-talk, same pipeline. |
| State machine | `lib/therapy-room/conversation-fsm.ts` | Authoritative for hands-free; generation counter rejects stale work. Classic UIs use the turn fence. |
| VAD / endpoint | `lib/therapy-room/vad.ts` | RMS VAD; single stage: 850 ms silence (clamped 700–1000) after ≥400 ms speech. |
| Barge-in | `vad.ts › startBargeInMonitor` | ≥280 ms speech @ RMS 0.02 during patient audio; stops its own mic. |
| Pipeline | `lib/voice/conversation-pipeline.ts` | STT → `/api/sessions/:id/message` → TTS → audio. |
| Turn fence | `lib/voice/turn-fence.ts`, `turn-lifecycle.ts`, `interrupt-flag.ts`, `mic-claim.ts` | Phase 9.1/9.1R. |
| Chunking | `lib/voice/speech-chunker.ts` | Sentence/clause chunks, ≤6 per reply, legacy Blob over budget. |
| Queue | `lib/voice/speech-queue.ts` | Bounded (×2) TTS, ordered playback, play()-rejection handling. |
| STT | `/api/voice/transcribe` → OpenAI | Batch, after endpoint. |
| TTS | `/api/voice/tts` → `elevenlabs/service.ts` | `eleven_multilingual_v2`, body `{text, model_id, voice_settings}`. |
| Telemetry | `lib/therapy-room/conversation-telemetry.ts` | Timings/counters only; persisted as counters via PATCH therapy-room. |
| Unused | `lib/realtime/*` | Library scaffolding; not mounted in session UIs. Not touched. |

### 1.2 Data / interruption / timing flow (before)

```
LISTENING ─(850 ms silence)→ PROCESSING_STT ─STT→ WAITING_GPT ─reply→ AVATAR_SPEAKING ─end→ LISTENING
                                                     (mic closed)          └─ barge-in monitor → stop
                                                                              → new getUserMedia → LISTENING
persona pause (voiceHints.pause_before_ms) applied AFTER the reply arrived, BEFORE any TTS request
```

### 1.3 Strengths kept

Turn fence + generation counter; AbortSignal end-to-end; atomic assistant tip
guard (9.1S); bounded progressive TTS with explicit legacy fallback; first-audio
telemetry only on `play()` resolution; PHI-free telemetry.

### 1.4 Defects found (all voice-layer)

| # | Defect | Effect |
|---|---|---|
| D1 | Single-stage 850 ms energy endpoint (hard max 1000 ms) | Any mid-thought pause ≥ ~0.9 s submits a half-sentence ("أنا من فترة…"). |
| D2 | No way to reclaim the floor once the endpoint fired | Therapist speech during STT/generation is lost; patient then talks over them. |
| D3 | Barge-in monitor stops the mic, capture re-acquires it | The interruption's first words (≥ ~330 ms detection window + reopen) never reach STT. |
| D4 | Barge-in marks `therapistInterrupted` even before the patient's first audible word | Taking the floor during synthesis is reported to the behaviour engine as an interruption. |
| D5 | Classic UI: mic press while a reply is still synthesizing does not cancel it | The reply starts playing **over the therapist's recording**. |
| D6 | Persona pause applied after generation and before TTS | Adds the full pause (≤6 s) + TTS time on top of processing latency. |
| D7 | Hard-split of long unpunctuated text at arbitrary words | Chunks end on "أن" / "في" / "the" → audible broken boundary. |
| D8 | Chunks synthesized independently | Intonation resets at every chunk boundary. |
| D9 | Mid-utterance TTS failure reported both `onerror` and `onend` + `audio_queue_complete` | Misleading telemetry; "completed" reply that was cut short. |
| D10 | Legacy-Blob `onstart` fired before synthesis | "Speaking" while nothing is audible. |

---

## 2. Phase 1 — design (smallest change set)

**One authoritative state source per UI is preserved.** The hands-free FSM gains
one state and four events; classic UIs keep the turn fence. No parallel state
machine was added.

```
LISTENING ─pause(850 ms)→ ENDPOINT_PENDING ──(speculative STT, mic still open)──┐
    ▲                         │  therapist resumes (voice ≥150 ms) → SPEECH_RESUMED
    └─────────────────────────┘                                                │
ENDPOINT_PENDING ─commit→ PROCESSING_STT (transcript reused) → WAITING_GPT ────┘
WAITING_GPT ─therapist takes floor (≥450 ms)→ THERAPIST_RESUMED → LISTENING (reply held)
LISTENING ─capture was empty & reply held→ HELD_REPLY → AVATAR_SPEAKING
AVATAR_SPEAKING ─barge-in→ LISTENING (live mic + pre-roll handed over)
```

| Area | Change |
|---|---|
| Endpointing | `lib/voice/endpointing.ts`: completeness classifier (AR MSA/Jordanian + EN + code-switching): trailing conjunctions/prepositions/complementizers, hesitation tokens, ellipsis, open clause, question, acknowledgements, very short fragments. Required silence: complete **850 ms** (unchanged), ambiguous **1500 ms**, unfinished **2000 ms**, hard ceiling **2200 ms**. |
| Two-stage controller | `lib/voice/endpoint-controller.ts`: pause → speculative STT (mic open) → classify → commit or wait. Resume aborts STT and versions out late results. Voice activity *holds* a due commit until the resume is confirmed or rejected. The speculative transcript is reused, so a turn still costs one STT call. |
| VAD | `vad.ts`: opt-in `twoStage` mode (pause/resume/activity callbacks, max-silence failsafe); `preroll` seeding; `adoptStream`. Single-stage behaviour unchanged when not opted in. |
| Barge-in capture | Monitor keeps a 1.5 s ring; on fire it keeps capturing until the capture VAD drains it on its first audio callback (timestamp de-dup, 300 ms lead-in). Same live stream, no reopen. |
| Interrupt semantics | Interruption flag only after the first audible patient audio; earlier speech is a floor-take (`floor_yield`). Classic UI: `therapistTurnStartAction` cancels a scheduled-but-silent reply without the flag. |
| Floor control | While the reply generates, a stricter monitor (≥450 ms) lets the therapist take the floor; the reply is held, and replayed only if what they said turns out empty (≤20 s old). A real new turn supersedes it. |
| Timing | `lib/voice/response-timing.ts`: persona pause measured from end-of-speech and run as a start gate that overlaps TTS synthesis. No new delay is ever introduced; existing persona/NBE values are untouched. |
| Chunking | Hard-split prefers a break before a connective and never ends on a binding function word. Text and order preserved exactly. |
| TTS continuity | `previous_text`/`next_text` request stitching (bounded, in cache key; `ELEVENLABS_REQUEST_STITCHING=off` kill switch). `language_code` opt-in only (`ELEVENLABS_LANGUAGE_CODE=on`). Docs host was blocked here, so model support could not be confirmed. |
| Telemetry | Counters/timings only: endpoint pauses/resumes/commit silence, speculative reuse, barge-in detect/stop ms, floor yields, held replies, stale discards, chunks generated/played, TTS/playback failures. |

**Arabic.** Arabic is first-class in the classifier and chunker word sets
(tashkeel/tatweel-insensitive, Levantine forms such as إنو، عشان، هاد، هاي).
Pronunciation itself depends on voice + model. The verified Arabic voice
catalogue (#212) and the unmerged ASPE (#184) / voice audit (#186) remain the
right levers; this change adds stitching (prosodic continuity) and an opt-in
`language_code` for A/B. It does **not** claim pronunciation improved.

**OpenAI Realtime.** Not needed for anything above: endpointing, barge-in,
floor control and continuity were achievable on the existing architecture.
The remaining gap Realtime would close is streaming STT/LLM/TTS latency
(sub-second first audio) and server-side VAD (§9).

---

## 3. Changed files

| File | Why |
|---|---|
| `src/lib/voice/endpointing.ts` (new) | D1 — linguistic + duration-aware endpoint budget. |
| `src/lib/voice/endpoint-controller.ts` (new) | D1/D2 — two-stage race-safe orchestration. |
| `src/lib/voice/response-timing.ts` (new) | D6 pause anchoring; D8 stitching context. |
| `src/lib/therapy-room/vad.ts` | D1 two-stage mode; D3 pre-roll ring + live-stream handoff. |
| `src/lib/therapy-room/conversation-fsm.ts` | `ENDPOINT_PENDING`, `PAUSE_DETECTED`, `SPEECH_RESUMED`, `THERAPIST_RESUMED`, `HELD_REPLY`. Existing edges unchanged. |
| `src/lib/therapy-room/conversation-telemetry.ts` | New PHI-free counters. |
| `src/components/therapy-room/TherapyRoomSession.tsx` | Wiring: two-stage endpoint, handoff, D4, floor control, held reply, telemetry. |
| `src/components/VoiceSession.tsx` | D5, D6 (anchor). |
| `src/components/therapy-room/TherapyRoom.tsx` | D4 equivalent (flag only after audible audio). |
| `src/lib/voice/turn-lifecycle.ts` | `therapistTurnStartAction` (D5). |
| `src/lib/voice/conversation-pipeline.ts` | Anchor + start gate (D6), stitching (D8), D10. |
| `src/lib/voice/speech-queue.ts` | `startGate` (D6), D9. |
| `src/lib/voice/speech-chunker.ts` | D7. |
| `src/lib/voice/client.ts`, `src/app/api/voice/tts/route.ts`, `src/lib/voice/elevenlabs/service.ts` | D8 stitching (bounded 600 chars server-side), opt-in `language_code`, cache key. |
| `.env.example` | Document the two TTS flags. |
| Tests | `endpointing`, `endpoint-controller`, `response-timing`, `human-conversation` (Tests 1–10), `vad-frames` (new); additions to chunker, queue, ElevenLabs, FSM, turn-lifecycle, architecture tests. |
| `scripts/voice-fidelity/*` | Reproducible headless-Chromium fake-mic harness (not in CI). |

**Deliberately not changed:** Supabase schema/migrations/RLS, auth, session
routes, `/api/sessions/:id/message` and its contract (including what is
persisted), patient agent, prompts, CBE/emotion/adaptation, assessment, scoring,
reports, admin, navigation/core UI, `lib/realtime/*`, Phase 9.1S guard, rate
limits, STT route.

---

## 4. Before / after

Measured with identical inputs against the base worktree (`HEAD` of #259) and
this branch. "Browser" means real Chromium (Web Audio, `getUserMedia`,
`HTMLAudioElement`) with a **synthetic** fake microphone and **simulated** STT
(400 ms). There was no real STT, LLM or ElevenLabs and no human listener.

| Metric | Before | After | Source |
|---|---|---|---|
| Premature turn submit on a mid-thought pause after an ambiguous fragment (300/600/900/1200/1500 ms) | **3 / 5** (≥900 ms) | **1 / 5** (1500 ms, designed bound) | Browser |
| Premature submit, unfinished fragment (trailing "و") at 1200/1500/1800 ms | 3 / 3 (single-stage ignores text) | **0 / 3** | Browser |
| End-of-speech → transcript ready, finished thought | 1424–1445 ms | 1417–1520 ms (**no regression**) | Browser |
| Interruption audio reaching STT (voiced s; reference 1.42 s) | lost ≥ detection window (~330 ms) + mic reopen¹ | **1.30–1.38 s (92–97 %)** | Browser |
| Barge-in detection (speech onset → fire) | 331–333 ms | 326–333 ms (unchanged by design) | Browser |
| Detection → patient audio paused | 0.1 ms; `currentTime` frozen after stop | 0.1 ms; frozen | Browser |
| Abort → queued chunk audio paused | — | 0.5–0.7 ms | Browser |
| Gap between progressive chunks | — | 4–5 ms | Browser |
| First audio after reply-ready (900 ms persona pause, 300 ms TTS, 1.5 s already spent) | **1207 ms** | **307 ms** | Unit (fake timers off) |
| Chunks ending on a binding function word (6 long AR/EN texts × 3 widths) | **10 / 29** | **0 / 32** | Unit |
| Reply audible over therapist recording when mic pressed during synthesis (classic UI) | yes, every time (code path) | no (cancelled) | Code path + unit |
| Interruption flag set before any audible patient audio | yes (code path) | no | Code path + guardrail |
| Duplicate / stale audio incidents in race suites | 0 | 0 | Unit (Tests 3, 8, 9) |
| TTS failures / Arabic pronunciation issues | not measured | not measured | Needs keys + human ear |

¹ The fake device restarts its file on every re-open, so the "before" capture
in this harness re-hears the whole utterance. That figure is an artifact and is
not reported. Detection latency is measured; reopen time on real hardware was
not.

---

## 5. Automated tests

`npm test`: **1211 / 1211** passing in 123 files (baseline 1128 in 118).

Human Conversation suite, `src/lib/voice/human-conversation.test.ts`:
1 normal turn-taking without overlap · 2 short pause not submitted · 3
synchronous stop on interruption · 4 correction submitted in-context with
`therapistInterrupted` · 5 Arabic hesitation/completion + stitched Arabic TTS ·
6 Arabic/English mixed speech intact · 7 long reply ordered, no dup/skip · 8
rapid interruptions: only newest audible · 9 delayed STT/message/TTS never
surface · 10 `play()` rejection → fallback, never stuck "speaking".

Also: completeness corpus (AR/EN/mixed), controller races (resume during STT,
late results, activity hold, cancel, single commit), FSM edges, ring buffer
windowing, start-gate overlap, request body/kill switch/cache key, chunk
boundaries, guardrail test.

CI sequence run locally: audit:deps ✓ · lint ✓ (0 errors) · typecheck ✓ ·
test ✓ · migrations ✓ (structure only; `SUPABASE_DB_URL` unset) · perf smoke ✓
· build ✓.

## 6. Browser verification

Reproduce: `scripts/voice-fidelity/README.md`. Verified in headless Chromium
1194: VAD two-stage pause/resume/activity, commit timing, barge-in detection,
media-element stop, live-stream handoff with pre-roll, progressive queue gaps
and abort.

**Not verified:** a real microphone and speakers, real OpenAI STT on Arabic or
mixed speech, real ElevenLabs output, Safari, iOS/WebView, Android,
Bluetooth/headsets, background/foreground transitions. iOS stays deferred, as
the soft-release baseline already states.

## 7. Behaviour notes for reviewers

- Classic `VoiceSession` is push-to-talk, so endpointing does not apply there.
  It gets D5, D6 and the TTS/chunking improvements.
- Hands-free endpoint latency is unchanged for finished thoughts. Ambiguous or
  unfinished thoughts wait up to 1.5 s or 2.0 s of silence.
- Floor-take and empty-capture replay use the reply text the client already
  holds. Nothing extra is persisted.

## 8. Remaining limitations

1. **Heard vs persisted.** The message API persists the full patient reply
   before any audio plays. After a barge-in or floor-take, history contains
   words the therapist never heard. Fixing this needs a message-API or
   persistence change, a hard stop for this mission. The correction itself
   does reach the model in context as the next turn, flagged as an interruption.
2. **Linguistic endpointing is heuristic** and depends on STT punctuation. Its
   word lists are a starting set and need tuning on real transcripts.
3. **Floor-take in a noisy room** can hold a reply. It is replayed if the
   capture is empty, but a false start that STT transcribes as words
   supersedes it.
4. **Stitching / `language_code`** behaviour was not confirmed against the live
   ElevenLabs API: the docs host was blocked and there was no key here.
5. **STT rate budget:** a pause that resumes costs one extra STT call. The
   existing 120/h `stt` budget is already tight for fast 40-minute sessions.
6. No human listening test. Naturalness, Arabic quality and "does it feel like
   a conversation" are **unassessed**.

## 9. Recommended next steps

1. Human desktop-Chrome session per the brief's §24 checklist (EN + AR),
   recording the telemetry counters above.
2. A/B `ELEVENLABS_LANGUAGE_CODE=on` with a model that supports it, plus Arabic
   voices from #212, by Jordanian clinician ear. Then revisit ASPE (#184).
3. Tune endpoint word lists and budgets from real `endpoint_*` telemetry.
4. A small additive "heard fraction" field to make history match what was
   heard. This needs explicit approval because it touches the message contract.
5. Evaluate streaming STT and TTS (ElevenLabs WebSocket or OpenAI Realtime) for
   sub-second first audio, behind a flag. This would replace transport only;
   the clinical brain, fence and FSM concepts would stay.

---

## 10. Latency follow-up — live preview session (2026-10-01)

Source: PHI-free `conversationTelemetry` counters plus message timestamps for
one 4-turn English Therapy Room session on the #260 preview. No content was
read.

| Stage (avg per turn) | Time | Driver |
|---|---|---|
| End of speech → turn committed | 2.24 s | 850 ms pause + speculative STT (STT latency was not recorded; fixed below) |
| Message API (client-measured) | 3.25 s | ~12 serial DB round-trips + `gpt-5` (minimal reasoning, non-streamed) |
| Reply → first patient audio | 2.04 s | ElevenLabs `eleven_multilingual_v2`, whole first chunk |
| **Total** | **≈ 7.5 s** | |

Barge-in in the same session: detection 293 ms, audio stop 3 ms, 2 barge-ins,
2 endpoint resumes.

Voice-layer changes made in response:

- The barge-in mic monitor now starts **in parallel** with the first TTS
  request. Before, `getUserMedia` and AudioContext startup ran serially in
  front of it.
- A first sentence over 80 chars is split at its first clause boundary or
  connective (`splitLongFirstChunk`), so the first TTS request is shorter.
  Stitching keeps the intonation continuous.
- Telemetry records speculative STT latency (`avgSttMs`) and
  `endpointMaxSilenceCommits`.

Larger levers are outside the voice layer or carry quality trade-offs, so they
need a decision: the TTS model (`eleven_flash_v2_5` / `eleven_turbo_v2_5`), the
STT model (`gpt-4o-mini-transcribe`), parallelising the message route's DB
work, and streaming the patient reply into TTS. Also note: this session made
6 speculative STT calls for 4 turns, against a 120/h `stt` rate budget.

### 10.1 Second live session (5 turns, after `a5a02ff`)

| Stage | Measured |
|---|---|
| Speculative STT (`gpt-4o-transcribe`) | **2.13 s** average. 4 of 5 commits hit the 2.2 s max-silence ceiling while waiting for it |
| Server: user message saved → reply saved | 2.2–5.9 s, growing with reply length (249 chars → 5.9 s) |
| Reply → first audio | 2.14 s |

The parallel monitor start and short first chunk did not measurably change
the total. Latency is dominated by the three external services. Follow-up
(voice layer): STT uploads now start 300 ms before the first voiced frame
instead of at mic open. In the harness the reference clip went from 3.53 s to
2.88 s uploaded (lead-in 1.02 s → 0.38 s), with endpoint behaviour unchanged.
