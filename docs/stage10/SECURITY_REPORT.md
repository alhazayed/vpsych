# Stage 10 — Security Report

## Controls verified in tests

- Cross-tenant deny for faculty/student  
- Global admin cross-tenant allow with permission  
- Mutual isolation A↔B  
- SSO/MFA policy enablement  
- Authorization audit deny/allow  
- Secret refs never store raw secrets  
- Public cert verify rate-limited; no report body leakage  

## RLS

All new `enterprise_*` tables RLS-enabled with member/manager/platform policies.

## Residual debt

- Live SAML/OIDC IdP binding not wired to a vendor  
- Webhook HMAC uses deterministic stub until vault secret injection  
- Upstash still recommended for multi-instance rate limits (pre-existing)
