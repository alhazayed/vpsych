# Migration parity — production ↔ git

**RC2 infrastructure freeze artifact.**  
**Project:** `rrzudbkxigeavfdnidnm` (vpsych, us-east-1)  
**Captured:** 2026-08-04 via Supabase MCP `list_migrations`  
**Snapshot file:** `scripts/remote-schema-migrations.snapshot.json`

## Rule

`supabase_migrations.schema_migrations` on production must not contain version
IDs that are absent from `supabase/migrations/` in git. Local-only versions are
allowed (pending apply, or consolidated DDL that fresh installs use).

Gate:

```bash
npm run test:migrations
# Live DB (preferred when available):
SUPABASE_DB_URL=postgres://... npm run test:migrations
```

Without `SUPABASE_DB_URL`, the script compares git to the checked-in snapshot.

## Why drift happened

Draft certification agents applied migrations through Supabase MCP
(`apply_migration`) with live timestamps. Parallel PR branches used rounded
filenames for the same engines. Production recorded the MCP versions; `main`
kept the consolidated files. Later cert missions (database, clinical, devops,
enterprise, institutional) applied additional SQL that never landed on `main`.

## Dual-tracking table

| Production version | Production name | Git file | Kind |
|--------------------|-----------------|----------|------|
| `20260802180922` | `dynamic_clinical_case_engine` | `20260802180922_*.sql` (no-op stub) | Alias of `20260802180000_dynamic_clinical_case_engine.sql` |
| `20260802181535` | `clinical_scenario_templates` | stub | Alias of `20260802183000_*.sql` |
| `20260802182201` | `instructor_preset_engine` | stub | Alias of `20260802190000_*.sql` |
| `20260802182947` | `adaptive_curriculum_engine_schema` | stub | Alias of `20260802200000_*.sql` |
| `20260802183019` | `adaptive_curriculum_engine_rls` | stub | Alias of `20260802200000_*.sql` |
| `20260802183726` | `competency_graph_engine_schema` | stub | Alias of `20260802210000_*.sql` |
| `20260802183803` | `competency_graph_engine_seed_nodes_a` | stub | Alias of `20260802210000_*.sql` |
| `20260802183817` | `competency_graph_engine_seed_nodes_b` | stub | Alias of `20260802210000_*.sql` |
| `20260802183823` | `competency_graph_engine_seed_edges` | stub | Alias of `20260802210000_*.sql` |
| `20260802183840` | `competency_graph_engine_rls` | stub | Alias of `20260802210000_*.sql` |
| `20260802232358` | `restore_session_message_rpc_grants` | recovered SQL | Also mirrored as local `20260802233000_*` |
| `20260803011144` … `20260803202534` | cert / enterprise / institutional | recovered from closed PR branches under **production** version IDs | Already applied — never re-apply to prod |
| `20260803202511` | `enterprise_institutional_foundation_m18` | no-op stub | Mission 18 re-apply of foundation |

Consolidated local-only versions (fresh-install DDL; not on production history):

| Local version | Name |
|---------------|------|
| `20260802180000` | `dynamic_clinical_case_engine` |
| `20260802183000` | `clinical_scenario_templates` |
| `20260802190000` | `instructor_preset_engine` |
| `20260802200000` | `adaptive_curriculum_engine` |
| `20260802210000` | `competency_graph_engine` |
| `20260802233000` | `restore_session_message_rpc_grants` |

## Fresh installs vs production

- **Production:** versions already in `schema_migrations` — do not re-run. Git
  files exist only for history parity and for new environments.
- **Fresh / empty DB:** chronological apply runs consolidated engine migrations
  plus recovered cert SQL. No-op stubs for MCP aliases skip harmlessly.
- **Never** roll back or re-apply `20260804055602_restore_session_message_rpc_grants_v1`
  (session RPC grants for authenticated).

## Refresh procedure

1. Export remote versions (`list_migrations` or
   `select version, name from supabase_migrations.schema_migrations order by 1`).
2. Update `scripts/remote-schema-migrations.snapshot.json`.
3. Add any missing `YYYYMMDDHHMMSS_name.sql` files (recover SQL or documented
   no-op if already applied).
4. Run `npm run test:migrations` until `ok`.

## Counts (RC2 close)

| Source | Count |
|--------|------:|
| Production `schema_migrations` | 53 |
| Git migration files | 59 |
| Remote-only (must be zero) | 0 |
| Local-only consolidated aliases | 6 |
