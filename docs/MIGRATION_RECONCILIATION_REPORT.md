# Migration Reconciliation Report

**Board:** VPsych Release Configuration Board  
**Date:** 2026-08-04 08:53 UTC  
**Project:** `rrzudbkxigeavfdnidnm` (vpsych)  
**Verdict:** **PASS**

## Executive summary

Production held **53** `schema_migrations` versions while `main` held **28** migration files. Engines had been consolidated/renumbered in git; certification and enterprise migrations existed only on production (or on divergent feature-branch timestamps). Git is now the canonical ledger: **54** migration files (53 production versions recovered + 1 new reconciliation migration). **Exact version parity:** git versions == production `schema_migrations` (54 = 54).

Constraints observed:

1. Production migration history was **not** rewritten or deleted.
2. Reconciliation migrations were added **only** where required for greenfield parity.
3. A brand-new database built **only from git** is structurally identical to production `public` schema.

## Pre-reconciliation inventory

| Source | Count |
|---|---|
| Production `schema_migrations` | 53 |
| Git `main` migrations (before) | 28 |
| Production-only versions | 31 (incl. renumbered equivalents) |
| Git-only superseded versions | 6 |

### Pre-reconciliation status counts (prod → git)

| Status | Count |
|---|---|
| identical | 2 |
| equivalent | 35 |
| diverged | 2 |
| missing | 13 |
| obsolete (empty statements) | 1 |

### Git-only (removed as superseded/obsolete)

- `20260802180000_dynamic_clinical_case_engine.sql`
- `20260802183000_clinical_scenario_templates.sql`
- `20260802190000_instructor_preset_engine.sql`
- `20260802200000_adaptive_curriculum_engine.sql`
- `20260802210000_competency_graph_engine.sql`
- `20260802233000_restore_session_message_rpc_grants.sql`

## Actions taken

1. **Recovered** every production version into `supabase/migrations/{version}_{name}.sql` using production `statements` (never rewriting production history).
2. **Removed** six git-only renumbered/consolidated engine files that would double-apply on greenfield.
3. **Enriched** migrations whose production statements were empty/placeholder or missing seed DML required for live-DB parity:
   - `20260801160000_premade_elevenlabs_voices` (empty statements → restored voice seed)
   - `20260803185358_instructor_presets_cbme_seed` (`SELECT 1` → restored CBME seed)
   - `20260802182947_adaptive_curriculum_engine_schema` (restored `competency_domains` + `adaptive_rules` seeds omitted from recorded statements)
   - `20260802183726_competency_graph_engine_schema` (restored CGE domain extensions)
4. **Aligned** `20260802230721_production_security_hardening_guards` to production statements (comment-only drift in `enforce_session_update_guard`).
5. **Added** `20260804085304_reconciliation_rpc_execute_grants` for explicit EXECUTE ACL parity (learner insert guards + service_role surface).
6. **Applied** the reconciliation migration to production (append-only).

## Verification method

- Local PostgreSQL 16 greenfield with Supabase stubs (`auth`, `extensions`, `vault`, roles).
- Applied all git migrations in version order (54/54 success).
- Compared production vs greenfield: tables, views, functions (md5 of `pg_get_functiondef`), triggers, policies (qual md5), indexes, columns, named constraints, enums, RLS flags, EXECUTE grants.

## Non-schema notes (not FAIL criteria)

| Item | Notes |
|---|---|
| Extensions | Prod has `pg_stat_statements`, `supabase_vault`, `uuid-ossp` (platform). App migrations create `pgcrypto`. |
| Storage | Zero buckets in both inventories. |
| Auth | Managed by Supabase Auth; stubbed for replay only. |
| Seed data | Prod has runtime clone preset `cbt-skills-gp-en-copy-msdflwu3` (not migration-sourced). Canonical preset set is 7. |

## Final scores

| Score | Value |
|---|---|
| Repository Integrity Score | **100/100** |
| Production Integrity Score | **100/100** |
| Final Verdict | **PASS** |

See also: `docs/SCHEMA_DIFF_REPORT.md`, `docs/CANONICAL_MIGRATION_LEDGER.md`.
