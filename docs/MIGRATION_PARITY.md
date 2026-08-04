# Migration Parity Ledger (Mission 07 / RC2)

**Purpose:** Make GitHub `supabase/migrations/` the documented source of truth relative to live Supabase `rrzudbkxigeavfdnidnm`.  
**Rule:** Never re-apply migrations already present remotely. This ledger is documentation + CI awareness only.

**Remote applied:** 53 versions (Supabase MCP `list_migrations`, 2026-08-04)  
**Local files on RC #100:** 28 files

---

## Alias map (same logical migration, different timestamps)

| Remote version | Local file version | Name |
|----------------|--------------------|------|
| `20260802180922` | `20260802180000` | dynamic_clinical_case_engine |
| `20260802181535` | `20260802183000` | clinical_scenario_templates |
| `20260802182201` | `20260802190000` | instructor_preset_engine |
| `20260802182947` + `20260802183019` | `20260802200000` | adaptive_curriculum_engine (schema+rls combined locally) |
| `20260802183726`…`20260802183840` | `20260802210000` | competency_graph_engine (split remotely) |
| `20260802232358` | `20260802233000` | restore_session_message_rpc_grants |

Fresh environments should continue using **local** filenames. Remote timestamps reflect dashboard apply order from draft certification agents.

---

## Remote-only versions (applied live; SQL recovered from closed draft branches)

| Version | Name | Source branch / note |
|---------|------|----------------------|
| `20260803011144` | ace_session_progress_rpc | certification drafts |
| `20260803021426` | database_certification_hardening | #49 |
| `20260803033503` | clinical_certification_coding_fixes | clinical cert |
| `20260803044719` | performance_indexes_and_rls_initplan | #53 |
| `20260803050605` | data_integrity_certification | #55 |
| `20260803050919` | devops_revoke_trigger_rpc_grants | #56 |
| `20260803164011` | fix_profiles_update_rls_recursion | #71 |
| `20260803171321` | supabase_cert_revoke_privileged_rpcs | #72 (later restored) |
| `20260803175005` | restore_session_message_rpc_grants | #73/API cert restore |
| `20260803180636` | seed_template_objectives_competencies | templates cert |
| `20260803181537` | persona_engine_maya_voice_casting | #76 |
| `20260803182858` | seed_template_diagnoses_comorbidities | clinical |
| `20260803183449` | clinical_certification_coding_fixes | clinical |
| `20260803185203` | instructor_presets_consultant_learner | #80 |
| `20260803185358` | instructor_presets_cbme_seed | #80 |
| `20260803194707` | enterprise_security_cert_hardening | #85 |
| `20260803201325` | enterprise_compliance_consent_retention | #87 |
| `20260803202305` | enterprise_institutional_foundation | #88 |
| `20260803202511` | enterprise_institutional_foundation_m18 | #60/#88 |
| `20260803202534` | institutional_session_tenancy_m23 | #88 |
| `20260804055602` | restore_session_message_rpc_grants_v1 | **On RC #100** ✅ |

---

## RC2 recovery plan (ops)

1. For each remote-only row: extract SQL from the closed PR branch into `supabase/migrations/<version>_<name>.sql` **without** calling `apply_migration`.  
2. Run `npm run test:migrations` with `SUPABASE_DB_URL` so `compareMigrationParity` reports `missingLocal: []`.  
3. Until then: treat this ledger as the operational source of truth; do not `supabase db reset` against production.

**Mission 07 verdict on RC:** ⚠ WITH RECOMMENDATIONS — drift documented; recovery plan defined; no destructive sync performed in this cycle.
