# Audit Accounts (Certification)

Permanent identities for RC3+ production validation.  
**Do not store passwords in git.** Credentials live only in Postgres Vault + the secrets manager / cloud-agent environment.

```yaml
audit_accounts:
  therapist:
    enabled: true
    purpose: certification
    email: audit.therapist@…
    env_email: VPSYCH_AUDIT_THERAPIST_EMAIL
    env_password: VPSYCH_AUDIT_THERAPIST_PASSWORD
    profile_role: therapist
    auth_user_id: 1ed008c2-9ac0-4343-b1ca-a16db4eabb4d
    vault_secret: vpsych_audit_therapist_password
    used_by:
      - RC3 Wave 1 Missions 1–5
      - RC3 Waves 2–3 runtime (session, voice, ACE/CGE paths)
      - scripts/prod-validate-sessions.mjs

  admin:
    enabled: true
    purpose: certification
    email: audit.admin@…
    env_email: VPSYCH_AUDIT_ADMIN_EMAIL
    env_password: VPSYCH_AUDIT_ADMIN_PASSWORD
    profile_role: admin
    auth_user_id: 8545be46-2592-4de2-aaa7-4a27a022def7
    vault_secret: vpsych_audit_admin_password
    used_by:
      - RC3 Wave 1 Missions 2, 5 (admin gate, /api/health/openai)
      - Report read paths
      - Admin API certification

rotation:
  owner: Release Manager
  cadence: on compromise or annual (whichever first)
  notes: >
    Accounts must remain permanent and dedicated — not personal developer
    logins — so every RC cycle and automated audit hits the same identities.
    After any Auth password change, update Vault immediately, then Cursor
    (and Vercel if used) from Vault — never the reverse.

provisioning:
  status: ready
  credential_verification_gate:           # RDL-009 / RDL-011
    evidence_id: RC3-C2-EV-20260805T1245Z
    therapist:
      email_local_expected: audit.therapist
      email_domain_expected: vpsych.dev
      email_matches_expected: true          # after Vault inject / correct mapping
      login_success: true                   # browser on production 2026-08-05
      password_grant: true                  # HTTP 200 + access_token
    admin:
      email_local_expected: audit.admin
      email_domain_expected: vpsych.dev
      email_matches_expected: true
      login_success: true
      password_grant: true
    matrix_shape: exactly_diagonal          # two 200 on diagonal, two 400 anti-diagonal
    role_separation:
      therapist_denied_admin_apis: true     # 403
      admin_admitted_admin_apis: true       # 200
    if_false:
      stop_certification: true
      create_rdl_entry: true
  verified_2026_08_05:
    auth_users: present
    profiles_role:
      audit.therapist@…: therapist
      audit.admin@…: admin
    vault_secrets:
      - vpsych_audit_therapist_password
      - vpsych_audit_admin_password
      - report_write_key
    production_sha: 5bf66c0
    deployment: dpl_5F6pBTi21VrYWaxmWSRcNnCcxTA4
    migrations: 54 ≡ 54
  remaining_steps:
    - Release Manager: update persistent Cursor environment secrets from Vault (unswap emails + set vault passwords)
    - Run scripts/rc3-credential-gate-preflight.mjs
    - Launch a FRESH Cursor agent for Wave 1 only
```

## Governance

- Auth users and `profiles.role` are provisioned in production (`rrzudbkxigeavfdnidnm`).
- **RC3-C2 was an operational prerequisite**, not a VPsych application defect. Cleared by RDL-011 after gate PASS (`docs/rc3/RC3_C2_GATE_PASS.md`).
- Owner: **Release Manager**. Category: **Release Infrastructure**.
- Formal runbook: `docs/rc3/RC3_C2_CREDENTIAL_GATE_RUNBOOK.md` + `docs/RELEASE_OPERATIONS_CHECKLIST.md`.
- Long-term policy: `docs/RELEASE_GOVERNANCE.md` (RDL-010) — Credential Verification Gate binds every future release.
- Never commit real password values to this file.
- Cursor must **stop certification** and create an RDL entry if `email_matches_expected` or `login_success` is false for either account.

## Incident history (do not erase)

### 2026-08-05 RDL-007 — placeholder secrets

- All four `VPSYCH_AUDIT_*` values equaled their own key names. Login FAIL.

### 2026-08-05 RDL-008 — email swap + invalid passwords

- Emails swapped across role env vars; 2×2 password matrix all `invalid_credentials`.

### 2026-08-05 RDL-011 — gate PASS

- Vault source of record restored (prior recovery at 12:08Z); this run completed password-grant, role separation, and browser login. Primary root cause: **password material mismatch**; email swap secondary.
