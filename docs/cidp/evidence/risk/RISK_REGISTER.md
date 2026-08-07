# Living Risk Register — CIDP / Phase 14

**Version:** `1.0.0-rc.1`  
**Seed source:** `defaultPhase14RiskRegister()` · `src/lib/ops/phase14-risk-register.ts`  
**Review cadence:** Weekly during pilots  

| ID | Description | Likelihood | Impact | Owner | Mitigation | Status | Review | Escalation | Category |
|----|-------------|------------|--------|-------|------------|--------|--------|------------|----------|
| RISK-P14-01 | DR / PITR live drill not evidenced — blocks GA | possible | major | DevSecOps Lead | Execute staging PITR; append DR log | open | 2026-08-21 | Release Board → DevSecOps → RM | infrastructure |
| RISK-P14-02 | Assessment scores not scientifically validated — overclaim risk | likely | major | Clinical Governance Lead | Publish limitations; forbid validated-score claims | mitigating | 2026-08-21 | Clinical Governance → Release Board | clinical_safety |
| RISK-P14-03 | Production APM / Sentry incomplete | possible | moderate | DevSecOps Lead | Enable error monitoring; wire alert catalog | open | 2026-08-21 | Ops → RM | operations |
| RISK-P14-04 | Auth HIBP leaked-password residual may remain disabled | possible | moderate | DevSecOps Lead | Enable HIBP; record security evidence | open | 2026-08-21 | Security → Release Board | security |
| RISK-P14-05 | Institution memberships sparse — under-count analytics | likely | minor | Enterprise Program Manager | Onboard memberships per checklist | mitigating | 2026-08-21 | Enterprise → Product | educational |
| RISK-P14-06 | Feature freeze breach altering Clinical Core during pilot | unlikely | severe | Chief Software Architect | Architecture tests + RDL engineering rules | mitigating | 2026-08-21 | Architect → Release Board | governance |

## Append-only updates

Add new rows below; never delete history. Closures set Status=`closed` and note evidence path.
