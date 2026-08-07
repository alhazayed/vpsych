# Mission 6 — Living Environment Engine

**Version:** `1.0.0`  
**Code:** `src/lib/living-environment/`  
**Migration:** `supabase/migrations/20260807094000_living_environment_engine.sql`

## Intent

The patient exists inside a **living world**. Every CaseInstance mints an
immutable biography covering:

| Domain | Contents |
|--------|----------|
| home | housing type, neighborhood, household, tenure, cost |
| family | named members with ages, proximity, relationship quality |
| work | status, title, employer/context, schedule, stressors |
| friends | named friends, closeness, contact patterns |
| financial problems | currency, income band, debts, primary worry |
| medical history | conditions, meds, allergies, hospitalizations, primary care |
| daily routine | weekday slots, sleep, meals, movement |
| social media | platforms, usage, posting style |
| education | level, field, institution type, graduation |

The therapist can ask about **any** detail. Answers stay **consistent forever**
for that case — the world is never regenerated mid-session or mid-course.

## Deliverables

| Piece | Module |
|-------|--------|
| World Generator | `generator.ts` — seeded mint of all nine domains |
| Consistency checker | `consistency.ts` — cross-domain invariants + topic coverage |
| Persistence | `persist.ts` + `living_environments` table (insert-once) |
| Prompt | `prompt.ts` — Module 2B injection |
| Tests | `living-environment.test.ts` |

## Runtime flow

```
POST /api/sessions
  → createCaseForSession()
      → generateCaseInstance()
          → generateLivingWorld({ seed, locale, age, persona, randomized })
          → checkLivingWorldConsistency()   // retries with derived seeds
          → snapshot.living_world = world
      → INSERT case_instances (clinical_snapshot includes living_world)
      → INSERT living_environments (best-effort, insert-once)
      → case_memory.memory.living_world embed

POST /api/sessions/[id]/message
  → resolveAvatar(..., { caseSnapshot })
      → fidelity.living_environment_block = formatLivingWorldForPrompt(...)
  → assembleSystemPrompt → MODULE 2B — LIVING ENVIRONMENT
```

Persistence is **best-effort**. Missing migration / RLS never blocks case mint
or replies — process memory + `clinical_snapshot.living_world` remain available.

## Consistency invariants

- Parents are older than the patient
- Currency matches locale (`USD` for `en-*`, `JOD` for `ar-*`)
- Employed patients have work in the weekday routine
- Hospitalization ages are strictly before patient age
- Education graduation age is plausible
- Person names unique across family + friends
- All nine domains present; consistency anchors mention city
- Arabic locales use Arabic script in home description

## Immutability

1. `living_environments` is insert-once per `case_instance_id` (unique constraint).
2. Therapists have no UPDATE policy; admins only for ops repair.
3. Re-loading a case uses the snapshot / table row — never `generateLivingWorld` again.
4. `consistency_anchors` are the patient-facing “never contradict” list.

## Invariants vs Case Engine

- Diagnosis still lives on `sessions.clinical_snapshot` / CaseInstance — not on the world.
- Living world is **non-diagnostic colour** (like `randomized_context`) but far richer.
- Locale packs are independently authored (EN / AR) — never machine-translated.

## Verification

```bash
npm test -- src/lib/living-environment/living-environment.test.ts
npm run lint && npm run typecheck && npm test && npm run test:migrations && npm run build
```
