# Analytics Architecture — Stage 10

**Code:** `src/lib/enterprise/analytics.ts` · `longitudinal.ts`

## Dashboards

| Scope | Audience |
|-------|----------|
| organization | Org admins |
| program | Program directors |
| department | Department leads |
| faculty | Faculty |
| resident | Residents |
| student | Students |
| supervisor | Clinical supervisors |
| research | Research coordinators |
| executive | Executives / platform |

## Inputs

Formative aggregates only: session counts, learner counts, mean overall (from assessment overall already computed), completion rate, certificate counts.  
Never invents diagnoses. Never returns session_reports narrative on therapist scopes.

## Longitudinal horizons

months · years · residency · board_prep · faculty_dev · cme · lifetime
