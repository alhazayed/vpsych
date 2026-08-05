# RC3-C2 — Credential Verification Gate PASS

**Evidence ID:** `RC3-C2-EV-20260805T1245Z`  
**Decision reference:** RDL-011 (clears RC3-C2 / RDL-009 gate)  
**Category:** Release Infrastructure (not an application defect)  
**Date:** 2026-08-05T12:45Z  
**Runbook:** `docs/rc3/RC3_C2_CREDENTIAL_GATE_RUNBOOK.md`  
**Machine evidence:** `docs/rc3/evidence/rc3_c2_gate_pass_2026-08-05T1245Z.json`

---

## Verdict

**PASS.** Wave 1 may be dispatched on a **fresh** Cursor agent **after** the Release Manager updates the persistent Cursor secret store from Vault (see Remaining).

Production Auth, Vault, password-grant matrix, admin role separation, and browser login all succeed against `https://vpsych.vercel.app` at SHA `5bf66c0` / `dpl_5F6pBTi…` with migrations **54 ≡ 54**.

---

## Gate checklist

| Criterion | Result |
|---|---|
| Phase 2 eight checks (after Vault inject into session) | ✅ present / real / correct local parts |
| 3a both accounts HTTP 200 + access token | ✅ |
| 3b matrix exactly diagonal (two 200, two 400) | ✅ |
| 3c therapist denied / admin admitted on `/api/health/openai` and `/api/admin/disorders` | ✅ 403 / 200 |
| 3c `security_audit_events` therapist denial | ✅ `health.openai` / `denied` / `role=therapist` |
| 3d browser login both accounts | ✅ → `/avatars` |
| Production SHA `5bf66c0`; migrations 54 ≡ 54 | ✅ |

---

## What was already true before this run

Prior recovery (`RC3-C2-EV-20260805T1208Z`, PR #107) had already:

1. Reset both audit Auth passwords (cost `$2a$10$`).
2. Written plaintexts to Vault as `vpsych_audit_therapist_password` / `vpsych_audit_admin_password`.
3. Verified bcrypt unlock against `auth.users`.

That session lacked egress to GoTrue / production, so the gate could not be closed. This run had egress and completed Phases 0–3d.

**Phase 1 was not repeated** — Vault already matched Auth. No further password reset was performed.

---

## What this run found at start

Cursor-injected `VPSYCH_AUDIT_*` at agent boot:

- All four keys **present**, not placeholders.
- **Emails still swapped** (therapist var → `audit.admin@…`, admin var → `audit.therapist@…`).
- **Passwords still wrong** — 2×2 matrix against canonical emails → all HTTP 400.

Primary root cause remains **password material mismatch**; email swap is secondary. Correcting mapping alone would not have passed the gate.

---

## Remaining (Release Manager — before Wave 1)

The gate’s Auth half is green. The **persistent** Cursor cloud-agent environment secrets are still the stale swapped/wrong values. A reused or freshly booted agent that reads those secrets will FAIL Phase 2 again.

1. Open the Cursor environment secrets for `alhazayed/vpsych`.
2. Set (from Vault — **do not** invent new passwords):

| Variable | Value source |
|---|---|
| `VPSYCH_AUDIT_THERAPIST_EMAIL` | `audit.therapist@…` |
| `VPSYCH_AUDIT_THERAPIST_PASSWORD` | Vault `vpsych_audit_therapist_password` |
| `VPSYCH_AUDIT_ADMIN_EMAIL` | `audit.admin@…` |
| `VPSYCH_AUDIT_ADMIN_PASSWORD` | Vault `vpsych_audit_admin_password` |

3. Run `node scripts/rc3-credential-gate-preflight.mjs` (or the Phase 2 eight checks from the runbook).
4. Launch a **fresh** agent with prompt `Run Wave 1` only.

Optional: mirror the same four vars into Vercel project `prj_qiJ1mQvX0s5lJZ9KJnpWAx4EXjNm` if audit scripts run there.

**Never commit password values.** Vault is the source of record.

---

## Screenshots

<img alt="Therapist login success" src="/opt/cursor/artifacts/rc3-c2/therapist-login.webp" />
<img alt="Admin login success" src="/opt/cursor/artifacts/rc3-c2/admin-login.webp" />
