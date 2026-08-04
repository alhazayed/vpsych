# RELEASE_MANIFEST

Machine-readable v1.0 inventory. **Not approved.**

```yaml
version: "0.1.0"
git_sha: "5bf66c07f11d286c305f59398a015614d22b723b"
production_deployment_id: "dpl_2mBqyfzFEDCETctTSL7aFQR3HnDv"
production_url: "https://vpsych.vercel.app"
supabase_project: "rrzudbkxigeavfdnidnm"
vercel_project: "prj_qiJ1mQvX0s5lJZ9KJnpWAx4EXjNm"
approval:
  sign_off_status: not_approved
  board_date: "2026-08-04"
  rc3_report: "docs/RC3_PRODUCTION_VALIDATION.md"
  reason: "RC3 Wave 1 failed — RC3-C1 CLEARED; RC3-C2 remains (no VPSYCH_AUDIT_* accounts)"
rc_phase: "RC3"
package_version: "0.1.0"
tag: null
release_timestamp: null
wave_status:
  wave_1:
    state: failed
    blockers: [RC3-C2]
    cleared: [RC3-C1]
    rerun_required: true
    rerun_after:
      - "Audit credentials configured"
  wave_2: { state: locked }
  wave_3: { state: locked }
  wave_4: { state: locked }
  wave_5: { state: locked }
  wave_6: { state: locked }
  wave_7: { state: locked }
migration_parity:
  main_sha: "5bf66c07f11d286c305f59398a015614d22b723b"
  main_files: 54
  production_schema_migrations: 54
  exact_parity: true
  reconciliation_pr: { number: 103, merged: true, merged_at: "2026-08-04T10:50:08Z" }
```
