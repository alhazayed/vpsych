# RC3 Wave 1 Unlock

Do **not** advance Waves 2–7 until every box below is checked and Wave 1 Missions 1–5 pass with zero Critical and zero High findings.

**Full Release Manager runbook:** `docs/RELEASE_OPERATIONS_CHECKLIST.md`

## Prerequisites (infrastructure — done)

- [x] Production SHA verified (`5bf66c0` / `dpl_5F6pBTi…` on `vpsych.vercel.app`)
- [x] Migration parity verified (repo **54** ≡ production **54**)
- [x] Schema diff = 0
- [x] Audit therapist account exists (`audit.therapist@vpsych.dev` → `therapist`)
- [x] Audit admin account exists (`audit.admin@vpsych.dev` → `admin`)

## RC3-C2 — Operational prerequisite (Release Manager)

Not an application defect. Category: **Release Infrastructure**.  
See `docs/AUDIT_ACCOUNTS.md` (no passwords in git).

- [ ] `VPSYCH_AUDIT_THERAPIST_EMAIL` injected
- [ ] `VPSYCH_AUDIT_THERAPIST_PASSWORD` injected
- [ ] `VPSYCH_AUDIT_ADMIN_EMAIL` injected
- [ ] `VPSYCH_AUDIT_ADMIN_PASSWORD` injected
- [ ] Login verification completed (therapist + admin on `https://vpsych.vercel.app/login`)

↓

**Unlock Wave 1 execution** (Missions 1–5 only)

## After secrets are injected

1. Verify therapist login → PASS  
2. Verify admin login → PASS (record timestamp, environment, production SHA, auditor)  
3. Execute Missions **1–5** only  
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
