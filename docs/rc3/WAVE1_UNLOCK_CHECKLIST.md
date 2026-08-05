# RC3 Wave 1 Unlock

Do **not** advance Waves 2–7 until every box below is checked and Wave 1 Missions 1–5 pass with zero Critical and zero High findings.

**Full Release Manager runbook:** `docs/RELEASE_OPERATIONS_CHECKLIST.md`  
**Governance policy:** `docs/RELEASE_GOVERNANCE.md`  
**Decision log:** `docs/RELEASE_DECISION_LOG.md` (append RDL row on Wave 1 PASS / FAIL)  
**Credential Verification Gate:** mandatory for **every** release — see governance §5 + ops checklist

## Prerequisites (infrastructure — done)

- [x] Production SHA verified (`5bf66c0` / `dpl_5F6pBTi…` on `vpsych.vercel.app`)
- [x] Migration parity verified (repo **54** ≡ production **54**)
- [x] Schema diff = 0
- [x] Audit therapist Auth user exists (`audit.therapist@…` → `therapist`)
- [x] Audit admin Auth user exists (`audit.admin@…` → `admin`)

## RC3-C2 — Credential Verification Gate (Release Manager)

Not an application defect. Category: **Release Infrastructure**.  
See `docs/AUDIT_ACCOUNTS.md` (no passwords in git).  
Latest stop: **RDL-008** — email↔role swap + passwords do not authenticate.  
Process strengthening: **RDL-009** (gate adopted).

Do **not** assume vault passwords are correct. Reset in Supabase Auth, sync vault, then prove login **manually** before Cursor.

```yaml
audit_credentials:
  therapist:
    email_matches_expected: false   # local must be audit.therapist
    login_success: false            # manual on https://vpsych.vercel.app
  admin:
    email_matches_expected: false   # local must be audit.admin
    login_success: false
precondition:
  if_false:
    stop_certification: true
    create_rdl_entry: true
```

- [ ] Supabase Auth users verified (therapist + admin, correct roles, not banned)
- [ ] Passwords reset in Auth and written to vault
- [ ] `VPSYCH_AUDIT_THERAPIST_EMAIL` local = `audit.therapist` (not swapped)
- [ ] `VPSYCH_AUDIT_ADMIN_EMAIL` local = `audit.admin` (not swapped)
- [ ] `VPSYCH_AUDIT_THERAPIST_PASSWORD` unlocks therapist Auth user
- [ ] `VPSYCH_AUDIT_ADMIN_PASSWORD` unlocks admin Auth user
- [ ] **Manual** therapist login PASS on `https://vpsych.vercel.app/login`
- [ ] **Manual** admin login PASS on `https://vpsych.vercel.app/login`
- [ ] Roles/permissions look correct for each account
- [ ] Timestamp / SHA / auditor recorded in ops archive

↓

**Unlock Wave 1 execution** (Missions 1–5 only) — **new** Cursor agent only

## After the gate passes

1. Launch a **fresh** Cursor agent (picks up updated secrets).  
2. Prompt: `Run Wave 1`.  
3. Cursor re-checks the gate; on FAIL → STOP + RDL; on PASS → Missions **1–5** only.  
4. If **0 Critical and 0 High** →

```yaml
wave_1:
  state: passed
  unlocked_by:
    release_manager: <name>
```

5. Unlock Wave 2 → continue RC3 without restarting completed infrastructure work

## Still locked until Wave 1 PASS

RC4 · RC5 · Wave 6 Executive Board · Wave 7 Public Launch
