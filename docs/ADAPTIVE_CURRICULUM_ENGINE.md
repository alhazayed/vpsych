# VPsych Adaptive Curriculum Engine (ACE) v3.0

## Objective

ACE personalizes psychiatric training by tracking competency deficits and generating cases that specifically remediate those gaps — not by blindly raising difficulty.

```
Session assessment (scores + clinical snapshot)
  → map rubric → competency scores (0–100)
  → update learner_profiles / learner_competencies
  → fire adaptive rules
  → generate next AdaptiveCaseRequest
  → AI coach feedback + learning plan
  → optional start via Instructor Preset / Case Engine
```

## Compatibility

| Path | Status |
|------|--------|
| Existing sessions / reports | Unchanged |
| Case Engine / Template Engine / Instructor Presets | Consumed by ACE recommendations |
| `POST /api/sessions/[id]/end` | Additive `adaptive` payload |
| ACE tables missing | Soft-fail; reports still persist |

## Architecture

1. **Learner Profile** — profession, level, language, adaptive controls, velocity, confidence
2. **Competency Model** — 26 domains (interview, DSM/ICD, risk, therapies, alliance, professional)
3. **Performance Analytics** — EMA score updates, miss flags, radar / heat maps, trends
4. **Adaptive Rules** — remediate suicide, remediate differential (hold CBT), scaffold failure, accelerate improvement
5. **Curriculum** — staged pathways (e.g. passive SI → hidden SI → BPD chronic SI → crisis)
6. **AI Coach** — supervisor feedback, reflective questions, reading, next cases, improvement plan
7. **Certifications** — milestone badges (Suicide Assessment Certified, CBT Level 1, …)

## Schema

Migration: `supabase/migrations/20260802200000_adaptive_curriculum_engine.sql`

| Table | Purpose |
|-------|---------|
| `competency_domains` | Global catalog |
| `adaptive_rules` | Trigger → adaptation JSON |
| `learner_profiles` | Permanent learner record |
| `learner_competencies` | Current 0–100 scores |
| `competency_scores` | Per-session history |
| `learning_paths` | Personalized curricula |
| `curriculum_progress` | Step outcomes |
| `adaptive_case_history` | Fingerprinted cases (anti-repeat) |
| `performance_trends` | Rolling metrics |
| `certifications` | Badges |
| `coach_feedback` | Post-session coach |

`sessions` gains nullable `learner_profile_id`, `adaptive_focus`.

## APIs

| Endpoint | Purpose |
|----------|---------|
| `GET/PATCH /api/ace/profile` | Learner profile + analytics + plan |
| `POST /api/ace/adaptive-case` | Generate next adaptive case |
| `GET/POST /api/ace/curriculum` | Curriculum / plan / coach |
| `GET /api/ace/analytics` | Radar, heat maps, history (admin may pass `userId`) |
| `GET/PATCH /api/admin/ace/learners` | Instructor controls |

Session start hint from adaptive case:

```json
{
  "presetSlug": "suicide-risk-resident-en",
  "disorderSlug": "mdd-recurrent-moderate",
  "difficulty": "intermediate",
  "comorbiditySlugs": []
}
```

Pass these into existing `POST /api/sessions`.

## Instructor controls

- Adaptive Mode ON/OFF
- Min competency threshold
- Max difficulty
- Locked diagnoses / objectives
- Automatic vs manual curriculum
- Required / optional competencies

## Dashboards

- Learner: `/learning` — radar, plan, achievements, generate next case
- Instructor: `/admin/curriculum` — learners list, controls, analytics

## Migration strategy

1. Apply ACE migration (additive; depends on Case Engine + Instructor Preset tables for FKs).
2. Deploy app (hooks soft-fail if tables absent).
3. Learner profiles auto-create on first completed assessment.

## Rollback strategy

```sql
ALTER TABLE public.sessions DROP COLUMN IF EXISTS adaptive_focus;
ALTER TABLE public.sessions DROP COLUMN IF EXISTS learner_profile_id;
DROP TABLE IF EXISTS public.coach_feedback CASCADE;
DROP TABLE IF EXISTS public.certifications CASCADE;
DROP TABLE IF EXISTS public.performance_trends CASCADE;
DROP TABLE IF EXISTS public.adaptive_case_history CASCADE;
DROP TABLE IF EXISTS public.curriculum_progress CASCADE;
DROP TABLE IF EXISTS public.learning_paths CASCADE;
DROP TABLE IF EXISTS public.competency_scores CASCADE;
DROP TABLE IF EXISTS public.learner_competencies CASCADE;
DROP TABLE IF EXISTS public.learner_profiles CASCADE;
DROP TABLE IF EXISTS public.adaptive_rules CASCADE;
DROP TABLE IF EXISTS public.competency_domains CASCADE;
```

Do not drop Case Engine / Template / Preset tables.

## Tests

`src/lib/ace/ace.test.ts`

- Success criteria (suicide remediation, differential ambiguity, complexity on improvement)
- **10,000** virtual learners × 6 sessions — tracking, remediation, no loops, no impossible diagnoses, graduation

## Success criteria (product)

1. Learner weak on suicide assessment → successive SI-focused cases until threshold.
2. CBT ≥ 90 and differential &lt; 60 → diagnostically ambiguous cases without raising CBT complexity.
3. Sustained improvement → resistance, uncertainty, comorbidity, masking, time pressure, limited disclosure.
