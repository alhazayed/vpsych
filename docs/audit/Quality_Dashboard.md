# Quality Dashboard — VEA Scorecard

**Audit ID:** VEA-2026-08-05  
**Production:** https://vpsych.vercel.app @ `5aae138`  
**Mode:** Observational · Evidence-gated

---

## Executive indices

```
CEI   ████████████░░░░░░░░  62
HCFI  █████████░░░░░░░░░░░  48
EEI   ██████████████░░░░░░  74
UXI   ██████████████░░░░░░  70
AQI   ███████████░░░░░░░░░  55
VAI   ██████████████░░░░░░  72
SEI   ███████░░░░░░░░░░░░░  35
SSI   ████████████████░░░░  84
PEI   ███████████████░░░░░  78
ERI-E █████████░░░░░░░░░░░  48
DPI   ██████████░░░░░░░░░░  52
VEI   ████████████░░░░░░░░  61
```

---

## Decision gauge

| Option | Selected |
|---|---|
| ❌ NOT READY FOR EXPERT PREVIEW | |
| ⚠ READY FOR LIMITED EXPERT PREVIEW | **YES** (conditional) |
| ✅ READY FOR PROFESSIONAL BETA | |

---

## Gate checklist (Limited Expert Preview)

| Gate | Status |
|---|---|
| Production healthy (`/api/health`) | PASS (verified) |
| Auth gates functional | PASS (verified) |
| Security headers present | PASS (verified) |
| Landing trust copy clean | **FAIL** (unverified stats live) |
| Authenticity human data | **FAIL** (PAS/LAS n=0) |
| Assessment non-validation disclosed to users | **FAIL / partial** |
| Production matches excellence narrative (PME/TRE) | **FAIL** (draft only) |
| Upstash rate limits confirmed | UNKNOWN (ops) |
| Expert distress protocol | REQUIRED |

**Board note:** Decision remains ⚠ only if P0 trust/disclosure gates are closed before invites. Otherwise downgrade to ❌.

---

## Trend vs prior boards (contextual, not re-scored)

| Prior board | Signal |
|---|---|
| V1 Release Cert | NOT READY FOR v1.0; maturity 71 |
| Security Cert | Certified with recommendations (~84) |
| Mission 22 Beta | CONDITIONAL GO (framework; human data absent) — **framework not on production** |
| This VEA | VEI 61; Limited Expert Preview conditional |

---

## Ownership map (suggested)

| Index | Primary owners |
|---|---|
| CEI / HCFI / AQI | Clinical + AI |
| EEI | Medical education |
| SEI | Research methodology |
| SSI | Security |
| PEI | Platform |
| ERI-E | Enterprise/product |
| DPI | Growth/content (honest) |
| UXI / VAI | Product design + voice |

---

## Re-audit trigger

Re-run VEA when **any** of:

1. Excellence stack (#120–#124) merges and deploys to Production.  
2. PAS n≥8 results land.  
3. Landing trust defects closed.  
4. Package version intends ≥1.0.0 public release.
