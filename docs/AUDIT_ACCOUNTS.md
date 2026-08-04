# Audit Accounts (Certification)

Permanent identities for RC3+ production validation.  
**Do not store passwords in git.** Credentials live only in the secrets manager / cloud-agent environment.

```yaml
audit_accounts:
  therapist:
    enabled: true
    purpose: certification
    env_email: VPSYCH_AUDIT_THERAPIST_EMAIL
    env_password: VPSYCH_AUDIT_THERAPIST_PASSWORD
    profile_role: therapist
    used_by:
      - RC3 Wave 1 Missions 1–5
      - RC3 Waves 2–3 runtime (session, voice, ACE/CGE paths)
      - scripts/prod-validate-sessions.mjs

  admin:
    enabled: true
    purpose: certification
    env_email: VPSYCH_AUDIT_ADMIN_EMAIL
    env_password: VPSYCH_AUDIT_ADMIN_PASSWORD
    profile_role: admin
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
  status: pending  # RC3-C2
  steps:
    - Create users in production Supabase Auth
    - Set profiles.role to therapist / admin respectively
    - Inject the four env vars into the RC agent / CI secrets
    - Verify login on https://vpsych.vercel.app/login
    - Check the WAVE1_UNLOCK_CHECKLIST RC3-C2 boxes
```

## Governance

- Until `provisioning.status: ready`, Wave 1 remains **failed** on **RC3-C2**.
- RC4 / RC5 stay locked until Wave 1 PASS.
- Never commit real email/password values to this file.
