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
  board_date: "2026-08-05"
  rc3_report: "docs/RC3_PRODUCTION_VALIDATION.md"
  reason: "RC3 Wave 1 STOP (RDL-008) — VPSYCH_AUDIT_* no longer placeholders, but emails swapped across role env vars and both passwords fail Auth password-grant; C1 CLEARED; C2 Release Infrastructure"
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
    last_attempt: "2026-08-05"
    last_decision: RDL-008
    rerun_after:
      - "Wire therapist email env local=`audit.therapist` and admin email env local=`audit.admin`"
      - "Apply vault passwords to those Auth users (or inject the passwords that actually unlock them)"
      - "Login verification PASS on https://vpsych.vercel.app for therapist + admin"
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
release_decision_log: "docs/RELEASE_DECISION_LOG.md"
wave1_unlock: "docs/rc3/WAVE1_UNLOCK_CHECKLIST.md"
```
