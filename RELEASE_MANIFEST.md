# RELEASE_MANIFEST

Machine-readable v1.0 inventory. **Not approved.**

```yaml
version: "0.1.0"
git_sha: "52a7610d732500c3c91067c270740edf4a1aaef3"
production_deployment_id: "dpl_2mBqyfzFEDCETctTSL7aFQR3HnDv"
production_url: "https://vpsych.vercel.app"
supabase_project: "rrzudbkxigeavfdnidnm"
vercel_project: "prj_qiJ1mQvX0s5lJZ9KJnpWAx4EXjNm"
approval:
  sign_off_status: not_approved
  board_date: "2026-08-04"
  rc3_report: "docs/RC3_PRODUCTION_VALIDATION.md"
  reason: "RC3 Wave 1 failed — RC3-C1 (main 28 vs prod 54; parity on PR #103 only) + RC3-C2 (no VPSYCH_AUDIT_* accounts)"
rc_phase: "RC3"
package_version: "0.1.0"
tag: null
release_timestamp: null
wave_status:
  wave_1:
    state: failed
    blockers: [RC3-C1, RC3-C2]
    rerun_required: true
    rerun_after:
      - "PR #103 merged to main"
      - "Audit credentials configured"
  wave_2: { state: locked }
  wave_3: { state: locked }
  wave_4: { state: locked }
  wave_5: { state: locked }
  wave_6: { state: locked }
  wave_7: { state: locked }
migration_parity:
  main_at_rc3_audit: { sha: "52a7610d732500c3c91067c270740edf4a1aaef3", files: 28 }
  production_schema_migrations: 54
  reconciliation_pr: { number: 103, sha: "5c879f4", files: 54, integrity_scores: "100/100 on PR branch only", merged: false }
```
