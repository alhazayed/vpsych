# Stage 7 Education — Migration Notes

**No database migration required** for Stage 7 core.

## Why

Education is a read/compose layer over:

- Existing ACE tables (`learner_profiles`, `learner_competencies`, …)
- Existing assessment scores on `session_reports` (admin-only)
- Existing case teaching fields on `sessions.clinical_snapshot`

Session education bundles are computed ephemerally at session end and for `/api/education/summary`. They are not persisted as a new table in this stage.

## Optional future migration (EDU-01 — deferred)

If product needs durable education ledgers:

```sql
-- NOT APPLIED — illustrative only
-- create table public.education_session_bundles (
--   id uuid primary key default gen_random_uuid(),
--   session_id uuid not null references public.sessions(id),
--   learner_id uuid not null,
--   bundle jsonb not null,
--   created_at timestamptz not null default now()
-- );
```

Any future table must:

1. Use a new migration filename (`YYYYMMDDHHMMSS_…`)
2. RLS: learner reads own; admin reads all; no therapist report leakage
3. Never store patient DecisionPlan / Emotion internals

## Rollback

Revert the Stage 7 commits. End route falls back to calling `runAceAfterAssessment` directly if education package is removed; ACE behaviour is unchanged underneath the wrapper.
