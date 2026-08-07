# Certification Engine — Stage 10

**Code:** `src/lib/enterprise/certification.ts`  
**Table:** `enterprise_certificates`

## Kinds

competency · course · university · board_prep · residency_milestone · osce · cme · digital

## Features

- Digital certificates with SHA-256 verification codes
- QR payload JSON (`v`, `code`, `org`, `kind`)
- Public verify API: `GET /api/enterprise/certificates/verify?code=`
- Revocation + expiry
- OSCE pass helper (conservative combined threshold)
- Board-prep readiness helper

## Boundaries

- Distinct from Stage 7 Education milestones and Stage 9 Supervisor certification progress.  
- Credentials are **educational / formative**, not clinical licenses.  
- Metadata always includes a non-validated disclaimer.
