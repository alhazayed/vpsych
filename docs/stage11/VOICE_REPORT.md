# Voice Report — Stage 11

Classic STT→message→TTS path unchanged as default. Realtime Voice Gateway adds capture/VAD/interrupt/reconnect/quality adaptation. `therapistInterrupted` now wired through `submitConversationTurn` (closes client gap RT-06 for realtime callers). Provider streaming helpers (`chatStream`, `generatePatientReplyStream`) are additive.
