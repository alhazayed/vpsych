# VPsych Human Conversation Engine (HCE) v1.0 — Plan

> Status: **proposal — no implementation yet**. This document is the agreed
> scope before any code is written.

## Objective

Turn the patient avatar from a *chatbot that has a voice* into a *person in the
room*. Today the avatar answers well but does not **remember**, **feel**,
**withhold**, **hesitate**, **interrupt**, or **change** over forty minutes.
HCE adds a live, inspectable conversational state layer between speech-in and
speech-out, and rebuilds the pipeline so the patient answers in the rhythm of
human speech rather than the rhythm of three chained HTTP requests.

```
                    Memory Engine
                          │
    Emotion Engine ───────┼────── Clinical Engine
                          │
                 Conversation Director
                          │
    Behavior Engine ──────┼────── Voice Engine
                          │
                 Environmental Context
                          │
                   GPT-5 Reasoning
                          │
               Streaming Voice Output
```

The organising principle: **the engines decide, the model speaks.** State
transitions are deterministic, seeded, and testable in code. GPT-5 is used for
what only it can do — producing natural language in a specific voice. This
keeps the simulation reproducible enough to certify, and fast enough to feel
real.

---

## Why now — what the current runtime actually does

Findings from the existing code, which set the starting line:

| Area | Today | Consequence |
|------|-------|-------------|
| Turn loop | Click mic → record WAV → batch STT → blocking chat call → full TTS blob → play (`VoiceSession.tsx`, `conversation-pipeline.ts`) | Four serial round-trips before a single word is heard |
| TTS | `eleven_multilingual_v2`, server streams but client does `new Response(res.body).blob()` (`voice/client.ts`) | Streaming is thrown away; playback waits for the last byte |
| Voice settings | Hardcoded `stability: 0.4, similarity_boost: 0.75` (`elevenlabs/service.ts`) | Every emotion sounds identical |
| STT | `gpt-4o-transcribe`, batch multipart upload, 10 MiB cap (`api/voice/transcribe`) | No partials, no paralinguistics, nothing happens while the trainee talks |
| Barge-in | `stopPlayback()` is never called when the mic opens | Trainee and patient talk over each other with no arbitration |
| Patient state | None. Alliance/resistance are **static strings** baked into the prompt at case generation (`DifficultyModifiers`) | The patient cannot warm up, shut down, or rupture |
| Memory | Last 20 messages, verbatim slice (`patient-agent.ts`) | Turn 41 forgets turn 3; contradictions are inevitable in a 40-minute session |
| Disclosure | `disclosure_rules` are prose in the system prompt | Compliance is a coin flip, so elicitation cannot be graded |
| `case_memory` table | Exists, writable, **never written** (`case-engine/persist.ts`) | Longitudinal mode is typed but not real |
| Per-turn persistence | None. `session_messages` is exactly `id, session_id, role, content, created_at` | Assessment infers everything from raw text |
| Instrumentation | No timing anywhere in the voice path | No latency baseline exists |

Everything above is additive to fix. Nothing in HCE requires rewriting the
clinical engines, the security model, or the report contract.

---

## The spine: `PatientState`

One serialisable object, advanced by pure reducers once per turn. Every engine
reads it; only the Director commits it.

```
PatientState {
  turn_index, session_phase, elapsed_sec

  affect:      { valence, arousal, dominance, label, intensity, inertia }
  alliance:    { trust, rapport, felt_safety, ruptures[], repairs[] }
  guardedness: { resistance, defensiveness, shame }
  energy:      { fatigue, activation }

  disclosure:  Ledger<topic → locked | unlocked | revealed>
  symptoms:    Ledger<symptom_id → unexpressed | expressed(how, when)>
  risk:        not_probed | probed_deflected | partial | disclosed

  facts:       FactTable   // everything the patient has asserted aloud
  digest:      string      // consolidated summary of evicted turns

  rng_seed, hce_version, config_hash
}
```

Two properties matter more than the contents:

- **Deterministic.** Seeded with mulberry32, the same pattern already used by
  `case-engine/generator.ts`. Given the same therapist transcript, the same
  state trace results — even though the model's wording varies. This is what
  makes the simulation defensible for research and certification.
- **Inspectable.** Persisted per turn, so the post-session assessment, ACE, and
  CGE stop guessing from prose and start reading ground truth.

---

## 1. Memory Engine — `src/lib/hce/memory/`

**Job:** the patient remembers what they said, what they hid, what the
therapist did, and — optionally — the last appointment.

Four tiers:

- **Working memory** — recent turns verbatim, token-budgeted rather than a
  fixed slice of 20.
- **Episodic memory** — structured per-turn records: disclosures made,
  therapist moves received, emotional peaks, promises, topics avoided.
- **Semantic memory** — the frozen `clinical_core` + `randomized_context` from
  the case snapshot. The patient's biography. Immutable.
- **Longitudinal memory** — `case_memory.memory` (already exists, keyed by
  `case_instance_id`, currently unused) activated when the template declares
  `memory_mode: longitudinal`. Follow-up sessions open with continuity.

Key mechanisms:

- **Disclosure ledger.** Promotes `clinical_core.disclosure_rules` from prompt
  prose to a live gate. Each topic is `locked → unlocked → revealed`, with
  unlock conditions evaluated in code against alliance score and therapist move
  type (`on_direct_question`, `on_empathic_rapport`, `on_safety_assessment`,
  `never`). This single change is what makes elicitation gradeable.
- **Consolidation.** Evicted turns are folded into a rolling digest during the
  *background tier* (see §8) instead of being dropped.
- **Contradiction guard.** A compact fact table is injected into the prompt and
  checked against each candidate reply. Catches "I have two kids" followed
  thirty turns later by "I don't have children."

---

## 2. Emotion Engine — `src/lib/hce/emotion/`

**Job:** a continuous affect model that reacts to the therapist and drives both
word choice and voice.

- **Dimensional core** — valence (−1..1), arousal (0..1), dominance (0..1),
  with a discrete label (sadness, anxiety, shame, anger, numbness, hope,
  irritation, relief) derived from region plus disorder prior.
- **Baseline per presentation** — MDD sits low-valence/low-arousal/flat; GAD
  neutral-valence/high-arousal; PTSD hypervigilant with startle spikes. Read
  from `clinical_core`.
- **Dynamics** — each turn: appraise the therapist move → apply a stimulus
  delta → **decay toward baseline** with a per-disorder time constant. Emotion
  has momentum. A patient hurt in turn 9 is still guarded in turn 12, which is
  precisely the thing trainees need to feel.
- **Emotional inertia** — high inertia is itself a depression marker, so the
  parameter is clinically meaningful, not just a smoothing constant.
- **Rupture and repair** — a large negative excursion flags an alliance
  rupture. Repair requires *sustained* empathic turns, not one apology.
  Ruptures and repair attempts are timestamped for the report.

Consumers: Behavior (how to speak), Voice (prosody), Director (whether to
disclose or withdraw), Clinical (validity), and an optional instructor-facing
affect timeline.

---

## 3. Clinical Engine — `src/lib/hce/clinical/`

**Job:** keep the simulation clinically valid and safe, and convert the frozen
snapshot into live constraints.

- **Symptom expression scheduler.** `symptom_profile` salience becomes
  behaviour: `presenting` surfaces unprompted, `elicited` only on relevant
  probing, `hidden` needs alliance plus direct inquiry. Tracks what was
  expressed and *how it was drawn out*, so the trainee is scored on what they
  actually elicited rather than what the model volunteered.
- **Risk state machine.** `not_probed → probed_deflected → partial →
  disclosed`, gated on disclosure rules and alliance. Hard invariants: never
  supply method or means detail; never escalate beyond `risk_profile`; at
  higher difficulty a missed cue is repeated *fainter*, not louder.
- **Diagnostic consistency validator.** Blocks criteria-reciting, spontaneous
  self-diagnosis, and symptoms outside the profile before emission.
- **Structural injection defence.** Instruction-shaped content in the therapist
  turn is neutralised in code, not merely discouraged by Module 4 prose.
- **Evidence emission.** Per-turn rows keyed to the existing competency IDs —
  `risk_screening`, `suicide_assessment`, `therapeutic_alliance`, `empathy`,
  `diagnostic_interview`, `mental_status_examination`. This is where HCE pays
  for itself: ACE and CGE currently infer these from a transcript.

---

## 4. Conversation Director — `src/lib/hce/director/`

**Job:** the orchestrator at the centre of the diagram. Owns the turn,
arbitrates the engines, and decides *what kind of response happens* before a
single token is generated.

Per turn:

1. **Ingest** the therapist utterance plus paralinguistics from the Voice
   Engine (pause before speaking, speech rate, energy, interruption flag).
2. **Appraise** the therapist move — open question, closed question,
   reflection, validation, interpretation, confrontation, premature advice,
   silence, interruption, risk probe, topic change, cultural misstep.
   Deterministic-first, refined by the model envelope.
3. **Advance** Emotion → Memory → Clinical in fixed order, pure functions.
4. **Choose a response plan:**
   - `act`: answer · deflect · minimise · ask-back · silence · somatic
     complaint · tangent · shutdown · tearful pause · disclose(topic) ·
     seek reassurance
   - `length`: enforced turn length, replacing the static prompt line
   - `disclosure_grants`: what is permitted to surface this turn
   - `affect_target`: the emotion to portray
   - `response_latency`: how long before the patient starts speaking — a
     depressed patient pauses, an anxious one jumps in. Free realism.
5. **Compile a prompt delta** — the static Modules 1–4 stay untouched; HCE
   appends **Module 5 (live state)** and **Module 6 (this-turn directive)**.
6. **Stream, validate, guard, emit** sentence-by-sentence to the Voice Engine.
7. **Commit** state and persist the trace.

**Turn-taking and barge-in.** If the trainee speaks over the patient, the
Director arbitrates by dominance: a deferential patient stops instantly, an
agitated one finishes the clause, a shut-down one trails off. Critically, the
persisted assistant message is then truncated to **the spoken prefix** — the
patient must only remember what the trainee actually heard, or memory and
experience diverge.

**Silence.** When the trainee says nothing, the Director decides whether the
patient waits (usually), fills the gap (anxious presentation), or breaks down.
This needs a channel for patient-initiated speech — see §9 on the DB turn-order
guard.

---

## 5. Behavior Engine — `src/lib/hce/behavior/`

**Job:** convert plan plus emotion into *how* the words come out. The surface
realism layer.

- **Disfluency model** — fillers, restarts, self-corrections, trailing off,
  word-finding pauses, sourced from `personality.speech.filler_words` and
  `verbal_tics`, scaled by arousal. Depressed: long pauses, short turns, low
  elaboration. Anxious: fast, run-on, over-explaining, reassurance-seeking.
- **Turn-length governor** — hard enforcement of the plan length with soft
  trim. Over-talking in polished paragraphs is the single biggest tell of an
  LLM patient.
- **Register drift** — formality from `cultural_context.authority_orientation`,
  loosening as alliance builds. Guarded and formal at minute 2; colloquial at
  minute 30 if the trainee earned it.
- **Idioms of distress** — `personality.idioms_of_distress` deployed
  contextually rather than sprinkled. The Arabic personas already carry rich
  culture-bound somatic phrasing that is currently underused.
- **Non-verbal channel** — structured cues (`sigh`, `long_pause`,
  `voice_breaks`, `looks_away`, `fidgets`) on a parallel track. Audible ones
  render as prosody breaks; visible ones drive subtle avatar state in the UI,
  which today shows nothing but "Speaking / Listening".

Output is a **performance script**: text segmented into chunks with per-chunk
prosody and pause directives — exactly the shape streaming TTS needs.

---

## 6. Voice Engine — `src/lib/hce/voice/`

**Job:** hear continuously, and speak with the emotion the state says.

**Input side**

- **Continuous capture with VAD.** Replace the `ScriptProcessorNode` +
  click-to-toggle with an AudioWorklet and energy/WebRTC VAD that endpoints on
  silence. (`ScriptProcessorNode` is also long-deprecated.)
- **Paralinguistics.** Emit pause-before-speaking, speech rate, mean energy,
  and interruption events into the Emotion Engine. A trainee who never pauses
  gets a different patient — which is true to life.
- **Streaming STT.** Move to a Realtime transcription session. Note a verified
  caveat: with `gpt-4o-transcribe`, deltas only arrive *after* the audio buffer
  is committed, so true partials require `gpt-live-transcribe`. Keep the
  existing batch path as the fallback, matching the codebase's existing
  fallback discipline.

**Output side**

- **Emotion → prosody.** Replace the two hardcoded constants with a function of
  the affect vector over `stability`, `similarity_boost`, `style`,
  `use_speaker_boost`, and `speed`. High arousal lowers stability; sadness
  slows speed; shame drops volume and style. Per-avatar baselines live in
  `voice_profiles`; per-turn deltas come from the state.
- **Model swap for live turns.** `eleven_flash_v2_5` — **verified to support
  Arabic**, ~75 ms inference and ~197 ms measured first-audio versus roughly
  1 s for the `eleven_multilingual_v2` in use today. Keep multilingual v2 for
  previews and cached lines where quality outranks latency.
- **Unset knobs.** `optimize_streaming_latency` and `output_format` are not
  currently sent at all.
- **Per-sentence synthesis** as the model streams, so audio begins after the
  first sentence rather than the last token.
- **Abortable playback** with a Web Audio queue, cancelling in-flight synthesis
  on barge-in and reporting the spoken prefix back to the Director.

---

## 7. Environmental Context — `src/lib/hce/context/`

**Job:** situate the conversation in a world, so the patient is not a
disembodied voice.

- **Temporal** — time of day, day of week, and position *within* the session.
  The existing 40-minute timer only counts down today; HCE gives it meaning.
- **Session phase controller** — opening (guarded, small talk), working
  (substance), closing (time pressure). The closing phase enables **doorknob
  disclosure**: the real, teachable phenomenon of the most important thing
  arriving with three minutes left.
- **Setting** — clinic type, first visit versus follow-up, referral route
  (self-referred versus family-pressured versus mandated — this transforms
  engagement), waiting time, who is in the waiting room.
- **Life context activation** — `randomized_context` already carries
  `recent_stressor`, `financial_situation`, `relationship_detail`,
  `minor_life_event`, `timeline_offset_weeks`. Today they are baked into prose
  and otherwise inert; HCE makes them situationally retrievable.
- **Cultural frame as situation, not text** — stigma, family involvement,
  prayer time, gendered clinician dynamics become live modifiers rather than
  static prompt lines.
- **Ambient interruptions** — phone buzz, clock-checking, corridor noise. Off
  by default, instructor-enabled at higher difficulty to test frame-holding.

---

## 8. GPT-5 Reasoning — `src/lib/hce/reasoning/`

**Job:** the language faculty, budgeted deliberately.

Current baseline: `OPENAI_CHAT_MODEL` defaults to `gpt-5`,
`OPENAI_REASONING_EFFORT` to `minimal`, temperature 0.85, 512 completion
tokens, **non-streaming**, with a failover chain of OpenAI → `gpt-4o-mini` on
429 → AI Gateway → persona fallback strings. **That chain is good and is
preserved verbatim.**

- **Tiered reasoning.**
  - *Reflex* (most turns): minimal effort, streaming. The engines already
    computed the plan, so the model only has to voice it. Moving state out of
    the model is what lets it run cheap and fast without losing depth.
  - *Deliberate*: raised effort for high-stakes moments — risk disclosure,
    rupture, major interpretation, opening and closing turns. The extra latency
    is diegetically free, because people pause before hard things.
  - *Background*: memory consolidation, consistency audits, and next-move
    anticipation **while the trainee is speaking**. Five to fifteen seconds per
    turn currently go unused.
- **Structured streaming envelope.** A small JSON prelude (affect delta, chosen
  act, disclosure requests, non-verbal cues) precedes the spoken text. The
  prelude arrives in a few hundred milliseconds; text then streams into TTS.
  The Director **validates and clamps** the model's self-report against what
  the engine permits — the model proposes, the engine disposes. A strict
  fallback covers non-compliance.
- **Speculative pre-generation** while the trainee talks: flagged off by
  default, enabled only if measurement shows it wins, since wasted branches
  cost tokens.
- **Guardrails** — schema validation, character-break detection, language-drift
  detection (the AR/EN never-translate rule is a hard requirement today), and
  the existing persona fallback so the system still runs with **no AI keys at
  all**, which existing tests enforce.

---

## 9. Streaming Voice Output — target pipeline

```
VAD endpoint
  → streaming STT partials
  → Director pre-warm (background tier, while trainee still speaking)
  → GPT-5 streaming: envelope → text tokens
  → sentence segmenter
  → per-sentence TTS (flash v2_5, optimize_streaming_latency, PCM)
  → client Web Audio queue → progressive playback
  → barge-in abort → spoken-prefix reconciliation
```

**Instrumentation first.** There is no timing anywhere in the voice path today,
so Phase 0 establishes a baseline before any optimisation claim is made. Metrics
recorded per turn: STT endpoint→final transcript, transcript→first token, first
token→first audio chunk, **time-to-first-audio**, total turn latency, and
barge-in stop latency, all at p50/p95.

Also handled: mobile Safari autoplay unlock on user gesture, jitter buffering,
Vercel function duration limits for long-lived streams, and a clean fall back to
today's blob path when streaming is unavailable.

---

## Data model

`session_messages` has exactly five columns, no UPDATE or DELETE policies, and a
certified RLS/RPC contract. **It will not be altered.** State goes in sidecar
tables keyed by session and message id.

One migration, `<14-digit>_human_conversation_engine.sql`:

| Table | Purpose |
|-------|---------|
| `hce_turn_state` | Per turn: affect vector, alliance, guardedness, phase, chosen act, plan jsonb, latency metrics, model/voice metadata |
| `hce_disclosure_ledger` | topic → state, unlocked_at_turn, revealed_at_turn, trigger |
| `hce_symptom_expression` | symptom_id, expressed_at_turn, elicited_by |
| `hce_events` | Non-message events: silence, barge-in, ambient event, safety trigger |

Additive, nullable, non-breaking changes: `voice_profiles.prosody_baseline
jsonb`; `sessions.hce_enabled`, `sessions.hce_version`, `sessions.hce_config`.
Longitudinal memory reuses the existing `case_memory.memory`.

**RLS.** Therapists read their own; admins read all; writes go through
SECURITY DEFINER RPCs granted to `authenticated` **and** `service_role`,
mirroring `insert_assistant_message` — which must keep working when the service
role key is unset, an invariant `architecture.test.ts` enforces.

**Turn-order guard — flagged now, not at build time.**
`insert_assistant_message` raises `'Assistant reply requires a preceding user
turn'`. Patient-initiated speech (silence-filling, a follow-up utterance) would
be rejected. Resolution: a sibling RPC with an explicit allowance, with
non-speech beats recorded in `hce_events` so the transcript contract is
untouched.

Migration parity requires only: unique 14-digit timestamp, lowercase snake_case
name, non-empty body.

---

## Module layout

```
src/lib/hce/
  types.ts          index.ts        state.ts        config.ts
  memory/           emotion/        clinical/       director/
  behavior/         voice/          context/        reasoning/
  telemetry/        simulate.ts     hce.test.ts
```

Follows the existing engine convention (`case-engine/`, `ace/`, `cge/`):
pure-function core, colocated tests, `simulate.ts` for deterministic scenario
replay, barrel export with no import cycles — the CGE/ACE cycle rule in
`architecture.test.ts` is the precedent.

---

## Phased delivery

Every phase ships independently behind `hce_enabled`, defaults off, and leaves
the current certified path intact.

| Phase | Scope | Proof it works |
|-------|-------|----------------|
| **0 — Baseline** | Timing instrumentation on the existing pipeline; feature flag; telemetry table. No behaviour change. | Recorded p50/p95 latency for today's turn loop |
| **1 — State spine** | `src/lib/hce/` types and reducers; migration; Emotion, Memory ledger, Clinical scheduler. Runs in **shadow mode** beside the live turn. | Unit tests plus a shadow trace over a real session |
| **2 — Director** | Response plan, Modules 5/6 prompt delta, appraisal. Still non-streaming. | Disclosure timing matches rules; turn length matches persona spec |
| **3 — Streaming** | Envelope parsing, sentence chunking, flash v2_5, progressive playback, barge-in. | Time-to-first-audio versus the Phase 0 baseline |
| **4 — Listening** | VAD, continuous capture, streaming STT, paralinguistics. | Endpoint accuracy; barge-in stop latency |
| **5 — Realism** | Behavior/prosody polish, Environmental Context, non-verbal UI channel. | Side-by-side session recordings |
| **6 — Feedback loop** | Structured trace into assessment, ACE, CGE; instructor affect timeline in admin reports. | Assessment agreement against the ground-truth trace |

---

## Invariants preserved

- Report signing (HMAC / `create_session_report`) and admin-only report reads.
- `session_messages` RLS: `role = 'user'` only for clients.
- Service-role-optional operation (`messageRpcClient` fallback).
- Persona fallback with zero AI keys configured.
- AR/EN never-translate rule and native-authoring parity.
- Frozen `clinical_snapshot` immutability — HCE reads it, never rewrites it.
- Existing security, functional, and architecture certifications.
- Full text-only mode, with HCE state active but voice bypassed.

---

## Testing

- **Unit** — reducers are pure and seeded; every state transition gets a table
  test. Emotion decay, disclosure gating, and the risk machine get explicit
  clinical fixtures.
- **Scenario replay** (`simulate.ts`) — canned therapist transcripts (cold
  interrogator, warm skilled clinician, rupture-then-repair, missed-risk) run
  headlessly and assert on the state trace. This is how patient behaviour gets
  regression-tested without an LLM in the loop.
- **Contract** — envelope schema validation, guard enforcement, RPC and RLS
  behaviour, migration parity.
- **Latency** — measured against the Phase 0 baseline, not asserted.
- **Manual** — recorded voice sessions in English and Arabic, exercising
  barge-in, silence, rupture, and late disclosure.

---

## Risks and open questions

| Risk | Mitigation |
|------|------------|
| Vercel function duration and buffering on long-lived streams | Prototype in Phase 3 before committing; per-sentence HTTP is the fallback to WebSocket |
| Model ignores the envelope schema | Strict parse, clamp, and fall back to plain-text mode for that turn |
| Cost rises from streaming plus the background tier | Background tier is flagged; measure tokens per session in Phase 3 |
| Over-modelling makes the patient feel robotic | Engine sets *constraints*, model retains expressive freedom; looseness scales with difficulty |
| Turn-order guard blocks patient-initiated speech | Sibling RPC plus `hce_events`, planned in §9 rather than discovered later |
| Arabic prosody quality on flash v2_5 | Arabic support is confirmed; **quality must be A/B'd against multilingual v2 before the swap is made default for `ar-JO`** |
| Regression in certified paths | Flag defaults off; shadow mode in Phase 1; full suite green per phase |

**Open questions for you:**

1. Is a WebSocket path acceptable on the current hosting, or should Phase 3
   stay on HTTP streaming?
2. Should the trainee see the non-verbal channel live (sighs, looking away), or
   is that instructor-only in the report?
3. Should longitudinal memory ship in v1, or wait until single-session realism
   is settled?
4. Latency versus Arabic voice quality — if flash v2_5 is audibly weaker in
   Jordanian Arabic, which wins?

---

## Success criteria

Measured, not asserted:

- Time-to-first-audio p50 and p95 versus the Phase 0 baseline.
- Barge-in stop latency.
- Disclosure-timing correctness against the declared rules (currently
  unmeasurable).
- Contradiction rate across 40-minute sessions.
- Turn-length distribution versus the persona specification.
- Character-break and language-drift rates.
- Agreement between assessment scores and the ground-truth HCE trace.

---

## Configuration

New environment variables, all optional with safe defaults:

```
HCE_ENABLED                    default off
HCE_STREAMING                  default off until Phase 3
HCE_BACKGROUND_TIER            default off
ELEVENLABS_REALTIME_MODEL_ID   default eleven_flash_v2_5
ELEVENLABS_STREAMING_LATENCY   optimize_streaming_latency
OPENAI_REALTIME_STT_MODEL      default gpt-live-transcribe
OPENAI_DELIBERATE_EFFORT       reasoning effort for high-stakes turns
```
