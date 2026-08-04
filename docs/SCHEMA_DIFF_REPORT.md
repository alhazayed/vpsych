# Schema Diff Report

**Compared:** Production (`rrzudbkxigeavfdnidnm`) vs greenfield replay of git migrations  
**Date:** 2026-08-04 08:53 UTC  
**Result:** **ZERO STRUCTURAL DRIFT** — PASS

## Object counts (public schema)

| Object | Production | Greenfield (git) | Match |
|---|---:|---:|:---:|
| Tables | 56 | 56 | ✓ |
| Views | 9 | 9 | ✓ |
| Functions / RPCs | 22 | 22 | ✓ |
| Triggers | 7 | 7 | ✓ |
| RLS policies | 123 | 123 | ✓ |
| Indexes | 182 | 182 | ✓ |
| Columns | 666 | 666 | ✓ |
| Named constraints | equal | equal | ✓ |
| Enums | 27 | 27 | ✓ |
| Tables with RLS enabled | 56/56 | 56/56 | ✓ |
| EXECUTE grants (anon/authenticated/service_role) | identical set | identical set | ✓ |

## Deep equality checks

| Check | Result |
|---|---|
| Function definition MD5 (`pg_get_functiondef`) | All 22 match |
| Policy qualification MD5 (`qual` + `with_check`) | All 123 match |
| EXECUTE grant pairs | Exact match |
| Enum labels | Exact match |
| Column types / nullability | Exact match |

## Platform / out-of-scope differences

| Area | Production | Git greenfield | Assessment |
|---|---|---|---|
| Extensions | pgcrypto, plpgsql, supabase_vault, uuid-ossp, pg_stat_statements | pgcrypto, plpgsql | Platform-managed; not app drift |
| Storage buckets | 0 | 0 | Match |
| Auth schema | Supabase Auth | Stub for replay | Platform-managed |
| Instructor preset rows | 8 (incl. UI clone) | 7 (canonical seeds) | Data-only; clone slug `cbt-skills-gp-en-copy-msdflwu3` |

## Auto-generated NOT NULL constraint names

Postgres names NOT NULL checks with OID-prefixed identifiers. These differ across databases and are **not** structural drift. Named constraints (PK/FK/UNIQUE/CHECK with explicit names) match exactly.

## Conclusion

A brand-new project created only from the git migration tree produces a `public` schema that is structurally identical to production.
