# Scalability Report — Stage 11

Realtime remains serverless-friendly: no long-lived media SFU in v1; SSE adapters are request-scoped; rate limits apply to stream + classic message paths. Metrics store is process-local (document debt for multi-instance aggregation). Cognition path unchanged — stream adapter does not double LLM generation beyond the classic turn it invokes.
