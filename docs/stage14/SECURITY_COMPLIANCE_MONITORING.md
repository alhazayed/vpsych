# Security & Compliance Monitoring

## Continuous verification

RBAC · RLS · Authentication · Authorization · Audit logging · Secrets management · Dependency health (`npm audit` / CI `audit:deps`) · Rate limiting · Infrastructure integrity · Environment validation

## Evidence

| Artifact | Path |
|----------|------|
| Security evidence log | `../cidp/evidence/security/SECURITY_EVIDENCE_LOG.md` |
| CIDP security report | `../cidp/SECURITY_REPORT.md` |
| Stage 12 security audit | `../SECURITY_AUDIT.md` |
| Weekly security report | `/api/admin/ops/cidp/weekly` kind `security` |

## Residuals that block GA (examples)

- HIBP leaked-password protection if still disabled  
- Incomplete production APM  
- Unresolved Critical / High application findings  

Record closure in the security evidence log before flipping gate `security_residuals_closed` to PASS.
