# Engine Contracts

Per-runtime-subsystem contract card. Clinical field meaning lives in Stage 3 ontology; this file owns **runtime I/O and failure**.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ★ | Soft-fail / best-effort on session path |
| Hard | Failure aborts the HTTP request with error status |
| Ephemeral | Not persisted across requests |

---

## Case Engine (mint)

| | |
|--|--|
| **Inputs** | Avatar, optional disorder/template/preset/seed, locale |
| **Outputs** | `CaseInstanceSnapshot`, `case_instances` row, empty `case_memory` |
| **Ownership** | Immutable clinical snapshot |
| **State** | Frozen after mint |
| **Dependencies** | Templates, presets, personality freeze, disorder catalog |
| **Failure** | Hard on session create |
| **Recovery** | None mid-session; create new session |
| **Latency** | Once per session (create path) |
| **Cost** | DB only (no LLM at mint) |
| **Concurrency** | Per create request |
| **Lifecycle** | create → frozen → read-only |

## Avatar resolve / Prompt assembly

| | |
|--|--|
| **Inputs** | Avatar row, locale, `caseSnapshot`, optional `adaptationBlock` |
| **Outputs** | `ResolvedAvatar` (`system_prompt`, reinforcement, …) |
| **Ownership** | Prompt Modules 1–4 assembly (`prompt-engine` + resolve) |
| **State** | Stateless projection |
| **Dependencies** | Case snapshot, HPE format, case-engine fidelity formatters |
| **Failure** | Synthesizes from flat columns if personalities missing |
| **Latency** | CPU-bound; every turn |
| **Cost** | Tokens later via LLM |
| **Lifecycle** | Every message/end assessment resolve |

## Adaptation ★

| | |
|--|--|
| **Inputs** | Therapist message, prior `PatientAdaptationState` |
| **Outputs** | Updated state + `expressionBlock` |
| **Ownership** | `case_memory.memory.patient_adaptation` |
| **Dependencies** | None (self-contained) |
| **Failure** | Persist never throws; route `void` save |
| **Recovery** | Next turn reloads or creates default |
| **Concurrency** | Race vs Emotion on `case_memory` jsonb |
| **Lifecycle** | Per turn before resolve |

## Patient Memory (LTM) ★

| | |
|--|--|
| **Inputs** | Therapist/avatar ids, user message, system prompt |
| **Outputs** | Prompt with memory block; end: summarized store |
| **Ownership** | `patient_long_term_memory` |
| **Failure** | Catch → empty / `{ok:false}` |
| **Lifecycle** | Turn retrieve; end summarize |

## Emotion ★

| | |
|--|--|
| **Inputs** | Therapist message, disorder slug, elapsed, case_instance_id |
| **Outputs** | `EmotionState` + expression packet + prompt block |
| **Ownership** | `case_memory.memory.emotion` |
| **Failure** | Route try/catch; ephemeral if no case id |
| **Lifecycle** | After user message insert; before CBE |

## Conversation Behaviour (CBE) ★

| | |
|--|--|
| **Inputs** | History, turnIndex, difficulty, disorder, `therapistInterrupted?` |
| **Outputs** | Plan: `promptBlock` and/or `directReply` |
| **Ownership** | Ephemeral plan |
| **Flag** | `CBE_ENABLED` default on |
| **Failure** | Soft; continues without CBE |
| **Special** | `cbe_direct` skips LLM |
| **Lifecycle** | After emotion; before humanization/LLM |

## Humanization ★

| | |
|--|--|
| **Inputs** | Snapshot, history, case_memory read, elapsed |
| **Outputs** | `prompt_cue`, `per_turn_cue`, `voiceHints` |
| **Ownership** | Ephemeral; **read-only** case_memory |
| **Flag** | `HUMANIZATION_ENABLED` default on |
| **Failure** | Soft |
| **Gates** | Blocks unsafe behaviours under active risk |
| **Lifecycle** | Before reply generation (always in code, including before cbe_direct) |

## Patient Agent (LLM)

| | |
|--|--|
| **Inputs** | Resolved avatar + history + CBE reinforcement |
| **Outputs** | `{ text, aiSource, model?, errorKind? }` |
| **Ownership** | Reply text generation; always sets `aiSource` |
| **Dependencies** | OpenAI SDK / Gateway / persona fallback |
| **Failure** | Fallback text preferred; unexpected throw → route 502 |
| **Retries** | SDK maxRetries 3; app withOpenAIRetry 2; 429 → fallback model → gateway |
| **Timeout** | `OPENAI_TIMEOUT_MS` default 60s |
| **Tokens** | OpenAI `maxCompletionTokens` 512; Gateway `maxOutputTokens` 220 |
| **Streaming** | **None** (non-streaming completions) |
| **Lifecycle** | After humanization (unless cbe_direct) |

## Voice (STT / TTS / pipeline)

| | |
|--|--|
| **Inputs** | Audio / text + voiceHints / emotion |
| **Outputs** | Transcript; audio/mpeg stream |
| **Ownership** | Voice registry resolve; ElevenLabs cache |
| **Dependencies** | OpenAI STT; ElevenLabs; CVP modulation |
| **Failure** | Missing keys → unavailable; client may use speechSynthesis |
| **Timeout** | Server ElevenLabs fetch: **no AbortSignal** today |
| **Streaming** | TTS HTTP body stream only |
| **Lifecycle** | Client: STT → message → TTS |

## Clinical Voice (CVP)

| | |
|--|--|
| **Inputs** | Voice profile + clinical emotion |
| **Outputs** | Effective delivery params for TTS |
| **Ownership** | Transform only; DB rows via admin |
| **Lifecycle** | TTS path |

## NBE / Animation

| | |
|--|--|
| **Inputs** | Emotion / affect snapshot |
| **Outputs** | Nonverbal timeline |
| **Ownership** | Client scheduler (TRM) |
| **Persist** | None |
| **Lifecycle** | TRM UI |

## Therapy Room / FSM

| | |
|--|--|
| **Inputs** | Mic/VAD events, API results |
| **Outputs** | FSM state; private notes APIs |
| **Ownership** | Client FSM + clinic DB when flag on |
| **Flag** | `NEXT_PUBLIC_THERAPY_ROOM_MODE` / VMHC flags |
| **Failure** | Soft immersion; classic VoiceSession default |
| **Lifecycle** | See `STATE_MACHINE.md` |

## Assessment / Reporting

| | |
|--|--|
| **Inputs** | Transcript + resolved avatar |
| **Outputs** | Scores + narrative → `session_reports` |
| **Ownership** | Assessment write path; admin-only read |
| **Failure** | Hard if no REPORT_WRITE_KEY / service role |
| **Idempotency** | `session_has_report` |
| **Lifecycle** | End route after status update |

## ACE / CGE ★

| | |
|--|--|
| **Inputs** | Assessment scores |
| **Outputs** | Learner updates / remediation |
| **Failure** | `runAceAfterAssessment` never throws |
| **Lifecycle** | After assess, before/around report (awaited before report write) |

## Quality Ledger ★

| | |
|--|--|
| **Inputs** | Assessment + snapshot |
| **Outputs** | Sealed ledger; VQI in-process queue ping |
| **Failure** | Soft; memory fallback |
| **Lifecycle** | After report write |

## Auth / Session / Rate limit / Persistence RPCs

| Subsystem | Contract highlight |
|-----------|-------------------|
| Auth | Middleware + getUser / requireApi* |
| Session timer | `MAX_SESSION_SECONDS` 40 min; expire → 409 |
| Rate limit | Per-user hourly budgets; Upstash or memory |
| Message RPCs | Ownership, active, turn-order; Hard on fail |
| Security audit | Best-effort RPC; admin deny path |

## Living Environment

| | |
|--|--|
| **Runtime status** | **No engine** — prose on Module 2 / RandomizedContext (Stage 3) |
| **Orchestration** | Not a turn step |

## Realtime / Queueing / Scheduling

| | |
|--|--|
| **Realtime** | Absent (no WS/SSE product path) |
| **Queue** | VQI in-process only — not durable |
| **Scheduler** | No session runtime cron |
