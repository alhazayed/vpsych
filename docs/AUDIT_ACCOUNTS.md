# Audit Accounts (Certification)

Permanent identities for RC3+ production validation.  
**Do not store passwords in git.** Credentials live only in the secrets manager / cloud-agent environment.

```yaml
audit_accounts:
  therapist:
    enabled: true
    purpose: certification
    email: audit.therapist@…   # local audit.therapist / domain vpsych.dev (public Auth identity)
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
    email: audit.admin@…       # local audit.admin / domain vpsych.dev (public Auth identity)
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
  status: accounts_ready_secrets_pending  # RC3-C2: Auth/vault sync + Credential Verification Gate
  credential_verification_gate:           # RDL-009 — mandatory before certification
    therapist:
      email_local_expected: audit.therapist
      email_domain_expected: vpsych.dev
      email_matches_expected: pending
      login_success: pending              # manual on production
    admin:
      email_local_expected: audit.admin
      email_domain_expected: vpsych.dev
      email_matches_expected: pending
      login_success: pending
    if_false:
      stop_certification: true
      create_rdl_entry: true
  verified_2026_08_04:
    auth_users: present
    profiles_role:
      audit.therapist@…: therapist
      audit.admin@…: admin
  remaining_steps:
    - Reset both Auth passwords; sync vault immediately (do not assume vault is current)
    - Inject four env vars with correct email↔role mapping (no swap)
    - Manual login PASS on https://vpsych.vercel.app for both accounts
    - Check docs/rc3/WAVE1_UNLOCK_CHECKLIST.md Credential Verification Gate boxes
    - Only then launch a fresh Cursor agent for Wave 1
    - Set provisioning.status: ready and clear RC3-C2
```

## Governance

- Auth users and `profiles.role` are **already provisioned** in production (`rrzudbkxigeavfdnidnm`).
- **RC3-C2 is an operational prerequisite**, not a VPsych application defect: evidence collection is blocked until the audit runner receives correctly mapped, Auth-synchronized vault credentials **and** the Credential Verification Gate passes (manual login on production).
- Owner: **Release Manager**. Category: **Release Infrastructure**. Severity: Critical (blocks certification evidence, not platform correctness).
- Formal runbook: `docs/RELEASE_OPERATIONS_CHECKLIST.md` (includes the five-step RM checklist + gate).
- Long-term policy: `docs/RELEASE_GOVERNANCE.md` (RDL-010) — Credential Verification Gate binds every future release.
- RC4 / RC5 stay locked until Wave 1 PASS.
- Never commit real password values to this file.
- Cursor must **stop certification** and create an RDL entry if `email_matches_expected` or `login_success` is false for either account.

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

