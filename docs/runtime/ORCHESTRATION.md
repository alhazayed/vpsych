# Orchestration

**Canonical orchestration model:** Route Handler composition roots — not a distributed agent mesh.

---

## Composition roots

| Root | Path | Responsibility |
|------|------|----------------|
| **Create** | `POST /api/sessions` | Auth → rate limit → case mint → session row → system message |
| **Turn** | `POST /api/sessions/[id]/message` | Auth → rate limit → **one-mind turn** → persist |
| **End** | `POST /api/sessions/[id]/end` | Auth → rate limit → close → assess → aftercare → report → QL |
| **STT** | `POST /api/voice/transcribe` | Auth → rate limit → OpenAI STT |
| **TTS** | `POST /api/voice/tts` | Auth → rate limit → CVP → ElevenLabs |
| **Client voice** | `lib/voice/conversation-pipeline.ts` | STT → Turn → TTS orchestration in browser |
| **TRM FSM** | `lib/therapy-room/conversation-fsm.ts` | Hands-free state transitions (flag-gated) |

There is **no** central `CognitiveOrchestrator` class. Stage 4 documents the routes as the orchestrator.

---

## Turn orchestration contract

The Turn root **must** (current code):

1. Enforce auth, ownership, active status, timer.  
2. Run Adaptation before resolve (so Module 1 receives stance).  
3. Resolve avatar from **snapshot** (not live avatar diagnosis).  
4. Inject LTM before generating.  
5. Persist **user** message before Emotion/CBE (turnIndex uses history including user).  
6. Soft-fail Emotion, CBE, Humanization independently.  
7. Prefer `cbe_direct` when planned; else Patient Agent.  
8. Persist assistant only via `insert_assistant_message` RPC.  
9. Always expose `aiSource` (body + `X-AI-Source`).

**Must not:**

- Skip rate limiting.  
- Feed private notes into the patient agent.  
- Let soft engines throw out of the request.  
- Write reports on the turn path.  
- Mutate `clinical_snapshot`.

---

## End orchestration contract

1. Mark completed/expired.  
2. Idempotent exit if report exists.  
3. `assessSession` (hard path for scoring attempt).  
4. ACE ★ then LTM ★ (awaited, soft).  
5. Report write (hard if keys missing).  
6. QL seal ★.  
7. Never return report narrative to therapist client.

---

## Deterministic architectural behaviour

Same session inputs should yield the same **control-flow architecture**:

| Deterministic | Non-deterministic |
|---------------|-------------------|
| Engine call order | LLM token sampling (temp 0.85) |
| Soft-fail skip rules | Provider latency |
| Snapshot clinical fields | ElevenLabs audio bytes |
| CBE seeded plans (when RNG seeded) | Network errors |
| Rate-limit windowing | Multi-instance in-memory counters |

**Architectural determinism** ≠ bit-identical replies. Stage 4 requires predictable *orchestration*, not frozen GPT output.

---

## Scheduling & queues

| Mechanism | Role |
|-----------|------|
| HTTP request | Primary unit of work |
| `void saveAdaptationState` | Background-ish persist (same isolate) |
| `void playPatientSpeech` | Client non-blocking TTS |
| VQI pending[] | In-process, non-durable |
| Cron | Not used for session cognition |

---

## Concurrency model

- One Vercel serverless invocation per HTTP request.  
- No distributed lock around `case_memory`.  
- Overlapping turns from the same client are prevented primarily by UI FSM / disabling input — **not** by a server-side turn lock (RPC enforces assistant-after-user ordering).  
- Multi-tab concurrent messages can race (debt).
