# Release Operations Checklist

Permanent operational runbook for every VPsych release candidate and public release.  
Complements technical certification (`docs/RC3_PRODUCTION_VALIDATION.md`, mission briefs) with **repeatable release infrastructure** tasks.

**Owner:** Release Manager  
**Rule:** Never hard-code vault secrets into the repository or commit them to version control.

---

## Current board status (v1.0 / RC3)

| Phase | Status |
|---|---|
| RC1 | ✅ PASSED |
| RC2 | ✅ PASSED |
| RC3 | 🟡 **WAITING** — operational prerequisite (not an application defect) |
| Platform / Infrastructure / Production / Repository | ✅ Ready for Wave 1 validation |
| Waves 2–7 · RC4 · RC5 · Public Release | 🔒 Locked until Wave 1 PASS |

VPsych itself is **not** failing certification. Automated certification cannot complete until the audit environment receives correctly mapped, Auth-synchronized vault credentials.

**RC3-C2 status after RDL-008:** infrastructure / production / repository / Auth users / env **keys** are correct. Remaining work is email↔role mapping and password sync between Supabase Auth and the vault — then **manual** login proof before any new Cursor Wave 1 run.

RC3 Wave 1 unlock detail: `docs/rc3/WAVE1_UNLOCK_CHECKLIST.md`  
Audit identities (no passwords): `docs/AUDIT_ACCOUNTS.md`  
Evidence SHA scope: `docs/RC3_EVIDENCE_SCOPE.md`  
Decision log (append-only): `docs/RELEASE_DECISION_LOG.md`  
Credential Verification Gate: § below (mandatory before certification)

### Roles

| Role | Owns |
|---|---|
| Release Manager | Vault → Auth sync → inject → **manual** login verify → trigger Wave 1 |
| Cursor | Credential gate check → Missions 1–5 evidence, verified defects only, PASS/FAIL — no speculative work |
| Executive Board | Review Wave 1; unlock Wave 2 only on PASS; process integrity |

---

## Credential Verification Gate (mandatory)

**Adopted RDL-009.** Before any certification wave that needs authenticated access begins, the Release Manager must prove audit credentials work. Cursor must refuse to start Missions 1–5 (and append an RDL STOP) if this gate fails.

```yaml
audit_credentials:
  therapist:
    email_local_expected: audit.therapist
    email_domain_expected: vpsych.dev
    email_matches_expected: false   # must be true
    login_success: false            # must be true (manual on production)
    profile_role: therapist
  admin:
    email_local_expected: audit.admin
    email_domain_expected: vpsych.dev
    email_matches_expected: false   # must be true
    login_success: false            # must be true (manual on production)
    profile_role: admin

precondition:
  require:
    - audit_credentials.therapist.email_matches_expected
    - audit_credentials.therapist.login_success
    - audit_credentials.admin.email_matches_expected
    - audit_credentials.admin.login_success
  if_false:
    stop_certification: true
    create_rdl_entry: true
    do_not_start_missions: [1, 2, 3, 4, 5]
    category: Release Infrastructure   # RC3-C2 — not an application defect
```

**Mapping rule:** the therapist env var must never point at the admin Auth user, and vice versa.

| Environment variable | Must contain |
|---|---|
| `VPSYCH_AUDIT_THERAPIST_EMAIL` | local `audit.therapist` @ domain `vpsych.dev` |
| `VPSYCH_AUDIT_THERAPIST_PASSWORD` | password that unlocks that therapist Auth user |
| `VPSYCH_AUDIT_ADMIN_EMAIL` | local `audit.admin` @ domain `vpsych.dev` |
| `VPSYCH_AUDIT_ADMIN_PASSWORD` | password that unlocks that admin Auth user |

---

## Governance state machine

```text
RC1 → RC2 → RC3
              │
              ├── Waiting → Operational prerequisite (Release Manager)
              │              Credential Verification Gate MUST PASS
              │              (manual login on production before Cursor)
              ▼
           Wave 1 PASS → Wave 2 → Wave 3 → Wave 4 → Wave 5
                                              │
                                              ▼
                                    Executive Board
                                              │
                                              ▼
                                    RC4 → RC5 → Public Release
```

Do not skip gates. Do not restart completed infrastructure certification (e.g. migration parity) after every later fix unless that artifact changed. Do not consume a Cursor certification cycle until manual login succeeds.

---

## RC3 — Release Manager runbook (current unlock)

Exact checklist after RDL-006 → RDL-007 → RDL-008. Do these **in order**. Do **not** launch Cursor until Step 4 passes.

### Step 1 — Verify Supabase Auth users

Open Supabase Dashboard → Authentication → Users for project `rrzudbkxigeavfdnidnm`.

| Expected role | Expected email local | Domain | Auth user id |
|---|---|---|---|
| Therapist | `audit.therapist` | `vpsych.dev` | `1ed008c2-9ac0-4343-b1ca-a16db4eabb4d` |
| Admin | `audit.admin` | `vpsych.dev` | `8545be46-2592-4de2-aaa7-4a27a022def7` |

Confirm both exist, are confirmed, and are not banned. Confirm `profiles.role` matches the table above.

### Step 2 — Reset passwords (do not assume the vault is correct)

RDL-008 proved vault/env passwords do **not** authenticate either account.

1. Reset **both** passwords in Supabase Auth (Dashboard → user → reset password, or your normal secure Admin API process).
2. **Immediately** update the vault with the new values.
3. Never commit passwords to git.

### Step 3 — Verify environment mapping

Inject / update the four variables in the Cursor / CI audit environment:

| Environment variable | Must contain |
|---|---|
| `VPSYCH_AUDIT_THERAPIST_EMAIL` | `audit.therapist` @ `vpsych.dev` |
| `VPSYCH_AUDIT_THERAPIST_PASSWORD` | therapist vault password (post-reset) |
| `VPSYCH_AUDIT_ADMIN_EMAIL` | `audit.admin` @ `vpsych.dev` |
| `VPSYCH_AUDIT_ADMIN_PASSWORD` | admin vault password (post-reset) |

Confirm: therapist variable never points at the admin account; admin variable never points at the therapist account. Confirm values are **not** equal to their own key names (RDL-007 class of failure).

### Step 4 — Manual verification (before Cursor)

On `https://vpsych.vercel.app/login`, **personally** verify:

| Check | Result | Notes |
|---|---|---|
| Therapist login succeeds | ☐ | lands as therapist; can reach therapist surfaces |
| Admin login succeeds | ☐ | lands as admin; can reach `/admin` |
| Roles / permissions look correct | ☐ | therapist denied report/admin paths; admin allowed |

Record for the certification archive:

| Field | Value |
|---|---|
| Timestamp (UTC) | |
| Environment | production (`vpsych.vercel.app`) |
| Production SHA | `5bf66c07f11d286c305f59398a015614d22b723b` (update if superseded) |
| Auditor / Release Manager | |

**If either login fails: stop. Fix Auth/vault/env. Do not start Cursor.**

### Step 5 — Start a fresh Cursor agent (Wave 1 only)

1. Launch a **new** Cursor cloud agent (existing VMs may not pick up secret value changes).
2. Prompt: `Run Wave 1` (Missions 1–5 only).
3. Cursor must re-check the Credential Verification Gate; on FAIL → STOP + RDL entry; on PASS → execute Missions 1–5 only.
4. Do not restart RC1/RC2 or migration integrity work.

### Step 6 — Board decision (after Wave 1 evidence)

If **no Critical** and **no High** findings:

```yaml
wave_1:
  state: passed
  unlocked_by:
    release_manager: <name>
    at: <UTC timestamp>
```

Then unlock Wave 2 and continue RC3 in order (Waves 2→5 → Executive Board → RC4 → RC5).

If any Critical or High finding appears, record it in `docs/RC3_PRODUCTION_VALIDATION.md`, remediate, and re-run **only the affected Wave 1 missions** — not the full 30-mission set.

---

## Recurring checklist (every future release)

Use this for v1.0 cutover and for v1.1 / v1.2 / … so releases do not depend on institutional memory.

### Pre-certification

- [ ] Verify production SHA matches intended `main` (or release branch) commit
- [ ] Verify migration parity (repo count ≡ production `schema_migrations`; exact version sets)
- [ ] Confirm schema / integrity evidence is scoped (`docs/RC3_EVIDENCE_SCOPE.md` or successor)
- [ ] Confirm backup completed (Supabase / operational backup policy)
- [ ] Confirm rollback target documented (prior production deployment ID + SHA)

### Credential Verification Gate (block certification if any box fails)

- [ ] Auth users exist with expected local parts (`audit.therapist` / `audit.admin`) and roles
- [ ] Passwords reset (or confirmed) in Supabase Auth and synced to vault
- [ ] Env emails map to the correct role (no swap)
- [ ] Env passwords authenticate (not placeholders; not stale vault copies)
- [ ] **Manual** therapist login PASS on production
- [ ] **Manual** admin login PASS on production
- [ ] Record timestamp, environment, production SHA, auditor
- [ ] If any false → **stop certification** + append RDL entry (do not launch Cursor)

### Certification execution

- [ ] Fresh Cursor agent (picks up updated secrets)
- [ ] Run required certification missions for this RC phase (scope per wave_status)
- [ ] Archive certification reports and artifacts
- [ ] Update `docs/RC*_*.md` / mission briefs with verdicts

### Cutover (after Executive Board approval)

- [ ] Confirm monitoring and alerting
- [ ] Record Executive Board approval (append row to `docs/RELEASE_DECISION_LOG.md`)
- [ ] Update `RELEASE_MANIFEST.md`
- [ ] Create Git tag
- [ ] Publish GitHub Release
- [ ] Confirm production alias still serves the approved SHA

### Post-release

- [ ] Rotate or retain audit credentials per `docs/AUDIT_ACCOUNTS.md` rotation policy
- [ ] File any deferred Medium/Low findings for the next RC cycle

---

## Related documents

| Doc | Role |
|---|---|
| `docs/rc3/WAVE1_UNLOCK_CHECKLIST.md` | Current RC3 Wave 1 gate boxes |
| `docs/AUDIT_ACCOUNTS.md` | Permanent audit identities (no secrets) |
| `docs/RC3_PRODUCTION_VALIDATION.md` | RC3 master verdict |
| `docs/RC3_EVIDENCE_SCOPE.md` | Which SHA/branch a result is valid for |
| `docs/RC4_BUGFIX_FREEZE.md` | Post-RC3 freeze (**locked** until Wave 1 PASS) |
| `docs/RC5_RELEASE_CHECKLIST.md` | Tag / GitHub Release tasks (**locked**) |
| `docs/RELEASE_DECISION_LOG.md` | Append-only governance trail |
| `RELEASE_MANIFEST.md` | Machine-readable inventory |
