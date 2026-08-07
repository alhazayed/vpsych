# Organization Model — Stage 10

## Hierarchy

```
Organization (institutions)
  └── Campus (enterprise_campuses)
        └── Department
              └── Training Program (programs)
                    └── Course (enterprise_courses)
                          └── Module → Lesson
                    └── Clinical Rotation
                    └── Cohort / Class (Mission 18)
```

People nodes (membership roles, not tables): Instructor · Supervisor · Resident · Student · Therapist · Observer · Researcher · Administrator.

## Labels (product)

`HIERARCHY_LABELS` in `organization.ts` enumerates the Stage 10 required vocabulary.

## Mapping

| Product term | Schema |
|--------------|--------|
| Organization | `institutions` |
| Campus | `enterprise_campuses` |
| Department | `departments` (+ optional `campus_id`) |
| Training Program | `programs` |
| Course | `enterprise_courses` |
| Instructor / Faculty | membership role |
| Administrator | `organization_admin` / platform admin |

## Seed archetypes (Mission 23)

State Medical University · Metro Teaching Hospital · Harbor Private College · National MoH Training — remain valid Stage 10 tenants after `tenant_type` backfill.
