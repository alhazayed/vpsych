# Audit Accounts (Certification)

Permanent identities for RC3+ production validation.  
**Do not store passwords in git.** Credentials live only in the secrets manager / cloud-agent environment.

```yaml
audit_accounts:
  therapist:
    enabled: true
    purpose: certification
    email: [REDACTED_THERAPIST_EMAIL]   # production Auth identity (public email, not a secret)
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
    email: [REDACTED_ADMIN_EMAIL]       # production Auth identity (public email, not a secret)
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
  status: accounts_ready_secrets_pending  # RC3-C2: vault injection + login verify
  verified_2026_08_04:
    auth_users: present
    profiles_role:
      [REDACTED_THERAPIST_EMAIL]: therapist
      [REDACTED_ADMIN_EMAIL]: admin
  remaining_steps:
    - Inject the four env vars into the RC agent / CI secrets
      (emails above; passwords from Release Manager vault — never commit)
    - Verify login on https://vpsych.vercel.app/login for both accounts
    - Check docs/rc3/WAVE1_UNLOCK_CHECKLIST.md injection + login boxes
    - Set provisioning.status: ready and clear RC3-C2
```

## Governance

- Auth users and `profiles.role` are **already provisioned** in production (`rrzudbkxigeavfdnidnm`).
- **RC3-C2 is an operational prerequisite**, not a VPsych application defect: evidence collection is blocked until the audit runner receives vault-managed `VPSYCH_AUDIT_*` credentials.
- Owner: **Release Manager**. Category: **Release Infrastructure**. Severity: Critical (blocks certification evidence, not platform correctness).
- Formal runbook: `docs/RELEASE_OPERATIONS_CHECKLIST.md`.
- RC4 / RC5 stay locked until Wave 1 PASS.
- Never commit real password values to this file.

## 2026-08-05 provisioning re-check (RDL-007)

- Auth users + roles: reconfirmed present (`audit.therapist@…` → therapist, `audit.admin@…` → admin).
- Audit credential env keys: present in audit environment.
- Values: **unusable** — each value equals its own key name (placeholder misconfiguration).
- Login verify: **FAIL** (`invalid_credentials`).
- Status remains blocked under RC3-C2. Details: `docs/rc3/WAVE1_RDL007_STOP.md`.

## 2026-08-05 provisioning re-check (RDL-008)

- Auth users + roles: reconfirmed
  (`audit.therapist@…` → therapist `1ed008c2-…`,
   `audit.admin@…` → admin `8545be46-…`; confirmed; not banned).
- Audit credential env keys: present; values **no longer** key-name placeholders.
- Email ↔ role env mapping: **FAIL** — therapist env email local=`audit.admin`,
  admin env email local=`audit.therapist` (swapped).
- Passwords: **FAIL** — 2×2 matrix (both canonical emails × both env passwords)
  → all `invalid_credentials` (vault passwords not applied to Auth, or wrong values).
- Login verify: **FAIL**.
- Status remains blocked under RC3-C2. Details: `docs/rc3/WAVE1_RDL008_STOP.md`.

