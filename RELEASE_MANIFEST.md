# RELEASE_MANIFEST

Machine-readable v1.0 inventory. **Not approved.**

```yaml
version: "0.1.0"
git_sha: "5bf66c07f11d286c305f59398a015614d22b723b"
production_deployment_id: "dpl_5F6pBTi21VrYWaxmWSRcNnCcxTA4"
production_url: "https://vpsych.vercel.app"
supabase_project: "rrzudbkxigeavfdnidnm"
vercel_project: "prj_qiJ1mQvX0s5lJZ9KJnpWAx4EXjNm"
approval:
  sign_off_status: not_approved
  board_date: "2026-08-04"
  rc3_report: "docs/RC3_PRODUCTION_VALIDATION.md"
  reason: "RC3 Wave 1 waiting — evidence collection blocked on RC3-C2 operational prerequisite (vault VPSYCH_AUDIT_*); C1 CLEARED (54≡54, schema diff 0, integrity 100/100 rebound to main@5bf66c0); C2 is Release Infrastructure not an application defect"
rc_phase: "RC3"
package_version: "0.1.0"
tag: null
release_timestamp: null
wave_status:
  wave_1:
    state: waiting
    blockers: [RC3-C2]  # operational prerequisite / Release Infrastructure / owner Release Manager
    cleared: [RC3-C1]
    rerun_required: true
    rerun_after:
      - "VPSYCH_AUDIT_* injected (see docs/AUDIT_ACCOUNTS.md)"
      - "Login verification on https://vpsych.vercel.app"
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
  schema_diff: 0
  integrity_scores_rebound_to_main: true
  evidence_scope: "docs/RC3_EVIDENCE_SCOPE.md"
  reconciliation_pr: { number: 103, merged: true, merged_at: "2026-08-04T10:50:08Z" }
production_deploy:
  id: "dpl_5F6pBTi21VrYWaxmWSRcNnCcxTA4"
  sha: "5bf66c07f11d286c305f59398a015614d22b723b"
  target: production
  ready_state: READY
audit_accounts: "docs/AUDIT_ACCOUNTS.md"  # secrets not in git
release_operations: "docs/RELEASE_OPERATIONS_CHECKLIST.md"
wave1_unlock: "docs/rc3/WAVE1_UNLOCK_CHECKLIST.md"
```
