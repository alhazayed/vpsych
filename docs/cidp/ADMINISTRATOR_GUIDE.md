# Administrator Guide — Controlled Institutional Deployment

**Audience:** Institution / program administrators  
**Version:** `1.0.0-rc.1`

## 1. Installation overview

VPsych is a hosted multi-tenant application (Vercel + Supabase). Institutions do **not** install Clinical Core locally. Platform engineering owns deploy; administrators configure tenancy and users.

See also: `../DEPLOYMENT_GUIDE.md`, `IT_OPERATIONS_GUIDE.md`.

### Typical setup steps

1. Confirm platform production health (`/api/health`).  
2. Create institution + campuses/departments (Enterprise admin).  
3. Invite faculty and residents; assign `institution_memberships`.  
4. Grant platform `admin` only to trusted program/IT leads.  
5. Configure preferred languages (en / ar).  
6. Confirm report generation keys with platform ops.  
7. Run a smoke session (text) before cohort launch.

## 2. Configuration

| Area | Where | Notes |
|------|-------|-------|
| Tenant type | `institutions.tenant_type` | university / hospital / clinic / … |
| SSO | `sso_enabled` + metadata | Abstracted; confirm with IT before go-live |
| Feature flags | Env (platform) | Therapy Room / Realtime off by default |
| Rate limits | Platform Upstash | Expect 429 under burst testing |
| Locale | `locale` cookie + profile language | Arabic is RTL; personalities are native |

## 3. User roles

| Layer | Values | Purpose |
|-------|--------|---------|
| Platform | `therapist` · `admin` | Gates `/admin` and report reads |
| Enterprise membership | institution_admin, instructor/faculty, supervisor, research_coordinator, therapist/resident, … | Tenant RBAC |

Administrators should prefer **enterprise membership roles** for day-to-day faculty; reserve platform `admin` for report libraries and system dashboards.

## 4. Institution onboarding

1. Collect legal entity name, campus list, department list.  
2. Nominate institution_admin + IT contact.  
3. Define pilot cohort size and observation window.  
4. Distribute Faculty / Resident / Research guides.  
5. Enable feedback at `/feedback`.  
6. Baseline CIDP dashboard (`/admin/cidp`).

## 5. Backup

Database backups and PITR are platform-operated (Supabase). Administrators:

- Confirm backup owner with IT.  
- Never store secrets in local spreadsheets.  
- Request restore drills via `DISASTER_RECOVERY_REPORT.md` evidence forms.

## 6. Monitoring

- System/clinical/institution/research/security KPIs: `/admin/cidp`  
- Env & latency budgets: `/admin/ops` metrics API  
- Security denials: audit events (admin)  
- Feedback queue: `/admin/feedback`

## 7. Security responsibilities

- Enforce no-PHI policy for trainees and faculty.  
- Review RBAC quarterly.  
- Report auth anomalies via institutional feedback (severity Critical/High).  
- Do not share service-role keys with faculty.

## 8. What administrators do **not** control

- Patient cognition, diagnoses, or Clinical Core prompts.  
- Assessment scoring formulas.  
- Direct therapist access to session reports (by design).
