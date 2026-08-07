# Engine Interactions

Who may call whom. Based on static imports + route orchestration.

---

## Allowed interactions

```mermaid
flowchart TB
  RouteMsg[message route]
  RouteEnd[end route]
  RouteCreate[sessions create]
  VoiceClient[conversation-pipeline client]
  TRM[TherapyRoomSession]

  RouteCreate --> Case[case-engine]
  RouteMsg --> Adapt[adaptation]
  RouteMsg --> Resolve[avatars/resolve]
  Resolve --> Prompt[prompt-engine]
  Resolve --> Case
  Resolve --> HPE[personality-engine]
  RouteMsg --> LTM[patient-memory]
  RouteMsg --> Emo[emotion]
  RouteMsg --> CBE[conversation-behaviour]
  RouteMsg --> Hum[humanization]
  RouteMsg --> Agent[patient-agent]
  Agent --> Provider[ai/provider + openai]
  RouteEnd --> Assess[assessment]
  RouteEnd --> ACE[ace]
  RouteEnd --> LTM
  RouteEnd --> QL[quality-ledger]
  ACE --> CGE[cge via ace-bridge]
  VoiceClient --> STT[/api/voice/transcribe]
  VoiceClient --> RouteMsg
  VoiceClient --> TTS[/api/voice/tts]
  TTS --> CVP[clinical-voice]
  TTS --> Voice[voice/elevenlabs]
  TRM --> VoiceClient
  TRM --> NBE[nbe]
  Hum --> Voice
```

---

## Forbidden interactions (architectural)

| Forbidden | Reason |
|-----------|--------|
| CGE barrel re-exporting `ace-bridge` | Recreates import cycle — architecture test |
| Emotion writing Adaptation keys | Ownership |
| Adaptation writing Emotion keys | Ownership |
| Private notes → patient message body | architecture test |
| Template/culture rewriting DSM/ICD at runtime | Case invariant |
| Metric engines importing `scientific/score` corpora into hot path | Coupling / latency |
| Client inserting `role=assistant` messages | RLS / RPC only |
| Therapist API returning report body on end | Security |
| Engines calling Patient Agent directly bypassing route | Loses auth, rate limit, persist order |

---

## Peer-to-peer engine calls

**Finding:** Turn engines do **not** call each other. The route calls them sequentially. The only notable engine→engine edges off the hot path:

| From | To | Purpose |
|------|-----|---------|
| ACE | CGE ace-bridge | Post-assessment remediation |
| Humanization | voice/prosody (types/helpers) | Voice tick |
| CVP | voice/prosody | Delivery |
| NBE | therapy-room types | Animation bridge |
| resolve | case-engine formatters, HPE, prompt-engine | Assembly |
| quality-ledger | metric engines | Seal |

---

## Prompt coupling (allowed injectors)

| Injector | Slot | Timing |
|----------|------|--------|
| Adaptation | Module 1 adaptation_block via resolve | Before assemble |
| Case fidelity | Module 1 speech/difficulty/therapy-process | Assemble |
| LTM | Append after assemble | After resolve |
| Emotion | Append expression block | After user insert |
| Humanization | System cue + per-turn cue | Before LLM |
| CBE | User-turn reinforcement or directReply | Before/instead of LLM |

---

## Hidden coupling

| Coupling | Detail |
|----------|--------|
| Prompt string concatenation order | Load-bearing for “one mind” coherence |
| `case_memory` shared row | OWN-01 race |
| Headers `X-AI-Source` / `X-CBE-*` | Clients may depend |
| Humanization reads raw memory | Skips typed Emotion/Adaptation APIs |
| Assessment history window | Last messages only — separate from patient-agent last-20 |
