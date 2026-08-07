# Production Metrics Catalog

## System

API latency · Realtime latency · LLM latency · Voice STT/TTS latency · Avatar latency · Memory/CPU/Network (host APM) · Database response · Tenant utilization · Session duration · Drop rate · Reconnect rate · Error rate · Queue length · Failure reasons

## Clinical (formative / observational)

Session completion · Patient realism (feedback) · Therapist performance (admin reports — **unvalidated**) · Assessment accuracy (**unvalidated**) · Supervisor agreement · Validation consistency · Education completion · Learning progression · Curriculum completion · Certification success · Longitudinal improvement

## Research (observational)

Inter-rater agreement · DSM consistency · ICD consistency · Expert agreement · Case/behavior/conversation realism · Outcome stability · Benchmark performance

## Collection

- Telemetry: `recordTelemetry` / session simulation helpers  
- Feedback: `institutional_feedback`  
- Dashboards: `buildGaDashboards()`  
- Prior engines: quality ledger, validation, supervisor, education, enterprise observability
