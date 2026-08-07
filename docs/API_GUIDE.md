# API Guide — Stage 10 Enterprise

## REST

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/enterprise/summary` | user | Tenant formative summary |
| GET | `/api/enterprise/certificates/verify?code=` | public | QR credential validation |
| GET | `/api/admin/enterprise` | admin | Control plane overview |

All authenticated routes rate-limit. Errors via `clientSafeError`.

## Webhooks

`createWebhookEndpoint` — events: `session.completed`, `certificate.issued`, `membership.changed`.  
Payloads signed with `signWebhookPayload(secret_ref, body)` (production should HMAC with vault secret).

## Integrations (abstracted)

| Kind | Status |
|------|--------|
| webhook / oauth / saml | ready |
| lms / fhir / hl7 / scorm / lti | abstracted |

FHIR/HL7 are **training-event** abstractions — not production clinical ADT/PHI chart sync.

## LMS / SCORM / LTI

Descriptors document grade passback, SCORM package manifests, and LTI 1.3 launch surfaces for subsequent vendor binding — no ownership of Case Engine or Assessment.
