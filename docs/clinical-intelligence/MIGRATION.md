# Clinical Intelligence — Migration Notes (Stage 6)

**No destructive schema migration required** for Stage 6 core objects.

## Why no new migration for formulation / MSE / protectives

`sessions.clinical_snapshot` and `case_instances` already store JSON. Stage 6 adds optional fields:

- `clinical_core.protective_factors`
- `clinical_core.mse`
- `clinical_core.formulation`
- `clinical_core.risk_profile.{self_neglect,risk_to_dependents,static_factors,dynamic_factors}`
- `therapy_reaction_rules` versioned TherapyResponseProfile (still jsonb)

Readers **must default-absent** for legacy slim snapshots. New sessions mint via `promoteClinicalIntelligence()`.

## case_memory namespace

Additive key `memory.clinical_intelligence` alongside existing:

- `memory.emotion`
- `memory.patient_adaptation`

Writers use `embedMindState` / `embedAdaptationInMemory` to avoid clobbering siblings. A fully atomic merge helper remains TECHNICAL_DEBT (ARCH-S2-02).

## LTM categories

`MEMORY_CATEGORIES` in TypeScript extended additively. The `patient_long_term_memory.memory` jsonb has **no CHECK constraint** on entry category — no SQL migration required.

## Future migrations (only if needed)

| Trigger | Suggested migration |
|---------|---------------------|
| Index longitudinal_group adaptation carry | optional table or generated column |
| Enforce MSE presence for curriculum packages | DB CHECK / admin validation job |
| Separate adherence table for research export | new table + RLS |

Filename rule: `YYYYMMDDHHMMSS_snake_case_name.sql` — never edit applied migrations.

## Parity

`npm run test:migrations` continues to validate filename/version integrity. Remote parity when `SUPABASE_DB_URL` is set.
