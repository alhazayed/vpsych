# Release Governance — VPsych

**Authority:** Adopted RDL-010; binding for v1.0 and later.  
**Restored for CIDP:** 2026-08-07 (file was referenced historically; this is the living policy).

## Roles

| Role | Responsibility |
|------|----------------|
| Release Manager | Vault credentials, Credential Verification Gate, tags, deploy parity |
| Certification / Cursor agent | Evidence, PASS/FAIL, no speculative product changes during cert |
| Executive / Release Board | Unlock waves; authorize RC / CIDP / GA |

## State machine (summary)

`RC freeze → Credential Gate → Certification waves → Limited Preview / RC → CIDP pilots → GA`

Each transition requires an RDL row with evidence paths.

## Engineering rules

- **Permit:** verified Critical/High remediations; docs; ops hardening that does not change cognition.  
- **Prohibit:** patient-state forks; duplicated engines; undeclared GA claims; merging experimental excellence stacks without Board unlock.

## Credential Verification Gate

Before auth-gated production certification: therapist and admin audit logins must PASS (`email_matches_expected` + `login_success`). If false → stop and append RDL.

## CIDP vs GA

- **CIDP** may be authorized at `1.0.0-rc.1` with published residuals.  
- **GA (`v1.0.0`)** requires all criteria in `docs/cidp/GA_READINESS_REPORT.md`.

## Related

- `RELEASE_DECISION_LOG.md` (append-only)  
- `RELEASE_OPERATIONS_CHECKLIST.md`  
- `cidp/RELEASE_BOARD_PACKAGE.md`
