# Final Version 1.0 Authorization Package (Template)

**Status:** **NOT AUTHORIZED** — template only until GA gates PASS.  
**Target tag:** `v1.0.0`  
**Current version:** `1.0.0-rc.1`

## Preconditions (all required)

- [ ] `evaluateGaReadiness().ga_status === "GO"`  
- [ ] DR drill + PITR rows signed in `../cidp/evidence/dr/DR_EVIDENCE_LOG.md`  
- [ ] Security residuals closed or Board-waived (waivers cannot cover Critical clinical issues)  
- [ ] Zero unresolved Critical feedback  
- [ ] Zero critical-tier open risks (or accepted with Board waiver recorded)  
- [ ] Stable pilot metrics + acceptable educational outcomes evidenced  
- [ ] Clinical validation scope completed per Board definition  
- [ ] Governance attestations current  
- [ ] RDL row authorizes `v1.0.0`  

## Authorization steps (when ready)

1. Freeze engineering except incident response.  
2. Append RDL authorizing GA.  
3. Set `package.json` version to `1.0.0`.  
4. Tag `v1.0.0`; GitHub Release from `CHANGELOG.md`.  
5. Deploy; Credential Gate smoke; update GA readiness report to all PASS.  
6. Communicate GA scope and **remaining limitations** (especially unvalidated scores unless separately unlocked).

## Explicit refusal (current)

Public GA marketing, unconstrained multi-tenant scale claims, and validated-score claims remain **prohibited**.
