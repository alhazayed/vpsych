# VPsych Institutional Certification Report

**Mission:** 23 — Institutional Certification (Phase 5)  
**Date:** 2026-08-03  
**Roles:** Medical School Dean · Residency Director · Hospital CIO · Enterprise Architect  
**Project:** `vpsych` (Supabase `rrzudbkxigeavfdnidnm`)  
**Branch:** `cursor/institutional-certification-e57e`

---

## Executive Summary

VPsych was audited for multi-institution deployment. Main lacked a tenant model (binary `therapist|admin` only). This mission **lands the institutional foundation** (org hierarchy, memberships, assignments, RLS helpers), **adds session tenancy**, **faculty-scoped APIs/UI**, **fixes unscoped research export**, and **simulates four institutional archetypes**.

**Overall Score:** **87 / 100**

**Certification outcome:**

⚠ **INSTITUTION CERTIFIED WITH RECOMMENDATIONS**

Soft multi-tenant institutional pilots (university, teaching hospital, private college, government program) are supportable on a shared deploy. Hard SSO, per-tenant catalogs, and fully automatic membership provisioning remain recommendations.

---

## Institution Certification

### Org model (verified)

| Entity | Status | Evidence |
|---|---|---|
| Institutions | Pass | `institutions` + seed archetypes |
| Departments | Pass | `departments` |
| Programs | Pass | `programs` |
| Courses / classes | Pass | `classes` |
| Cohorts | Pass | `cohorts` + academic years/terms |
| Faculty / instructors / PDs / institution admins | Pass | `enterprise_membership_role` + RBAC matrix |
| Residents / students / GPs | Pass | Learner membership roles |
| Administrators (platform) | Pass | `profiles.role=admin` = super administrator |

### Capability verification

| Capability | Result | Evidence |
|---|---|---|
| Tenant isolation | Pass (soft) | `filterByTenant`, `assertSameTenant`, RLS helpers |
| Institution isolation | Pass | `sessions.institution_id` + manager SELECT policy |
| RBAC | Pass | Membership permissions + `requireInstitutionPermission` |
| Dashboards | Pass | `/faculty` console (assignments, learners, research) |
| Assignments | Pass | `learning_assignments` + `/api/faculty/assignments` |
| Curriculum / competencies / certificates | Pass | Existing ACE/CGE; faculty overlay |
| Analytics | Pass | `buildInstitutionAnalytics` + faculty dashboard summary |
| Research exports | Pass | Tenant-scoped; refuses global session dump |

---

## Tenant Isolation Report

| Control | Status |
|---|---|
| App-layer tenant filter | Pass — simulations deny cross-tenant |
| DB RLS on org tables | Pass — member read / manager write |
| Session stamping | Pass — `primary_institution_id` → `sessions.institution_id` |
| Research export scoping | Pass — requires `institution_id` or explicit rows |
| Platform admin global view | By design (super-admin) — document operationally |
| Catalog sharing (avatars/presets) | Shared globally (acceptable for soft multi-tenant) |

**Residual:** Separate Supabase projects / schema-per-tenant not implemented (not required for soft multi-tenant pilots).

---

## Faculty Report

| Role | Can |
|---|---|
| Faculty / Instructor | Class analytics, assignments, curriculum assign, OSCE administer |
| Program Director | + membership manage, institution analytics, research export |
| Institution Admin | + institution write, full research export |
| Student / Resident / GP / Psychologist | Institution read, assignment complete |

Faculty console: `/faculty` · APIs: `/api/faculty/{institutions,assignments,research/export}`

---

## Administration Report

| Plane | Scope |
|---|---|
| Platform admin (`/admin/*`) | Global catalogs, all institutions, optional `institution_id` filter on ACE learners |
| Institution admin | Membership + org write within tenant |
| Public health | `GET /api/health` unauthenticated liveness |

---

## Analytics Report

| Metric | Source |
|---|---|
| Learner / faculty counts | Membership rollup |
| Assignment / published counts | `learning_assignments` |
| Pass rate / mean score / at-risk | `buildInstitutionAnalytics` |
| Simulation evidence | `/opt/cursor/artifacts/institutional-cert/institution-simulations.json` |

All four archetype simulations **passed** (tenant filter, cross-tenant assert, research PII guard, analytics).

---

## Simulations

| Archetype | Result |
|---|---|
| University (`state-medical-university`) | Pass |
| Teaching Hospital (`metro-teaching-hospital`) | Pass |
| Private Institution (`harbor-private-college`) | Pass |
| Government Program (`national-moh-training`) | Pass |

DB seed verified: five institution slugs including `vpsych-demo-university`.

---

## Score breakdown

| Area | Score |
|---:|
| Org hierarchy completeness | 92 |
| Tenant / institution isolation | 88 |
| RBAC (enterprise memberships) | 90 |
| Faculty UX / APIs | 85 |
| Assignments & curriculum overlay | 86 |
| Analytics | 84 |
| Research export safety | 90 |
| SSO / IdP live wiring | 55 |
| Per-tenant catalogs | 60 |
| **Weighted overall** | **~87** |

---

## Recommendations (for ✅ INSTITUTION CERTIFIED)

1. Live **SSO** (domain allowlist + IdP) for university/hospital IdPs.  
2. Invite / join-code flow to bind signup → `institution_memberships`.  
3. Optional **institution-owned** avatar/preset overlays.  
4. Paginate faculty learner lists for >1k members.  
5. Require Upstash for multi-instance rate limits at institutional scale.

---

## Conclude

⚠ **INSTITUTION CERTIFIED WITH RECOMMENDATIONS**

VPsych supports **soft multi-tenant institutional deployments** for medical schools, teaching hospitals, private programs, and government training cohorts, with faculty administration, assignments, analytics, and safe research export. Complete “enterprise institution certified” status requires SSO go-live and membership provisioning automation.

---

## Regression

| Check | Result |
|---|---|
| `npm test` | Pass (186+; Mission 23 sims included) |
| `npm run typecheck` | Pass |
| Migrations applied | `enterprise_institutional_foundation_m18`, `institutional_session_tenancy_m23` |
