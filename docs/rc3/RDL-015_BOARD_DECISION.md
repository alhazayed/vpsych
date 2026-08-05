# RDL-015 — Executive Board Decision (formal record)

**Authority:** Executive Board (recommended / adopted posture for independent Wave 2 re-cert)  
**Date (UTC):** 2026-08-05  
**Evidence:** `RC3-W2-RECERT-EV-20260805T1545Z`  
**Supersedes narrative noise:** mistaken banned-demo browser attempt is **not** material to this decision.

```yaml
id: RDL-015
phase: RC3
wave: 2
decision: FAILED
status: APPLICATION_REMEDIATION_REQUIRED
credential_gate:
  status: CLOSED
browser_verification:
  therapist: PASS
  admin: PASS
certification:
  independent: true
unlock_wave_3: false
engineering_authorized:
  scope:
    - Verified Wave 2 High findings only
notes:
  - RC3-C2 operational prerequisite has been resolved.
  - Wave 2 failure is attributable to verified clinical/runtime defects.
  - Wave 3 remains locked pending successful independent re-certification.
```

## Interpretation

| Gate | Status |
|---|---|
| RC3-C2 / Credential Verification Gate | **CLOSED** — do not reopen |
| Wave 1 | **Closed** — do not revisit |
| Infrastructure audit | **Not required** for this path |
| Wave 2 independent re-cert | **FAILED** |
| Failure locus | **Application clinical/runtime** (not authentication) |
| Wave 3 | **LOCKED** (`unlock_wave_3: false`) |

Browser verification with canonical audit accounts is part of the evidence package:

- `docs/rc3/evidence/w2r-therapist-login.png`
- `docs/rc3/evidence/w2r-admin-login.png`

The certification outcome rests on **application behavior**, not authentication issues.

## Verified High findings (engineering permit)

Only these may be fixed in the next remediation cycle:

| ID | Finding |
|---|---|
| **W2-H1** | Complex PTSD (ICD-11-only) blocked — DSM-5 required on create |
| **W2-H2** | `consultant_psychiatrist` instructor preset rejected |
| **W2-H3** | Mania conversational phenotype clinically incorrect (depressive/hypersomnia) |
| **W2-H4** | Schizophrenia phenotype depression-dominated; psychosis not expressed |

## Next step (binding)

1. Do **not** revisit RC3-C2.  
2. Do **not** revisit Wave 1.  
3. Do **not** perform another infrastructure audit.  
4. Engineering: remediate **only** W2-H1–H4; run regression.  
5. Merge/deploy to production.  
6. Launch a **new independent** Wave 2 re-certification.  
7. Unlock Wave 3 **only** after Wave 2 PASS and Executive Board authorization.

See also: `docs/rc3/W2_VERIFIED_HIGHS.md`, `docs/rc3/WAVE2_RECERTIFICATION.md`, RDL-016.
