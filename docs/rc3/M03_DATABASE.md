# RC3 Mission 03 — Database / Supabase

**Verdict: FAIL (Critical — git/`main` migration drift)**

## Live production (healthy)

| Metric | Value |
|---|---:|
| `schema_migrations` | **54** (latest `20260804085304`) |
| Public tables | 56 |
| RLS disabled | **0** |
| Disorders / templates / presets | 17 / 3 / 8 |
| CGE nodes / edges | 34 / 42 |
| Sessions / reports / messages | 390 / 333 / 3117 |
| `insert_*_message` EXECUTE | `authenticated` + `service_role` ✅ |

## Git `main` (release train)

| Metric | Value |
|---|---:|
| Migration files on `main` @ `52a7610` | **28** |
| Reconciliation PR | [#103](https://github.com/alhazayed/vpsych/pull/103) OPEN (greenfield structural PASS on that branch) |

## Defect

**RC3-C1 Critical:** Production history is ahead of `main`. Until #103 merges, a brand-new project built only from `main` does **not** match production, and `npm run test:migrations` with `SUPABASE_DB_URL` will fail remote-ahead checks.

## Advisors (non-blocking for this mission)

- WARN: intentional SECURITY DEFINER RPCs executable by authenticated
- WARN: Auth leaked-password protection disabled → tracked as RC3-H1 under Mission 20
