# Enterprise Architecture — Stage 10

**Status:** Implemented · Needs Human Review  
**Code:** `src/lib/enterprise/`  
**Migration:** `supabase/migrations/20260807180000_enterprise_platform_stage10.sql`  
**Principle:** Multi-tenant control plane. **Never modify the patient.**

## Mission

Transform VPsych into an enterprise training platform for medical schools, psychiatry residencies, hospitals, mental health centers, licensing boards, government programs, and international universities — without redesigning Stages 1–9 or forking patient engines.

## Ownership

| Concern | Owner | Stage 10 role |
|---------|-------|---------------|
| Patient mind / DecisionPlan / snapshot | Case Engine + Clinical Intelligence | **Forbidden** |
| Emotion / Adaptation / Memory | Emotion · Adaptation · LTM | **Forbidden** |
| Session overall / rubric scores | Assessment | Read-only formative input |
| Trainee education | Education (Stage 7) | Compose competency ids into courses |
| Scientific metrics | Validation (Stage 8) | Optional research export keys |
| Therapist skill supervision | Supervisor (Stage 9) | Distinct from org certificates |
| Tenancy · RBAC · courses · org certs · analytics · research metadata · webhooks · observability | `lib/enterprise` | Authoritative enterprise layer |

## Extends (does not replace)

- Mission 18 `institutions` / memberships / assignments
- Mission 23 `sessions.institution_id` tenancy stamp
- Stage 7 course competency mapping (references ids only)
- Existing `security_audit_events` (complements with `enterprise_audit_events`)

## Modules

| Module | File |
|--------|------|
| Types / version | `types.ts`, `versions.ts` |
| RBAC | `rbac.ts` |
| Tenant isolation | `tenant.ts` |
| Organization hierarchy | `organization.ts` |
| Course engine | `course-engine.ts` |
| Certification | `certification.ts` |
| Case libraries | `case-libraries.ts` |
| Analytics | `analytics.ts` |
| Longitudinal | `longitudinal.ts` |
| Research | `research.ts` |
| Observability | `observability.ts` |
| Security | `security.ts` |
| API contracts | `api-contracts.ts` |
| Engine / bridge | `engine.ts`, `session-bridge.ts` |

## Runtime

```
POST /api/sessions/:id/end
  → assess → education → validation → supervisor
  → runEnterpriseAfterAssessment()   // soft-fail; never blocks report
```

```
GET  /api/enterprise/summary
GET  /api/enterprise/certificates/verify   (public)
GET  /api/admin/enterprise
UI   /admin/enterprise
```

## Hard invariants

1. Never writes `clinical_snapshot`, patient `case_memory`, LTM, or DecisionPlan.  
2. Never injects into patient prompts.  
3. Row isolation by `institution_id` / `organization_id` — no cross-tenant leakage for org roles.  
4. Soft-fail — report persistence succeeds even if enterprise fails.  
5. Does not replace Assessment, ACE, Education, Validation, or Supervisor ownership.  
6. `session_reports` remain admin-only.

## Related docs

- [`TENANT_MODEL.md`](./TENANT_MODEL.md)
- [`RBAC_MODEL.md`](./RBAC_MODEL.md)
- [`ORGANIZATION_MODEL.md`](./ORGANIZATION_MODEL.md)
- [`COURSE_ENGINE.md`](./COURSE_ENGINE.md)
- [`CERTIFICATION_ENGINE.md`](./CERTIFICATION_ENGINE.md)
- [`ANALYTICS_ARCHITECTURE.md`](./ANALYTICS_ARCHITECTURE.md)
- [`SECURITY_MODEL.md`](./SECURITY_MODEL.md)
- [`OBSERVABILITY.md`](./OBSERVABILITY.md)
- [`API_GUIDE.md`](./API_GUIDE.md)
- Reports under `docs/stage10/`
