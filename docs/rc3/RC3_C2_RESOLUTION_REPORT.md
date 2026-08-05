# RC3-C2 — Resolution Report

**Evidence ID:** `RC3-C2-EV-20260805T1208Z`
**Decision reference:** RDL-009 (Credential Verification Gate)
**Category:** Release Infrastructure (not an application defect)
**Date:** 2026-08-05T12:08:31Z
**Repo SHA audited:** `5bf66c07f11d286c305f59398a015614d22b723b` (`5bf66c0`, ≡ production `dpl_5F6pBTi…`)
**Supabase project:** `rrzudbkxigeavfdnidnm`
**Vercel project:** `prj_qiJ1mQvX0s5lJZ9KJnpWAx4EXjNm` (`vpsych`)
**Final decision:** ❌ **RC3-C2 NOT RESOLVED** — root cause identified and the credential half repaired; the gate cannot be closed from this runtime.

---

## Executive Summary

RC3-C2 was reported as "therapist/admin email mapping incorrect" and "authentication
fails". Both are real symptoms, but neither is the root cause, and neither originates
in production.

Production Auth is **correct and healthy**. Both canonical audit users exist with the
right emails, the right `profiles.role`, confirmed addresses, no ban, and usable
password hashes. Nothing about the production email↔role mapping is wrong.

The true root cause is that **the audit credentials have never had a source of
record.** The passwords existed only as one-way bcrypt hashes inside `auth.users`.
The Postgres Vault — which the Release Operations runbook repeatedly names as the
credential store ("apply vault passwords", "written to vault", "sync vault") — did
**not** contain them and never had. The only secret in Vault was `report_write_key`.
Consequently the `VPSYCH_AUDIT_*` values injected into the Cursor runner were
hand-transcribed rather than derived from any authority, which is exactly how they
came to be swapped across roles (RDL-008) and how they came to authenticate nothing.

That gap is now closed: both audit passwords have been reset and written to Vault,
and both are verified to unlock their respective Auth users.

Two gate criteria remain unprovable from this runtime, for reasons outside the
credential system — see **Credential Verification Result**.

---

## Root Cause

**Primary — no credential source of record for the audit accounts.**

The audit accounts were provisioned out-of-band on 2026-08-01 by direct SQL
(their hashes carried a `$2a$06$` bcrypt cost, the pgcrypto `gen_salt('bf')`
default, rather than the `$2a$10$` GoTrue produces through the Auth API). The
plaintexts were never persisted anywhere retrievable — not in Vault, not in the
repository, not in CI secrets. Once set, they were unrecoverable by design.

Every downstream failure follows from that single fact:

| Reported symptom | Actual cause |
|---|---|
| "Email mapping incorrect" | `VPSYCH_AUDIT_*` values were hand-entered into the Cursor secret store with no authority to check against, and got transposed across roles. Production mapping was never wrong. |
| "Authentication fails" | The injected passwords never matched the Auth hashes, because no process ever wrote the Auth passwords *to* the store the runner reads *from*. |
| "Credential Verification Gate fails" | Both of the above. |

**Contributing — an undocumented out-of-band password rotation.**

`audit.admin@vpsych.dev` had `updated_at = 2026-08-04T14:04:15Z`, later than its
last successful sign-in (`2026-08-03T16:08:45Z`), while `audit.therapist@vpsych.dev`
was untouched since its own last sign-in (`2026-08-03T04:40:24Z`). The admin
credential was therefore changed on 2026-08-04 with no corresponding record,
guaranteeing that any previously working copy went stale.

**Not the cause — explicitly ruled out by evidence:** production Auth user state,
role assignment, email confirmation, ban status, `profiles.role`, deployment SHA,
migration parity, Vercel deployment protection, and application code. No application
defect is implicated in RC3-C2.

---

## Evidence

### E1 — Production Auth users (STEP 1) — PASS

Query against `auth.users` ⋈ `public.profiles`:

| Email | UUID | `profiles.role` | Confirmed | Banned | Deleted |
|---|---|---|---|---|---|
| `audit.therapist@vpsych.dev` | `1ed008c2-9ac0-4343-b1ca-a16db4eabb4d` | `therapist` | ✅ | ❌ none | ❌ none |
| `audit.admin@vpsych.dev` | `8545be46-2592-4de2-aaa7-4a27a022def7` | `admin` | ✅ | ❌ none | ❌ none |

Both `aud = authenticated`, `provider = email`, `is_sso_user = false`.
**The production email↔role mapping is correct and always was.**

### E2 — Credential store inventory (STEP 2/3) — ROOT CAUSE

`vault.secrets` before remediation contained exactly one row:

```
report_write_key    HMAC key for create_session_report signatures    2026-07-30
```

No audit credential existed in Vault. The runbook's "vault passwords" had no
referent. `VPSYCH_AUDIT_THERAPIST_EMAIL`, `VPSYCH_AUDIT_ADMIN_EMAIL`,
`VPSYCH_AUDIT_THERAPIST_PASSWORD`, `VPSYCH_AUDIT_ADMIN_PASSWORD` are consumed only
by `scripts/prod-validate-sessions.mjs` (runner-side); no application code path reads
them, and they are absent from the repository and from CI (`.github/workflows/ci.yml`
declares only `SUPABASE_DB_URL`).

### E3 — Out-of-band rotation of the admin credential

| Email | `last_sign_in_at` | `updated_at` (pre-remediation) | Reading |
|---|---|---|---|
| `audit.therapist@vpsych.dev` | 2026-08-03T04:40:24Z | 2026-08-03T04:40:24Z | untouched since last successful login |
| `audit.admin@vpsych.dev` | 2026-08-03T16:08:45Z | **2026-08-04T14:04:15Z** | credential changed after last login, unrecorded |

Both accounts carried `$2a$06$` hashes, confirming SQL-side provisioning rather than
Auth-API provisioning.

### E4 — Prior attempts corroborate, and rule out a retry-only fix

From `docs/rc3/WAVE1_RDL008_STOP.md` (branch `cursor/wave1-reattempt-5f72`, PR #106):
the full 2×2 matrix of both injected passwords against both canonical emails returned
HTTP 400 `invalid_credentials`. RDL-007 recorded env values equal to their own key
names; RDL-006 recorded all four variables missing.

This is decisive for the remediation choice: **no injected password authenticated
either account**, so resetting both destroyed no working credential.

### E5 — Egress restriction on this runtime (blocks STEP 5)

Outbound HTTPS from this recovery session is policy-filtered. Both hosts required for
token issuance are denied:

```
403  Host not in allowlist: rrzudbkxigeavfdnidnm.supabase.co
     GET /auth/v1/health, GET /auth/v1/settings, POST /auth/v1/token?grant_type=password
403  https://vpsych.vercel.app/login
```

This is a property of the recovery session's network policy, **not** of production.
Vercel deployment protection was checked independently and is not the cause:
`passwordProtection.enabled = false`, `ssoProtection` scoped to `preview` only,
`trustedIps.enabled = false` — production is publicly reachable from an unrestricted
network. Per the proxy operating rules, a policy denial is reported, not routed around.

### E6 — Post-remediation verification (bcrypt layer)

| Email | `profiles.role` | Vault secret | Hash cost | Vault password unlocks Auth user | Meets `password-policy.ts` |
|---|---|---|---|---|---|
| `audit.therapist@vpsych.dev` | `therapist` | `vpsych_audit_therapist_password` | `$2a$10$` | ✅ **true** | ✅ |
| `audit.admin@vpsych.dev` | `admin` | `vpsych_audit_admin_password` | `$2a$10$` | ✅ **true** | ✅ |

Verified with `encrypted_password = crypt(<vault secret>, encrypted_password)` — the
same bcrypt comparison GoTrue performs on a password grant. Hashes are now at cost 10,
matching what the Auth API itself produces.

---

## Actions Performed

All actions were confined to release infrastructure. **No application code, schema,
migration, RLS policy, API, prompt, persona, or assessment was touched.**

1. **Inspected** production Auth users, roles, confirmation, ban and delete state (E1).
2. **Inspected** `vault.secrets`, repository, and CI configuration for a credential
   source of record — found none (E2).
3. **Inspected** `auth.audit_log_entries` — empty (retention window elapsed); no login
   telemetry available for the failing window.
4. **Inspected** Vercel project deployment protection and the production deployment
   (`dpl_5F6pBTi…`, `target: production`, SHA `5bf66c0`) (E5).
5. **Reset** both audit passwords. Plaintexts were generated *inside* Postgres
   (`gen_random_bytes`) and hashed with `crypt(…, gen_salt('bf', 10))` in the same
   statement, so no plaintext ever transited a log, transcript, or file.
6. **Synchronized** both plaintexts into the Postgres Vault as
   `vpsych_audit_therapist_password` and `vpsych_audit_admin_password`, establishing
   the source of record that RC3-C2 lacked.
7. **Verified** each Vault secret unlocks its intended Auth user at the bcrypt layer (E6).

**Not performed** (outside this runtime's access, and outside the permitted scope):
setting `VPSYCH_AUDIT_*` in the Cursor secret store; browser or password-grant login.

---

## Authentication Matrix

| Account | Expected role | Prod email correct | Role correct | Confirmed / unbanned | Password known & recorded | Bcrypt verify | Token issued |
|---|---|---|---|---|---|---|---|
| `audit.therapist@vpsych.dev` | `therapist` | ✅ | ✅ `therapist` | ✅ / ✅ | ✅ Vault | ✅ | ⛔ blocked (E5) |
| `audit.admin@vpsych.dev` | `admin` | ✅ | ✅ `admin` | ✅ / ✅ | ✅ Vault | ✅ | ⛔ blocked (E5) |

⛔ = not attempted-and-failed; **not executable** from this runtime because the Auth
host is outside the session's egress allowlist. This is not evidence of an
authentication failure.

---

## Credential Verification Result

```yaml
gate: RC3-C2 Credential Verification Gate (RDL-009)
evidence_id: RC3-C2-EV-20260805T1208Z
audit_credentials:
  therapist:
    auth_user_correct: true
    role_correct: true
    password_recorded_in_vault: true
    password_unlocks_auth_user: true      # bcrypt-verified
    email_matches_expected: unverified    # Cursor secret store not readable here
    login_success: unverified             # egress-blocked, not failed
    therapist_access_token: unverified
  admin:
    auth_user_correct: true
    role_correct: true
    password_recorded_in_vault: true
    password_unlocks_auth_user: true      # bcrypt-verified
    email_matches_expected: unverified
    login_success: unverified
    admin_access_token: unverified
gate_status: NOT_PASSED
blocking:
  - cursor_secret_store_not_writable_from_this_runtime
  - auth_host_outside_session_egress_allowlist
```

The gate requires `email_matches_expected`, `login_success`,
`therapist_access_token` and `admin_access_token` to all be `true`. Four of those are
`unverified` rather than `false`. **`unverified` is not `PASS`** — the gate is not closed.

---

## Exact Operational Action Still Required

Two steps remain, both requiring access this runtime does not have. Neither involves
software change.

**1. Inject the recorded credentials into the Cursor secret store** (Release Manager).

Read the two plaintexts from the Supabase SQL editor — they are not in git and are not
printed anywhere:

```sql
select name, decrypted_secret
from vault.decrypted_secrets
where name in ('vpsych_audit_therapist_password', 'vpsych_audit_admin_password');
```

Set exactly, minding the swap that caused RDL-008:

| Variable | Value |
|---|---|
| `VPSYCH_AUDIT_THERAPIST_EMAIL` | `audit.therapist@vpsych.dev` |
| `VPSYCH_AUDIT_ADMIN_EMAIL` | `audit.admin@vpsych.dev` |
| `VPSYCH_AUDIT_THERAPIST_PASSWORD` | `vpsych_audit_therapist_password` from Vault |
| `VPSYCH_AUDIT_ADMIN_PASSWORD` | `vpsych_audit_admin_password` from Vault |

Confirm each email's local part before saving: therapist → `audit.therapist`,
admin → `audit.admin`.

**2. Prove login and capture tokens**, from a network that can reach
`rrzudbkxigeavfdnidnm.supabase.co` and `vpsych.vercel.app` — a Release Manager
workstation, or an agent runtime whose egress allowlist includes both hosts.

Manual login at `https://vpsych.vercel.app/login` for each account, or a password
grant against `POST /auth/v1/token?grant_type=password`. Expect HTTP 200 with an
`access_token` whose `sub` claim is `1ed008c2-9ac0-4343-b1ca-a16db4eabb4d` for the
therapist and `8545be46-2592-4de2-aaa7-4a27a022def7` for the admin. Confirm the
therapist account sees no admin surface and the admin account does.

Then tick `docs/rc3/WAVE1_UNLOCK_CHECKLIST.md` and dispatch Wave 1 on a **fresh**
agent run, since existing runners will not pick up changed secret values.

---

## Final Decision

❌ **RC3-C2 NOT RESOLVED**

**Credential Verification Gate: NOT PASSED.**

**Wave 1 must NOT be dispatched.**

The root cause is identified with evidence and the credential defect itself is
repaired — both audit passwords are now known, recorded in Vault, and proven to unlock
their Auth users. What remains is injection into the Cursor secret store and a login
performed from a network permitted to reach the Auth host. Neither is available from
this runtime, and the gate is not declared passed on inference.

Engineering remains frozen. Missions 1–5 not started. Waves 2–7 remain locked.
