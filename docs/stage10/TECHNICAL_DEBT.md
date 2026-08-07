# Stage 10 — Technical Debt

| ID | Item | Severity |
|----|------|----------|
| ENT-01 | Persist enterprise bundles to Postgres (currently process memory + durable certs table unused by API store) | Medium |
| ENT-02 | Wire live SAML/OIDC against a customer IdP | Medium |
| ENT-03 | Real HMAC webhook signing via vault secret | Medium |
| ENT-04 | Course builder WYSIWYG UI beyond admin overview | Low (product) |
| ENT-05 | LMS/SCORM/LTI vendor adapters | Medium |
| ENT-06 | FHIR/HL7 production clinical sync (explicitly out of scope — training abstractions only) | Info |
| ENT-07 | Stamp `sessions.institution_id` on session create from membership | Medium |
| ENT-08 | Multi-instance enterprise store → Redis/Postgres | Medium |
