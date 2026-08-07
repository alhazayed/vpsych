# Institutional Deployment Checklist — CIDP

**Version:** `1.0.0-rc.1` · Use once per institution / campus cohort.

## A. Pre-flight (platform)

- [ ] Production deploy READY; SHA ≡ `origin/main`  
- [ ] Package version `1.0.0-rc.1` on `/api/health`  
- [ ] Migration remote parity PASS (`SUPABASE_DB_URL` + `npm run test:migrations`)  
- [ ] `institutional_feedback` migration applied  
- [ ] `REPORT_WRITE_KEY` or service role configured  
- [ ] AI + ElevenLabs keys present (or text-only pilot accepted)  
- [ ] Upstash Redis configured (recommended)  
- [ ] Feature flags default **off** (Therapy Room / Realtime chrome)  
- [ ] Credential Verification Gate PASS for audit accounts  
- [ ] Leaked-password protection enabled (ops residual closeout)

## B. Institution onboarding

- [ ] `institutions` row created (`tenant_type` set)  
- [ ] Campuses / departments as needed  
- [ ] Memberships: institution_admin, faculty/instructor, residents/therapists  
- [ ] Platform admin(s) for local IT (profiles.role = admin) sparingly  
- [ ] SSO metadata recorded if used (live IdP may be deferred)  
- [ ] Data retention / consent policy acknowledged  
- [ ] No real PHI workflow approved (fictional SPs only)

## C. Faculty readiness

- [ ] Faculty Guide distributed  
- [ ] Instructor presets / pathways agreed  
- [ ] Report access (admin) scoped to program directors  
- [ ] Supervisor AI expectations set (formative)  
- [ ] Feedback channel `/feedback` demonstrated  

## D. Resident readiness

- [ ] Resident Guide distributed  
- [ ] Login + preferred language verified  
- [ ] Sample text session completed  
- [ ] Optional voice session smoke  
- [ ] Learning / portfolio path explained  
- [ ] PHI prohibition acknowledged  

## E. Research readiness (if applicable)

- [ ] Research Guide + de-identification rules signed  
- [ ] Study metadata registered (enterprise research tables)  
- [ ] Export workflow exercised via admin research APIs  
- [ ] No narrative/report PHI in exports  

## F. IT / monitoring

- [ ] IT Operations Guide + Operations Manual reviewed  
- [ ] `/api/admin/ops/metrics` and `/api/admin/ops/cidp` reachable by admins  
- [ ] Alert contacts named (INCIDENT_RESPONSE)  
- [ ] Backup / PITR owner named  
- [ ] Secrets recovery path verified (names only in checklist)

## G. Go-live

- [ ] Pilot start date recorded  
- [ ] Support hours published  
- [ ] Critical incident path tested (page)  
- [ ] First-week observation metrics baseline captured  
- [ ] Pilot report template opened (`PILOT_REPORT_TEMPLATE.md`)

## H. Exit / promote

- [ ] Zero unresolved Critical clinical/ops issues  
- [ ] DR drill evidence attached (or deferred with Board waiver)  
- [ ] GA readiness reviewed — **do not** auto-promote to GA
