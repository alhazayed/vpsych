# Known Limitations — VPsych Version 1.0 RC1 (CIDP)

**Audience:** Institutional pilots, faculty, residents, researchers, administrators  
**Baseline:** `main` after PR #176 · tag `v1.0.0-rc.1` · Program `VPSYCH-1.0-CIDP-GA`  
**Purpose:** Honest constraints for Controlled Institutional Deployment. Full GA requires clearance of residuals below.

---

## Clinical & educational measurement

1. **Competency scores are not yet validated.** Treat as formative only — not high-stakes credentialing.  
2. **Admin reports only.** Therapists do not see full performance reports by design.  
3. **Heuristic fallbacks** may appear if model providers are unavailable; UI must surface `aiSource`.

---

## Simulation fidelity

4. **AI patients are synthetic / fictional.** Never real persons.  
5. **Conversational phenotype** varies by disorder package richness.  
6. **Excellence / experimental stacks** (PME, TRE, HCTF, CQI, EOI, CVL, HFTE) remain out of production activation without Board unlock.  
7. **Therapy Room / Realtime flags** default **off**; classic VoiceSession is the institutional default.

---

## Enterprise & tenancy

8. **Enterprise control plane** is present (Stage 10); live SSO IdP, LMS adapters, and multi-instance stores remain deepening items.  
9. **Session hard cap** is 40 minutes server-side.  
10. **Arabic and English** supported; quality may differ by voice casting and authorship.

---

## Operations & security residuals (GA blockers)

11. **Supabase Auth leaked-password protection** may still need enablement (ops).  
12. **Upstash Redis** required for horizontally safe rate limits.  
13. **Vendor APM (Sentry)** not mandatory in-app — wire externally; in-app dashboards exist.  
14. **Live DR PITR restore drill** not yet Board-signed.  
15. **External pilot critical-issue clearance** required before unconstrained GA.  
16. **Assessment reliability corpus** needs clinician ratings before publication claims.

---

## Feedback

17. Institutional feedback never modifies patient cognition; Critical/High open items block GA promotion.

---

## What not to expect

- Automated clinical decision support for real patients  
- Validated OSCE-equivalent scoring  
- Guaranteed identical scores across models/providers  
- Immediate merge of experimental excellence PRs  

Report **Critical** safety or data-integrity issues immediately via `POST /api/feedback` (`severity: critical`) and your program administrator.
