# Enterprise Audit — Section J (ERI-Enterprise)

**Audit:** VEA-2026-08-05 · Production SHA `5aae138` · Observational only

## What exists

| Capability | Status | Evidence |
|---|---|---|
| Institution / cohort schema | Partial | Migrations `enterprise_institutional_foundation_m18`, session tenancy m23 |
| App RBAC | Binary | `profiles.role` therapist \| admin |
| Enterprise role enum | Schema | student…institution_admin — not full app UX |
| SSO | Scaffolding | `sso_enabled` default false; no SAML/OIDC integration code |
| Admin surfaces | Present | reports, avatars, voices, cases, templates, presets, curriculum, graph |
| Licensing | Absent | No licensing module found |
| LTI/SCORM | Absent | Not found |
| Analytics | Partial | ACE analytics; no full institutional BI |
| Deployment | Vercel + Supabase | Production healthy |
| Supportability | Partial | `/api/health`; limited SIEM |

Architecture certification historically: multi-tenant isolation **Partial**.

---

## Dimension scores

| Dimension | Score |
|---|---:|
| Institution management | 50 |
| Administration | 68 |
| Analytics | 45 |
| Reporting | 60 |
| Licensing | 15 |
| Role management | 42 |
| Audit logs | 58 |
| Integration readiness | 30 |
| Deployment readiness | 72 |
| Supportability | 55 |

---

## Enterprise Readiness Index (ERI-E)

**ERI-E = 48 / 100**

Suitable for single-program pilots with manual ops. Not ready for multi-institution commercial rollout.

---

## Findings

| ID | Sev | Finding | Root cause | Impact | Priority |
|---|---|---|---|---|---|
| ENT-H1 | High | No hard multi-tenant isolation | Partial tenancy | Cross-tenant risk if multi-org | P1 |
| ENT-H2 | High | No licensing / seat model | Product gap | Commercial blocker | P1 |
| ENT-H3 | High | SSO not implemented | Flags only | University procurement blocker | P1 |
| ENT-M1 | Medium | Faculty roles ≠ app roles | Dual model | Instructor friction | P2 |
| ENT-M2 | Medium | Support/on-call runbooks thin | Early stage | MTTR risk | P2 |

---

## Recommendations

| Rec | Impact | Priority |
|---|---|---|
| Define tenancy threat model + enforce `institution_id` on all learner data paths | Safety | P1 |
| SSO (SAML/OIDC) for one launch customer | Procurement | P1 |
| Minimal licensing (seats + term) | Commercial | P2 |
| Instructor role in app shell (not only admin) | Usability | P2 |
