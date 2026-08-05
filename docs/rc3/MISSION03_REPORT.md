# RC3 Wave 1 — Mission 03: Supabase / Database

**Verdict: PASS WITH RECOMMENDATION**  
**Evidence ID:** `RC3-W1-EV-20260805T1305Z`  
**Supabase:** `rrzudbkxigeavfdnidnm` · ACTIVE_HEALTHY · us-east-1

## Parity

| Check | Before W1-C1 | After W1-C1 |
|---|---|---|
| Repo migration files | 54 | **55** |
| Production `schema_migrations` | 54 | **55** |
| Version set equality | EXACT | **EXACT** |
| Latest version | `20260804085304` | `20260805130453` |
| `npm run test:migrations` (local) | OK | OK |

## Live inventory

| Metric | Value |
|---|---|
| Public base tables | 56 |
| RLS enabled | **all 56** |
| Audit therapist Auth + profile | present · role `therapist` · not banned |
| Audit admin Auth + profile | present · role `admin` · not banned |
| Vault secrets | `vpsych_audit_*_password`, `report_write_key` present |

## Anon Data API

PostgREST SELECT on `profiles`, `sessions`, `session_reports`, `avatars` → **401** permission denied (no `anon` GRANT). PASS.

## Finding fixed this mission wave (shared with M04)

| ID | Severity | Finding | Fix |
|---|---|---|---|
| **W1-C1** | Critical | `insert_system_message` / `insert_assistant_message` bodies still hard-gated to `service_role` after V1-C1 grant-only restore → session create 500 | Migration `20260805130453_restore_session_message_rpc_owner_auth` applied to production + committed. Bodies restore owner/`service_role` dual path. Retest PASS. |

## Open recommendation

| ID | Severity | Finding | Class |
|---|---|---|---|
| **RC3-H1** | High (ops) | Supabase Auth **leaked-password protection** disabled (security advisor WARN) | Release Infrastructure — enable HaveIBeenPwned in Auth settings |

Advisor also WARN on intentional SECURITY DEFINER RPCs executable by `authenticated` (expected for ownership-checked message/report helpers) — **Medium**, not a Wave 1 blocker.

## Sign-off

Mission 03 **PASS WITH RECOMMENDATION** (RC3-H1).
