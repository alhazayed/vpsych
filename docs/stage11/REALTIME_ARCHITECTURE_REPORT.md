# Realtime Architecture Report — Stage 11

**Verdict:** Stage 11 ships a presentation-only realtime layer (`lib/realtime`) that extends Voice, NBE, and Therapy Room without forking patient cognition.

## Delivered

- Voice Gateway, streaming audio, mic/speaker pipelines, turn detection, interrupts, latency controller, buffers, VAD/silence, reconnect, quality adaptation  
- LLM streaming control plane + SSE adapter over classic message path  
- Avatar controller + nonverbal sync + voice personality  
- Multilingual media helpers (EN/AR/mixed, RTL, bidirectional lines)  
- Session experience chrome (waiting room, monitors, pause/resume, emergency end)  
- Observability, accessibility, security helpers  
- Soft-fail `runRealtimeAfterAssessment` on session end  
- Architecture ownership guards + colocated tests  

## Ownership preserved

Patient engines (Case, Emotion, Adaptation, CI, CBE, Patient Agent, Assessment, Education, Validation, Supervisor, Enterprise) remain sole cognition/tenancy owners.
