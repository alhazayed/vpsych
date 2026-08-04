# VPsych Release Manifest

Machine-readable inventory of the **v1.0.0** release candidate line.
Parse the YAML block below; the prose after it is commentary only.

```yaml
# RELEASE_MANIFEST — do not edit casually; refresh on each production cut.
schema: vpsych.release_manifest/v1
version: "v1.0.0"
status: "rc2_complete_pending_rc3_rc5" # public GA blocked until RC3–RC5

git:
  commit_sha: "52a7610d732500c3c91067c270740edf4a1aaef3"
  commit_short: "52a7610"
  branch: "main"
  commit_message: "RC1 Code Freeze — sole v1.0 candidate (#100)"
  commit_committed_at: "2026-08-04T08:36:42Z"
  repository: "https://github.com/alhazayed/vpsych"

release:
  date: "2026-08-04" # UTC calendar date of production cut (#100)
  github_release_tag: "v1.0.0" # planned; create at RC5 — not yet published
  github_release_url: null # set after `gh release create v1.0.0`
  github_deployment_id: 5740612630 # GitHub Deployments API (Production)

vercel:
  project_id: "prj_qiJ1mQvX0s5lJZ9KJnpWAx4EXjNm"
  team_id: "team_1GRDAL9LNCLMp13s2sbE08Fh"
  team_slug: "alhazayed-1540s-projects"
  production_url: "https://vpsych.vercel.app"
  deployment_id: "dpl_2mBqyfzFEDCETctTSL7aFQR3HnDv"
  deployment_url: "https://vpsych-bwmlekrgo-alhazayed-1540s-projects.vercel.app"
  deployment_created_at: "2026-08-04T08:37:33Z"
  meta_github_commit_sha: "52a7610d732500c3c91067c270740edf4a1aaef3"

supabase:
  project_ref: "rrzudbkxigeavfdnidnm"
  project_name: "vpsych"
  region: "us-east-1"
  status: "ACTIVE_HEALTHY"
  postgres_engine: "17"
  url: "https://rrzudbkxigeavfdnidnm.supabase.co"

migrations:
  remote_version_count: 53
  local_file_count: 59 # includes 6 consolidated local-only aliases
  snapshot_path: "scripts/remote-schema-migrations.snapshot.json"
  snapshot_captured_at: "2026-08-04T08:40:00Z"
  snapshot_sha256: "d820fe31137f7602fd356a3e202f74f6180559a9748eae9e636c1817f826acc2"
  migrations_tree_sha256: "12849cf379035f4d700af8a1906f94fc9317fcde66f650b389df6b16167dca36"
  parity_doc: "docs/MIGRATION_PARITY.md"
  latest_applied_version: "20260804055602"
  latest_applied_name: "restore_session_message_rpc_grants_v1"

environment:
  config_version: "env.example.keys.137f8c24fc52"
  config_source: ".env.example" # key-name fingerprint only; no secrets
  public_app_url: "https://vpsych.vercel.app"
  documented_keys:
    - NEXT_PUBLIC_SUPABASE_URL
    - NEXT_PUBLIC_SUPABASE_ANON_KEY
    - NEXT_PUBLIC_APP_URL
    - OPENAI_API_KEY
    - AI_GATEWAY_API_KEY
    - ELEVENLABS_API_KEY
    - REPORT_WRITE_KEY
    - SUPABASE_SERVICE_ROLE_KEY
    - UPSTASH_REDIS_REST_URL
    - UPSTASH_REDIS_REST_TOKEN

ai:
  openai:
    chat_model_default: "gpt-5"
    chat_model_env: "OPENAI_CHAT_MODEL"
    stt_model_default: "gpt-4o-transcribe"
    stt_model_env: "OPENAI_STT_MODEL"
    provider_selector: "src/lib/ai/provider.ts"
  gateway:
    model_default: "openai/gpt-4o-mini"
    model_env: "AI_MODEL"
  notes: "Official OpenAI SDK preferred when OPENAI_API_KEY set; gateway when AI_GATEWAY_API_KEY set."

voice:
  tts_provider: "elevenlabs"
  tts_model_default: "eleven_multilingual_v2"
  tts_model_env: "ELEVENLABS_MODEL_ID"
  registry_version: "20260801160000" # premade voices migration atop 20260731205101
  registry_migrations:
    - "20260731205101_voice_profiles_registry"
    - "20260801160000_premade_elevenlabs_voices"
  default_voice_en: "EXAVITQu4vr4xnSDxMaL" # Bella
  default_voice_ar: "pNInz6obpgDQGcFmaJgB" # Adam
  active_profiles_in_prod: 3 # Amira, Omars, Youssef (Noura inactive)

clinical_content:
  persona_package_version: "2026-08-02"
  persona_package_sha256: "25f23342aecb225afd72055d44dac8721db5e964492b1b196e876cbbe50cde45"
  persona_index: "personas/index.json"
  avatar_schema: "schemas/avatar.v2.json"
  avatar_schema_version: 2
  cases:
    - "VPSY-CASE-001" # maya-chen
    - "VPSY-CASE-002" # jordan-hale
  clinical_template_engine: "v2.0"
  clinical_template_doc: "docs/CLINICAL_SCENARIO_TEMPLATE_ENGINE.md"
  case_engine: "v2.0"
  case_engine_doc: "docs/DYNAMIC_CLINICAL_CASE_ENGINE.md"
  instructor_preset_engine: "v2.0"
  instructor_preset_doc: "docs/INSTRUCTOR_PRESET_ENGINE.md"

engines:
  competency_graph:
    version: "v3.0"
    graph_version_in_db: 1
    doc: "docs/COMPETENCY_GRAPH_ENGINE.md"
    code: "src/lib/cge/"
  adaptive_curriculum:
    version: "v3.0"
    doc: "docs/ADAPTIVE_CURRICULUM_ENGINE.md"
    code: "src/lib/ace/"
  quality_ledger:
    schema_version: null # not shipped in v1.0.0
    status: "deferred_v1.1"
    backlog: "https://github.com/alhazayed/vpsych/pull/68"

certification:
  package_version: "rc2-d7280366ee52"
  package_sha256: "d7280366ee52c31389f5a82daee95726a1433016aeba461d34f8059141ffbb3d"
  artifacts:
    - "docs/ARCHITECTURE_CERTIFICATION.md"
    - "docs/PRODUCTION_SECURITY_CERTIFICATION.md"
    - "docs/FUNCTIONAL_CERTIFICATION.md"
    - "docs/SECURITY_CERTIFICATION.md"
    - "docs/V1_RELEASE_CERTIFICATION.md"
    - "docs/RC1_CODE_FREEZE.md"
    - "docs/RC2_INFRASTRUCTURE_FREEZE.md"
  rc_gates:
    rc1_code_freeze: complete # #100 merged
    rc2_infrastructure_freeze: complete # evidence in docs/RC2_INFRASTRUCTURE_FREEZE.md; PR #101
    rc3_production_validation: pending
    rc4_launch_ops: pending
    rc5_tag_and_announce: pending

deferred:
  backlog_doc: "docs/V1_1_BACKLOG.md"
  rule: "Do not merge any deferred PR into main before tag v1.0.0."
  items:
    - { pr: 62, title: "CFI — Clinical Fidelity Index", theme: Scientific }
    - { pr: 63, title: "ERI — Educational Reliability Index", theme: Scientific }
    - { pr: 64, title: "AVI — Assessment Validity Index", theme: Scientific }
    - { pr: 65, title: "ALE — Adaptive Learning Effectiveness", theme: Scientific }
    - { pr: 66, title: "RRS — Research Readiness Score", theme: Scientific }
    - { pr: 67, title: "VQI — VPsych Quality Index", theme: Scientific }
    - { pr: 68, title: "Quality Ledger engine", theme: Scientific }
    - { pr: 69, title: "Multi-Ledger platform", theme: "Scientific / Enterprise" }
    - { pr: 87, title: "Enterprise compliance (DSAR/consent)", theme: Compliance }
    - { pr: 88, title: "Institutional multi-tenant", theme: Enterprise }
    - { pr: 89, title: "Disaster recovery & ops excellence", theme: Infrastructure }
    - { pr: 91, title: "HCE orchestration pipeline", theme: "AI / HCE" }
    - { pr: 92, title: "HCE architecture plan (docs)", theme: "AI / HCE" }
    - { pr: 93, title: "Full Technical SEO suite", theme: "Launch / SEO" }
    - { pr: 94, title: "AEO certification", theme: "Launch / AEO" }
    - { pr: 95, title: "GEO certification", theme: "Launch / GEO" }
    - { pr: 96, title: "HCE Phases A–D", theme: "AI / HCE" }
    - { pr: 97, title: "Brand & conversion", theme: Marketing }
    - { pr: 99, title: "Assessment reliability measurement", theme: Scientific }

rollback:
  previous_production_sha: "3765103c0f874999d8a9af6e89e4a9bc507574a1"
  previous_production_sha_short: "3765103"
  previous_vercel_deployment_id: "dpl_8sALZr8EFKvQmUgoYHiZYmqoiEJh"
  previous_github_deployment_id: 5732531800
  previous_deployed_at: "2026-08-03T19:42:53Z"
  procedure: "Vercel instant rollback to previous_vercel_deployment_id; do not roll back migration 20260804055602."

approval:
  executive_owner: "Aladdin Zayed (alhazayed)"
  executive_approval_date: null # set on human sign-off
  sign_off_status: "pending" # awaiting RC3–RC5 + executive approval
  sign_off_blockers:
    - "RC3 production validation"
    - "RC4 analytics / Search Console / alerts"
    - "RC5 tag v1.0.0 + release notes"
  notes: "RC1+RC2 evidence complete on production SHA 52a7610; public Version 1.0 GA not claimed until sign_off_status=approved."
```

---

## Field map (human index)

| Field | Value |
|-------|-------|
| Version | `v1.0.0` |
| Git commit SHA | `52a7610d732500c3c91067c270740edf4a1aaef3` |
| Release date | `2026-08-04` |
| GitHub release tag | `v1.0.0` (pending RC5 publish) |
| Vercel deployment ID | `dpl_2mBqyfzFEDCETctTSL7aFQR3HnDv` |
| Supabase project reference | `rrzudbkxigeavfdnidnm` |
| Migration snapshot hash | `sha256:d820fe31137f7602fd356a3e202f74f6180559a9748eae9e636c1817f826acc2` |
| Environment configuration version | `env.example.keys.137f8c24fc52` |
| OpenAI model(s) | chat `gpt-5`; STT `gpt-4o-transcribe`; gateway default `openai/gpt-4o-mini` |
| ElevenLabs voice registry version | `20260801160000` (model `eleven_multilingual_v2`) |
| Persona package version | `2026-08-02` (`sha256:25f23342…cde45`) |
| Clinical template version | Scenario Template Engine **v2.0** |
| Competency Graph version | Engine **v3.0** / DB `graph_version=1` |
| Adaptive Curriculum Engine version | **v3.0** |
| Quality Ledger schema version | `null` — deferred [#68](https://github.com/alhazayed/vpsych/pull/68) |
| Certification package version | `rc2-d7280366ee52` |
| Known deferred items | [`docs/V1_1_BACKLOG.md`](./V1_1_BACKLOG.md) (19 PRs) |
| Rollback target | SHA `3765103` / `dpl_8sALZr8EFKvQmUgoYHiZYmqoiEJh` |
| Executive approval | **pending** (date unset) |

## Refresh checklist

1. After each production deploy: update `git.commit_sha`, `vercel.deployment_id`, `release.date`.  
2. After migration apply: refresh `scripts/remote-schema-migrations.snapshot.json` and both migration hashes.  
3. At RC5: set `github_release_url`, stamp `approval.executive_approval_date`, set `sign_off_status: approved`.  
4. Keep `package.json` version aligned when tagging (`0.1.0` → `1.0.0` at RC5).
