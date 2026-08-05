# RC3 Wave 1 Unlock

Do **not** advance Waves 2–7 until every box below is checked and Wave 1 Missions 1–5 pass with zero Critical and zero High findings.

**Full Release Manager runbook:** `docs/RELEASE_OPERATIONS_CHECKLIST.md`  
**Credential gate runbook:** `docs/rc3/RC3_C2_CREDENTIAL_GATE_RUNBOOK.md`  
**Gate PASS report:** `docs/rc3/RC3_C2_GATE_PASS.md`  
**Governance policy:** `docs/RELEASE_GOVERNANCE.md`  
**Decision log:** `docs/RELEASE_DECISION_LOG.md`

## Prerequisites (infrastructure — done)

- [x] Production SHA verified (`5bf66c0` / `dpl_5F6pBTi…` on `vpsych.vercel.app`)
- [x] Migration parity verified (repo **54** ≡ production **54**)
- [x] Schema diff = 0
- [x] Audit therapist Auth user exists (`audit.therapist@…` → `therapist`)
- [x] Audit admin Auth user exists (`audit.admin@…` → `admin`)

## RC3-C2 — Credential Verification Gate

Category: **Release Infrastructure**. Cleared by **RDL-011** / evidence `RC3-C2-EV-20260805T1245Z`.

```yaml
audit_credentials:
  therapist:
    email_matches_expected: true    # local audit.therapist
    login_success: true             # browser on https://vpsych.vercel.app
  admin:
    email_matches_expected: true    # local audit.admin
    login_success: true
precondition:
  if_false:
    stop_certification: true
    create_rdl_entry: true
```

- [x] Supabase Auth users verified (therapist + admin, correct roles, not banned)
- [x] Passwords in Auth match Vault (`vpsych_audit_*_password`, bcrypt cost 10)
- [x] Password-grant diagonal matrix PASS (2×200 / 2×400)
- [x] Therapist denied on `/api/admin/*` and `/api/health/openai`; admin admitted
- [x] **Manual** therapist login PASS on `https://vpsych.vercel.app/login`
- [x] **Manual** admin login PASS on `https://vpsych.vercel.app/login`
- [x] Roles/permissions look correct for each account
- [ ] **Persistent** Cursor secrets updated from Vault (unswap emails + vault passwords) — Release Manager
- [ ] Preflight `node scripts/rc3-credential-gate-preflight.mjs` green on the Wave 1 agent

↓

**Unlock Wave 1 execution** (Missions 1–5 only) — **new** Cursor agent only, after the two unchecked boxes above.

## After the gate passes

1. Release Manager finishes the two remaining boxes (Cursor secrets + preflight).
2. Launch a **fresh** Cursor agent (picks up updated secrets).  
3. Prompt: `Run Wave 1`.  
4. Cursor re-checks the gate; on FAIL → STOP + RDL; on PASS → Missions **1–5** only.  
5. If **0 Critical and 0 High** → unlock Wave 2.

## Still locked until Wave 1 PASS

RC4 · RC5 · Wave 6 Executive Board · Wave 7 Public Launch
