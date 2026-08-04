# Audit Accounts (Certification)

Permanent identities for RC3+ production validation.  
**Do not store passwords in git.** Credentials live only in the secrets manager / cloud-agent environment.

```yaml
audit_accounts:
  therapist:
    enabled: true
    purpose: certification
    email: audit.therapist@vpsych.dev   # production Auth identity (public email, not a secret)
    env_email: VPSYCH_AUDIT_THERAPIST_EMAIL
    env_password: VPSYCH_AUDIT_THERAPIST_PASSWORD
    profile_role: therapist
    auth_user_id: 1ed008c2-9ac0-4343-b1ca-a16db4eabb4d
    used_by:
      - RC3 Wave 1 Missions 1–5
      - RC3 Waves 2–3 runtime (session, voice, ACE/CGE paths)
      - scripts/prod-validate-sessions.mjs

  admin:
    enabled: true
    purpose: certification
    email: audit.admin@vpsych.dev       # production Auth identity (public email, not a secret)
    env_email: VPSYCH_AUDIT_ADMIN_EMAIL
    env_password: VPSYCH_AUDIT_ADMIN_PASSWORD
    profile_role: admin
    auth_user_id: 8545be46-2592-4de2-aaa7-4a27a022def7
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

provisioning:
  status: accounts_ready_secrets_pending  # RC3-C2 remaining: inject secrets + verify login
  verified_2026_08_04:
    auth_users: present
    profiles_role:
      audit.therapist@vpsych.dev: therapist
      audit.admin@vpsych.dev: admin
  remaining_steps:
    - Inject the four env vars into the RC agent / CI secrets
      (emails above; passwords from Release Manager vault — never commit)
    - Verify login on https://vpsych.vercel.app/login for both accounts
    - Check the WAVE1_UNLOCK_CHECKLIST RC3-C2 boxes
    - Set provisioning.status: ready and clear RC3-C2
```

## Governance

- Auth users and `profiles.role` are **already provisioned** in production (`rrzudbkxigeavfdnidnm`).
- Until secrets are injected and login is verified, Wave 1 remains **failed** on **RC3-C2** (environment / operational gate, not missing users).
- RC4 / RC5 stay locked until Wave 1 PASS.
- Never commit real password values to this file.
