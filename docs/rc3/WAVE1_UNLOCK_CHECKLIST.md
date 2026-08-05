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
- [ ] **Persistent** Cursor secrets updated from Vault (unswap emails + vault passwords) — Release Manager (**still open**; Wave 1 agent session-injected from Vault)
- [x] Preflight `node scripts/rc3-credential-gate-preflight.mjs` green on the Wave 1 agent (`bc-633ebfe4…`)

↓

**Wave 1 execution complete** — see `docs/rc3/WAVE1_SUMMARY.md` · RDL-012 · evidence `RC3-W1-EV-20260805T1305Z`.

## After Wave 1

1. Board reviews Wave 1: **⚠ CERTIFIED WITH RECOMMENDATIONS** (W1-C1 fixed; RC3-H1 HIBP open).
2. **Recommend UNLOCK WAVE 2** — do **not** start until Board authorizes.
3. RM: still fix persistent Cursor secrets; enable Auth leaked-password protection (RC3-H1).

## Still locked until Board unlocks Wave 2

Wave 2–5 · RC4 · RC5 · Wave 6 Executive Board · Wave 7 Public Launch
