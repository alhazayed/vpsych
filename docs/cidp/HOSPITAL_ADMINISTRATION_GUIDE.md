# Hospital Administration Guide — CIDP

**Audience:** Hospital / health-system administrators · compliance · clinical education offices  
**Version:** `1.0.0-rc.1`

## Installation

VPsych is hosted (Vercel + Supabase). Hospitals do not install Clinical Core on-prem. Coordinate with institutional IT and the platform Release Manager for tenant creation.

See `ADMINISTRATOR_GUIDE.md` and `IT_OPERATIONS_GUIDE.md`.

## Security

- Platform RBAC (`therapist` / `admin`) plus enterprise memberships.  
- Session reports are **admin-only**.  
- No real patient PHI in simulations — fictional standardized patients only.  
- Feedback channel rejects obvious PHI patterns.  
- Security evidence: `SECURITY_REPORT.md` + `evidence/security/`.

## Compliance

- Training / educational use under institutional agreements.  
- Competency scores are **not** validated clinical instruments.  
- Research exports require research coordinator + protocol.  
- Consent / retention settings live in enterprise compliance tables (Stage 10).

## Operations

- Daily/weekly ops: `OPERATIONS_MANUAL.md`.  
- Dashboards: `/admin/cidp`.  
- Incidents: `../INCIDENT_RESPONSE.md`.  
- DR: `DISASTER_RECOVERY_REPORT.md` (drill still required for GA).

## User provisioning

1. Create institution / campus / department.  
2. Invite faculty (enterprise instructor/faculty roles).  
3. Invite residents (therapist membership).  
4. Limit platform `admin` to program directors / IT leads.  
5. Distribute Faculty and Resident guides.  
6. Confirm `/feedback` is reachable.
