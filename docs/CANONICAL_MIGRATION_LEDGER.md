# Canonical Migration Ledger

**Generated:** 2026-08-04 08:53 UTC
**Canonical source:** git `supabase/migrations/`
**Production project:** rrzudbkxigeavfdnidnm

## Legend

| Status | Meaning |
|---|---|
| identical | Same version in git; content matches production applied SQL |
| identical (prod statements) | Recovered from production `statements` into git under the production version |
| equivalent (enriched for greenfield) | Production recorded empty/incomplete statements; SQL restored so greenfield matches live schema/seeds |
| new reconciliation | Append-only migration added after audit |
| superseded | Former git-only file removed; production version is canonical |

## Production → Git mapping (post-reconciliation)

| Production version | Name | Git file | Pre-recon | Post-recon |
|---|---|---|---|---|
| `20260730132727` | `vpsych_initial_schema` | `20260730132727_vpsych_initial_schema.sql` | equivalent | identical |
| `20260730133755` | `seed_preset_avatars` | `20260730133755_seed_preset_avatars.sql` | equivalent | identical |
| `20260730152831` | `harden_security_definer_grants` | `20260730152831_harden_security_definer_grants.sql` | equivalent | identical |
| `20260730181421` | `harden_session_reports` | `20260730181421_harden_session_reports.sql` | diverged | identical (prod statements) |
| `20260730181603` | `fix_session_guard_search_path` | `20260730181603_fix_session_guard_search_path.sql` | equivalent | identical |
| `20260731095540` | `add_preferred_language_to_profiles` | `20260731095540_add_preferred_language_to_profiles.sql` | equivalent | identical |
| `20260731102805` | `multilingual_support` | `20260731102805_multilingual_support.sql` | equivalent | identical |
| `20260731110213` | `optimize_rls_initplan_and_fk_index` | `20260731110213_optimize_rls_initplan_and_fk_index.sql` | equivalent | identical |
| `20260731180158` | `avatar_schema_v2` | `20260731180158_avatar_schema_v2.sql` | diverged | identical (prod statements) |
| `20260731181033` | `avatar_v2_seed_personalities` | `20260731181033_avatar_v2_seed_personalities.sql` | identical | identical |
| `20260731181632` | `avatar_voice_ids` | `20260731181632_avatar_voice_ids.sql` | equivalent | identical |
| `20260731184908` | `report_language_from_session` | `20260731184908_report_language_from_session.sql` | equivalent | identical |
| `20260731191943` | `avatar_voice_casting_and_available_locales` | `20260731191943_avatar_voice_casting_and_available_locales.sql` | equivalent | identical |
| `20260731205101` | `voice_profiles_registry` | `20260731205101_voice_profiles_registry.sql` | equivalent | identical |
| `20260801123356` | `reban_demo_accounts` | `20260801123356_reban_demo_accounts.sql` | equivalent | identical |
| `20260801160000` | `premade_elevenlabs_voices` | `20260801160000_premade_elevenlabs_voices.sql` | obsolete | equivalent (enriched for greenfield) |
| `20260802085425` | `security_audit_events` | `20260802085425_security_audit_events.sql` | equivalent | identical |
| `20260802180922` | `dynamic_clinical_case_engine` | `20260802180922_dynamic_clinical_case_engine.sql` | equivalent | identical (prod statements) |
| `20260802181535` | `clinical_scenario_templates` | `20260802181535_clinical_scenario_templates.sql` | equivalent | identical (prod statements) |
| `20260802182201` | `instructor_preset_engine` | `20260802182201_instructor_preset_engine.sql` | equivalent | identical (prod statements) |
| `20260802182947` | `adaptive_curriculum_engine_schema` | `20260802182947_adaptive_curriculum_engine_schema.sql` | missing | identical (prod statements) |
| `20260802183019` | `adaptive_curriculum_engine_rls` | `20260802183019_adaptive_curriculum_engine_rls.sql` | missing | identical (prod statements) |
| `20260802183726` | `competency_graph_engine_schema` | `20260802183726_competency_graph_engine_schema.sql` | missing | identical (prod statements) |
| `20260802183803` | `competency_graph_engine_seed_nodes_a` | `20260802183803_competency_graph_engine_seed_nodes_a.sql` | missing | identical (prod statements) |
| `20260802183817` | `competency_graph_engine_seed_nodes_b` | `20260802183817_competency_graph_engine_seed_nodes_b.sql` | missing | identical (prod statements) |
| `20260802183823` | `competency_graph_engine_seed_edges` | `20260802183823_competency_graph_engine_seed_edges.sql` | missing | identical (prod statements) |
| `20260802183840` | `competency_graph_engine_rls` | `20260802183840_competency_graph_engine_rls.sql` | missing | identical (prod statements) |
| `20260802230703` | `production_security_hardening` | `20260802230703_production_security_hardening.sql` | equivalent | identical |
| `20260802230721` | `production_security_hardening_guards` | `20260802230721_production_security_hardening_guards.sql` | equivalent | identical (prod statements) |
| `20260802230739` | `production_security_hardening_ace_rls` | `20260802230739_production_security_hardening_ace_rls.sql` | equivalent | identical |
| `20260802230748` | `production_security_hardening_cge_rls` | `20260802230748_production_security_hardening_cge_rls.sql` | equivalent | identical |
| `20260802232358` | `restore_session_message_rpc_grants` | `20260802232358_restore_session_message_rpc_grants.sql` | equivalent | identical (prod statements) |
| `20260803011144` | `ace_session_progress_rpc` | `20260803011144_ace_session_progress_rpc.sql` | equivalent | identical (prod statements) |
| `20260803021426` | `database_certification_hardening` | `20260803021426_database_certification_hardening.sql` | equivalent | identical (prod statements) |
| `20260803033503` | `clinical_certification_coding_fixes` | `20260803033503_clinical_certification_coding_fixes.sql` | missing | identical (prod statements) |
| `20260803044719` | `performance_indexes_and_rls_initplan` | `20260803044719_performance_indexes_and_rls_initplan.sql` | missing | identical (prod statements) |
| `20260803050605` | `data_integrity_certification` | `20260803050605_data_integrity_certification.sql` | equivalent | identical (prod statements) |
| `20260803050919` | `devops_revoke_trigger_rpc_grants` | `20260803050919_devops_revoke_trigger_rpc_grants.sql` | equivalent | identical (prod statements) |
| `20260803164011` | `fix_profiles_update_rls_recursion` | `20260803164011_fix_profiles_update_rls_recursion.sql` | equivalent | identical (prod statements) |
| `20260803171321` | `supabase_cert_revoke_privileged_rpcs` | `20260803171321_supabase_cert_revoke_privileged_rpcs.sql` | equivalent | identical (prod statements) |
| `20260803175005` | `restore_session_message_rpc_grants` | `20260803175005_restore_session_message_rpc_grants.sql` | equivalent | identical (prod statements) |
| `20260803180636` | `seed_template_objectives_competencies` | `20260803180636_seed_template_objectives_competencies.sql` | equivalent | identical (prod statements) |
| `20260803181537` | `persona_engine_maya_voice_casting` | `20260803181537_persona_engine_maya_voice_casting.sql` | equivalent | identical (prod statements) |
| `20260803182858` | `seed_template_diagnoses_comorbidities` | `20260803182858_seed_template_diagnoses_comorbidities.sql` | equivalent | identical (prod statements) |
| `20260803183449` | `clinical_certification_coding_fixes` | `20260803183449_clinical_certification_coding_fixes.sql` | missing | identical (prod statements) |
| `20260803185203` | `instructor_presets_consultant_learner` | `20260803185203_instructor_presets_consultant_learner.sql` | equivalent | identical (prod statements) |
| `20260803185358` | `instructor_presets_cbme_seed` | `20260803185358_instructor_presets_cbme_seed.sql` | missing | equivalent (enriched for greenfield) |
| `20260803194707` | `enterprise_security_cert_hardening` | `20260803194707_enterprise_security_cert_hardening.sql` | missing | identical (prod statements) |
| `20260803201325` | `enterprise_compliance_consent_retention` | `20260803201325_enterprise_compliance_consent_retention.sql` | equivalent | identical (prod statements) |
| `20260803202305` | `enterprise_institutional_foundation` | `20260803202305_enterprise_institutional_foundation.sql` | missing | identical (prod statements) |
| `20260803202511` | `enterprise_institutional_foundation_m18` | `20260803202511_enterprise_institutional_foundation_m18.sql` | equivalent | identical (prod statements) |
| `20260803202534` | `institutional_session_tenancy_m23` | `20260803202534_institutional_session_tenancy_m23.sql` | equivalent | identical (prod statements) |
| `20260804055602` | `restore_session_message_rpc_grants_v1` | `20260804055602_restore_session_message_rpc_grants_v1.sql` | identical | identical |
| `20260804085304` | `reconciliation_rpc_execute_grants` | `20260804085304_reconciliation_rpc_execute_grants.sql` | n/a | new reconciliation |

## Removed git-only files (superseded / obsolete)

- `20260802180000_dynamic_clinical_case_engine.sql`
- `20260802183000_clinical_scenario_templates.sql`
- `20260802190000_instructor_preset_engine.sql`
- `20260802200000_adaptive_curriculum_engine.sql`
- `20260802210000_competency_graph_engine.sql`
- `20260802233000_restore_session_message_rpc_grants.sql`

## Checksums (post-reconciliation git files)

| Version | SHA-256 (prefix) | Bytes |
|---|---|---:|
| `20260730132727` | `900180de759564d2` | 7254 |
| `20260730133755` | `fd4bde24f74016a8` | 4365 |
| `20260730152831` | `246cbf5c9c12bb7a` | 694 |
| `20260730181421` | `da431b7c1db2af1e` | 8248 |
| `20260730181603` | `8fa779d2b4639b76` | 922 |
| `20260731095540` | `34675d6d271a26d9` | 299 |
| `20260731102805` | `ec92102dbe75263b` | 1056 |
| `20260731110213` | `2d64e1852a82c961` | 3959 |
| `20260731180158` | `601f6d23837f12af` | 3451 |
| `20260731181033` | `517563e30fb32266` | 26799 |
| `20260731181632` | `351384d674241ec4` | 792 |
| `20260731184908` | `fcdce9f887e79a3c` | 2673 |
| `20260731191943` | `2f813c227312e1ec` | 4744 |
| `20260731205101` | `89637f2c3c4f0388` | 4882 |
| `20260801123356` | `125fb7e4a09abacd` | 338 |
| `20260801160000` | `7ddb5d09bf58e70c` | 1032 |
| `20260802085425` | `fb8f129e251e865c` | 2953 |
| `20260802180922` | `fcd49ddacd62a4b6` | 27509 |
| `20260802181535` | `8acd67c8ba03eb9e` | 30768 |
| `20260802182201` | `d989748bd1187e14` | 18424 |
| `20260802182947` | `d2a91ad661fa9550` | 14238 |
| `20260802183019` | `a6ec815b6ef7f229` | 7401 |
| `20260802183726` | `a5e18e522cca0e0c` | 7821 |
| `20260802183803` | `994e454efeea01cc` | 5054 |
| `20260802183817` | `7c547795985cbda3` | 4838 |
| `20260802183823` | `2f82fce85018524c` | 3443 |
| `20260802183840` | `6d2185186c8a4e14` | 4906 |
| `20260802230703` | `183f9b53f5863e1c` | 3433 |
| `20260802230721` | `5a59d0210d833ab1` | 3688 |
| `20260802230739` | `4dea3ae3b4c376fe` | 8179 |
| `20260802230748` | `4da4e50b5c60a660` | 2988 |
| `20260802232358` | `df9ec3cda61c3998` | 837 |
| `20260803011144` | `b4bc8f02c2f7600a` | 7471 |
| `20260803021426` | `4cd08b1ad80dc5e2` | 5998 |
| `20260803033503` | `e8cfe327c1ee54b7` | 2476 |
| `20260803044719` | `5e5779c90be451e7` | 7600 |
| `20260803050605` | `736be8ed5c557839` | 3527 |
| `20260803050919` | `b70c6953d3120822` | 688 |
| `20260803164011` | `a505b45a7121ba5e` | 985 |
| `20260803171321` | `ecefb4ff09d9b20d` | 1745 |
| `20260803175005` | `d66570c584cb44dc` | 887 |
| `20260803180636` | `8d684ac38e9188cd` | 2724 |
| `20260803181537` | `c15845ee0e4be875` | 1241 |
| `20260803182858` | `4beb4b3a06873018` | 2014 |
| `20260803183449` | `b084a09026e756d3` | 1636 |
| `20260803185203` | `a4adeddd76637f3e` | 414 |
| `20260803185358` | `0434d8e020591f12` | 8887 |
| `20260803194707` | `4c75aa685546e940` | 6129 |
| `20260803201325` | `f48a0584e6fe6d21` | 4136 |
| `20260803202305` | `9281c301c70d5e79` | 278 |
| `20260803202511` | `c1d8438a2c7e9359` | 25358 |
| `20260803202534` | `a583a7ab8cd8b2a4` | 5131 |
| `20260804055602` | `6b37eaa5d605d8f4` | 1101 |
| `20260804085304` | `e5e24cc71e23b001` | 1689 |

## Totals

- Git migration files: **54**
- Production versions covered: **53 / 53**
- New reconciliation migrations: **1**

