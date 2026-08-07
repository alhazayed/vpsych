# Streaming Engine — Stage 11

**Code:** `src/lib/realtime/llm-streaming.ts`, `stream-message.ts`, `client-pipeline.ts`  
**Patient stream APIs:** `generatePatientReplyStream`, `openAIService.chatStream`

## Goals

| Capability | Support |
|------------|---------|
| Streaming token output | Token controller + SSE events |
| Partial response rendering | `partial` / `token` events |
| Incremental speech generation | `chunkTextForSpeech` + speaker queue |
| Streaming interruption | AbortSignal + `interrupted` events |
| Resume generation | `resume()` marker on controller |
| Network recovery | Stream route falls back; `withStreamRetry` |
| Timeout recovery | AbortController deadline in retry helper |
| Retry logic | Exponential backoff attempts |
| Backpressure handling | Event high-water + audio buffer pause |

## SSE route

`POST /api/sessions/:id/message/stream`

1. Auth + rate limit (`msg-stream`)  
2. Requires `isRealtimeStreamingEnabled()`  
3. Invokes **classic** `POST /message` (cognition SSOT)  
4. Progressively emits tokens for UI / TTS scheduling  
5. Emits `done` with the classic JSON payload (+ `streamed: true`)

This avoids forking Adaptation / Emotion / CBE / DecisionPlan / Humanization.

## Provider streaming (additive)

`generatePatientReplyStream` mirrors prompt construction of `generatePatientReplyDetailed` and streams OpenAI / Gateway tokens. Available for deeper mid-generation integration once a shared `session-turn` extract lands (see technical debt RT-04 / RT-S11-01).

## Client

`submitStreamingConversationTurn()` parses SSE and surfaces `onToken` / `onDone` / `onError`.
