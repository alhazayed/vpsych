# RC3 Wave 1 — Risk Matrix

**Evidence:** `RC3-W1-EV-20260805T1305Z` · **RDL-012**

| ID | Mission | Severity | Likelihood | Impact | Status | Treatment |
|---|---|---|---|---|---|---|
| W1-C1 | 04 / 03 / 05 | Critical | Certain (reproduced) | Session create broken for all therapists when service role unset | **CLOSED** | Migration `20260805130453` owner-auth RPC bodies; retest PASS |
| RC3-H1 | 03 | High (ops) | Likely | Weak/compromised passwords accepted at signup/reset | **OPEN** | Enable Auth leaked-password protection in Supabase Dashboard |
| RC3-M1 | 01 | Medium | Possible | Weaker social/SEO previews | OPEN | Track for Wave 5 / v1.1 — OG tags |
| RC3-M2 | 03 | Medium | Possible | Advisor noise on intentional SECURITY DEFINER RPCs | OPEN | Accept / document; revoke only if unused |
| Persistent Cursor secret drift | Ops | High (process) | Certain at boot this run | Blocks certification if not Vault-injected | **MITIGATED this run** | RM must unswap emails + set Vault passwords in Cursor env permanently |

## Residual risk after Wave 1

- Application Critical path for sessions: **mitigated**.  
- Ops HIBP: **unmitigated** — does not block therapist runtime; Board should remediate before public launch (Wave 7).  
- Persistent audit secret store: still requires RM action so the next agent does not depend on Vault SQL inject.

## Unlock implication

Wave 2 unlock is **recommended** with RC3-H1 tracked. Wave 2 must **not** start until Board authorization.
