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

VPsych itself is **not** failing certification. Automated certification cannot complete until the audit environment receives vault-managed credentials.

RC3 Wave 1 unlock detail: `docs/rc3/WAVE1_UNLOCK_CHECKLIST.md`  
Audit identities (no passwords): `docs/AUDIT_ACCOUNTS.md`  
Evidence SHA scope: `docs/RC3_EVIDENCE_SCOPE.md`

---

## Governance state machine

```text
RC1 → RC2 → RC3
              │
              ├── Waiting → Operational prerequisite (Release Manager)
              │
              ▼
           Wave 1 PASS → Wave 2 → Wave 3 → Wave 4 → Wave 5
                                              │
                                              ▼
                                    Executive Board
                                              │
                                              ▼
                                    RC4 → RC5 → Public Release
```

Do not skip gates. Do not restart completed infrastructure certification (e.g. migration parity) after every later fix unless that artifact changed.

---

## RC3 — Release Manager runbook (current unlock)

### Step 1 — Retrieve secrets from vault

```text
VPSYCH_AUDIT_THERAPIST_EMAIL
VPSYCH_AUDIT_THERAPIST_PASSWORD
VPSYCH_AUDIT_ADMIN_EMAIL
VPSYCH_AUDIT_ADMIN_PASSWORD
```

Expected identities (emails only; passwords remain in vault):

- Therapist: `audit.therapist@vpsych.dev`
- Admin: `audit.admin@vpsych.dev`

### Step 2 — Inject into the audit environment

Inject the four variables into the Cursor / CI audit environment used for production validation. Confirm they are present in that environment only (not in git).

### Step 3 — Authentication verification

| Check | Result | Record |
|---|---|---|
| Therapist login on `https://vpsych.vercel.app/login` | ☐ PASS | |
| Admin login on `https://vpsych.vercel.app/login` | ☐ PASS | |

Record for the certification archive:

| Field | Value |
|---|---|
| Timestamp (UTC) | |
| Environment | production (`vpsych.vercel.app`) |
| Production SHA | `5bf66c07f11d286c305f59398a015614d22b723b` (update if superseded) |
| Auditor | |

### Step 4 — Unlock Wave 1

Run **only**:

1. Mission 1 — UI / UX  
2. Mission 2 — AuthZ  
3. Mission 3 — Database  
4. Mission 4 — API runtime  
5. Mission 5 — AI runtime  

No other missions. Do not restart RC1/RC2 or migration integrity work.

### Step 5 — Board decision

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

### Audit environment

- [ ] Inject audit credentials from vault (`VPSYCH_AUDIT_*`) — never commit
- [ ] Verify therapist audit login on production
- [ ] Verify admin audit login on production
- [ ] Record timestamp, environment, production SHA, auditor

### Certification execution

- [ ] Run required certification missions for this RC phase (scope per wave_status)
- [ ] Archive certification reports and artifacts
- [ ] Update `docs/RC*_*.md` / mission briefs with verdicts

### Cutover (after Executive Board approval)

- [ ] Confirm monitoring and alerting
- [ ] Record Executive Board approval
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
| `RELEASE_MANIFEST.md` | Machine-readable inventory |
