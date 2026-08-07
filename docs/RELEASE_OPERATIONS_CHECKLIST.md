# Release Operations Checklist

Recurring runbook for Release Managers. Complements `OPERATIONS_RUNBOOK.md` and `cidp/OPERATIONS_MANUAL.md`.

## Before every certification wave

- [ ] Production SHA ≡ `origin/main`  
- [ ] Migration parity (git ≡ remote)  
- [ ] Vault `VPSYCH_AUDIT_*` injected and **manually** proven on production login  
- [ ] Credential Verification Gate PASS  
- [ ] Feature flags safe defaults  

## Before CIDP cohort go-live

- [ ] `docs/cidp/INSTITUTIONAL_DEPLOYMENT_CHECKLIST.md` completed for the institution  
- [ ] Feedback + CIDP dashboards reachable by admins  
- [ ] Support contacts published  

## Before GA (all required)

- [ ] `docs/cidp/GA_READINESS_REPORT.md` all PASS  
- [ ] DR / PITR evidence signed  
- [ ] Security residuals closed or Board-waived (no open Critical clinical)  
- [ ] RDL row authorizes `v1.0.0`  
- [ ] Tag + GitHub Release  

## After every production deploy

- [ ] Health check  
- [ ] Unauthenticated API JSON 401 smoke  
- [ ] Record deploy id if material  
