# Institutional Pilot Operations

**Supports:** universities · medical schools · psychiatry residencies · teaching hospitals · mental health centers · research institutions

## Principles

1. Complete **tenant isolation** (`institution_id` / enterprise org boundaries).  
2. Preserve **institutional independence** — no cross-tenant analytics except executive platform views.  
3. Record **deployment metadata** per organization (checklist + pilot portfolio).  
4. Never expose PHI; fictional standardized patients only.

## Operating surfaces

| Artifact | Path |
|----------|------|
| Deployment checklist | `../cidp/INSTITUTIONAL_DEPLOYMENT_CHECKLIST.md` |
| Pilot report template | `../cidp/PILOT_REPORT_TEMPLATE.md` |
| Pilot portfolio façade | `src/lib/ops/cidp-pilot.ts` |
| Admin dashboards | `/admin/cidp` |

## Institution types (pilot registry)

`university` · `residency` · `teaching_hospital` · `mental_health_center` · `research`

## Status lifecycle

`planned → onboarding → active → observation → completed` (or `paused` / `withdrawn`)

## Freeze rule

Pilot ops may change runbooks, memberships, and evidence logs. They must **not** change Clinical Core, patient cognition, or Assessment formulas.
