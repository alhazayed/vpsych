# Faculty Guide — Controlled Institutional Deployment

**Audience:** Faculty · instructors · program directors · clinical supervisors  
**Version:** `1.0.0-rc.1`

## Session creation

1. Sign in (institution credentials or platform auth).  
2. Open **Patient Library** (`/avatars`).  
3. Select a standardized patient (fictional).  
4. Start a text or voice session.  
5. Sessions hard-expire at **40 minutes** server-side — end deliberately.  
6. Prefer instructor presets / pathways when your program has configured them.

Locale: English and Arabic UIs; patient personalities are **natively authored** per locale — never machine-translated diagnoses.

## Curriculum

- Adaptive Curriculum Engine (ACE) and Competency Graph (CGE) provide formative pathways.  
- Enterprise courses/rotations (Stage 10) may map to institutional programs.  
- Faculty observe and assign; engines do not rewrite patient clinical state.

## Assessments

- After session end, the platform generates an **admin-only** performance report.  
- Scores are **formative educational signals**, not validated high-stakes credentials.  
- Do not use scores alone for promotion or licensing decisions.

## Supervisor AI

- Supervisor AI evaluates **therapist** performance and portfolio artifacts.  
- It never changes the patient’s mind, memory, or diagnosis.  
- Use supervisor outputs for coaching conversations with residents.

## Analytics

- Program KPIs appear in Enterprise and CIDP dashboards (counts, completion rates).  
- No patient-identifiable information is shown on CIDP executive views.  
- Research exports are observational and de-identified — see Research Guide.

## Certification

- Organizational certificates (course / residency milestone / OSCE helpers) are enterprise-issued.  
- Platform competency scores ≠ board certification.  
- Document any local certification mapping outside VPsych if required by your GME office.

## Research export

- Coordinate with research coordinators and admins.  
- Use Quality Ledger / research admin tools — never paste transcripts into public channels.  
- Follow `RESEARCH_GUIDE.md` de-identification rules.

## Feedback

Submit structured pilot feedback at `/feedback` (role: **faculty**). Include severity, category, reproducibility, suggested action. No PHI.
