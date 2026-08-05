# RC3 Wave 1 re-attempt — RDL-008 STOP

**Date:** 2026-08-05  
**Agent:** `bc-fe2c2042-8c41-4da3-90f1-49420fae5f72`  
**Branch:** `cursor/wave1-reattempt-5f72`  
**Decision:** RDL-008 (refines RDL-006 / RDL-007)

## Preconditions

| Check | Result |
|---|---|
| Production SHA ≡ `main` (`5bf66c0` / `dpl_5F6pBTi…`) | ✅ PASS |
| Migrations 54 ≡ 54 | ✅ PASS |
| Public health / auth gates | ✅ PASS |
| Audit Auth users + roles | ✅ PASS (`audit.therapist@…`→therapist, `audit.admin@…`→admin) |
| Audit credential env keys present | ✅ present |
| Audit credential env values not placeholders | ✅ PASS (value ≠ key name; emails look like emails) |
| Audit email ↔ role env mapping | ❌ FAIL — therapist/admin emails **swapped** across env vars |
| Audit passwords authenticate | ❌ FAIL — both env passwords × both canonical emails → `invalid_credentials` |
| Login verification (therapist + admin) | ❌ FAIL |

## Diagnosis (ops, not app)

1. **Email swap:** `VPSYCH_AUDIT_THERAPIST_EMAIL` local part is `audit.admin`; `VPSYCH_AUDIT_ADMIN_EMAIL` local part is `audit.therapist`.
2. **Passwords unusable:** Full 2×2 matrix (canonical therapist/admin emails × both env passwords) returns HTTP 400 `invalid_credentials`. Vault password values were never applied to the Auth users, or differ from what is injected.

Auth users remain correctly provisioned and unbanned. This is still **RC3-C2 — Release Infrastructure**.

## Board result

**RC3-C2 — Evidence collection blocked (email/role env swap + passwords do not authenticate).**

Missions 1–5 **not started**. Wave 2 **not started**. Engineering remains frozen.

## Evidence artifacts

- `docs/rc3/evidence/wave1_precondition_probes_2026-08-05T1030.json`
- `docs/rc3/evidence/wave1_login_verify_2026-08-05T1030.json`
- `docs/rc3/evidence/wave1_precondition_stop_2026-08-05T1030.json`

## Next (Release Manager)

1. Set `VPSYCH_AUDIT_THERAPIST_EMAIL` so its local part is `audit.therapist` (domain `vpsych.dev`).
2. Set `VPSYCH_AUDIT_ADMIN_EMAIL` so its local part is `audit.admin` (domain `vpsych.dev`).
3. Apply vault passwords to those Auth users in Supabase (Dashboard → Auth → user → reset password, or Admin API), **or** inject the actual current passwords if they already match Auth.
4. Verify login on `https://vpsych.vercel.app/login` for both accounts (browser or password-grant).
5. Check boxes in `docs/rc3/WAVE1_UNLOCK_CHECKLIST.md`.
6. Re-invoke Wave 1 on a **new** agent run (existing VMs may not pick up secret value changes).
