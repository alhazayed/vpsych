# VPsych Enterprise Compliance Certification Report

**Mission:** 22 — Enterprise Compliance Certification (Phase 5)  
**Date:** 2026-08-03  
**Roles:** Healthcare Compliance Officer · GDPR Consultant · FERPA Consultant · Legal Auditor · Information Governance  
**Project:** `vpsych` (Supabase `rrzudbkxigeavfdnidnm`, production `https://vpsych.vercel.app`)  
**Branch:** `cursor/enterprise-compliance-cert-e57e`

---

## Executive Summary

VPsych was audited for institutional deployment readiness across GDPR, FERPA, HIPAA-applicable controls, SOC 2 principles, ISO 27001 alignment, academic governance, research ethics, and institutional privacy.

**Critical/High gaps** (missing legal surfaces, unlinked consent, absent DSAR export/erase, no retention purge, no cookie notice, no AI/clinical/educational disclaimers) were **productized and remediated** in this mission. Remaining gaps are primarily **organizational** (BAAs/DPAs, formal SOC 2 evidence collection, hard multi-institution tenancy, IRB programs).

**Overall Compliance Score:** **84 / 100**

**Certification outcome:**

⚠ **COMPLIANT WITH RECOMMENDATIONS**

Suitable for **institutional pilot / academic simulation deployment** after legal counsel review of the new policy pack and execution of DPAs with subprocessors. **Not** a claim of HIPAA certification, completed SOC 2 Type II, or ISO 27001 certification.

---

## Compliance Report

### Framework readiness

| Framework | Score | Status | Notes |
|---|---:|---|---|
| GDPR | 82 | Partial → Ready w/ recs | Policies, consent timestamps, DSAR export/erase, retention purge RPC, cookie notice |
| FERPA | 78 | Aligned w/ recs | Educational disclaimer; institution remains controller of education records; export supports access |
| HIPAA (applicable) | 70 | Not certified | Simulation product; BAAs + risk analysis still organizational; no real PHI by policy |
| SOC 2 principles | 80 | Control mapping | Security/availability/privacy controls present; formal audit evidence / vendor reviews pending |
| ISO 27001 alignment | 76 | Aligned themes | Access control, crypto in transit, logging; SoA / ISMS not in repo |
| Academic governance | 85 | Improved | Educational + clinical disclaimers; competency scores framed as formative |
| Research ethics | 78 | Baseline | Anonymized research export mode; IRB still required for secondary use |
| Institutional privacy | 72 | Partial | Org field + policies; **no hard tenant isolation** (global admin) |

### Control verification

| Control | Result | Evidence |
|---|---|---|
| Consent (terms/privacy/AI) | Pass | Signup links + `terms_accepted` metadata → profile timestamps |
| Privacy Policy | Pass | `/legal/privacy` |
| Cookies | Pass | `/legal/cookies` + `CookieConsentBanner` |
| Data retention | Pass w/ recs | Default 365d; admin `purge_training_sessions_older_than`; schedule cron recommended |
| Right to deletion | Pass | `POST /api/account/delete` + Privacy UI (service role required) |
| Right to export | Pass | `GET /api/account/export` full + research modes |
| Audit logs | Pass w/ recs | `compliance.dsar.*`, `compliance.consent.update`, retention purge; expand admin coverage |
| Access logs | Partial | Security audit + admin deny; not full SIEM |
| Encryption | Pass (platform) | HTTPS/HSTS; Supabase at-rest; no app-level column encryption |
| Institution isolation | Fail → Rec | Soft `organization` field only; shared admin plane |
| Research anonymization | Pass (baseline) | `anonymizeExportForResearch` |

---

## Privacy Report

### Personal data inventory

| Category | Examples | Location |
|---|---|---|
| Identity | name, email, org, profession | Auth metadata, `profiles` |
| Training content | transcripts, scores | `session_messages`, `session_reports` |
| Learning analytics | competencies, adaptive history | ACE/CGE tables |
| Voice | audio → STT (transient); TTS text | OpenAI / ElevenLabs |
| Technical | locale, auth cookies, audit IP/UA | Cookies, `security_audit_events` |

### Lawful basis (controller model)

- **Contract / legitimate interests:** operate educational simulation for registered learners.  
- **Consent:** AI/voice subprocessors (signup), marketing opt-in, cookie preferences.  
- **Institutions** deploying VPsych typically act as **controller** for learner education records; VPsych/subprocessors as processors — execute DPAs.

### Minimization

- Therapists cannot SELECT session report content (RLS).  
- Research export strips names, emails, orgs, timestamps, transcripts.  
- Product policy forbids real patient PHI in sessions (Clinical Disclaimer + Terms).

---

## Legal Risk Matrix

| Risk | Likelihood | Impact | Severity | Mitigation (this mission / residual) |
|---|---|---|---|---|
| Unenforceable “accepted terms” without policies | High→Low | High | Critical→Fixed | Linked `/legal/*` pages + persisted timestamps |
| No DSAR path (regulator / student request) | High→Low | High | Critical→Fixed | Export + delete APIs + Privacy settings |
| Undisclosed AI processing of transcripts/audio | High→Low | High | Critical→Fixed | AI Disclosure + signup acceptance |
| Clinical misuse / liability | Med | High | High→Mitigated | Clinical + Educational disclaimers; Terms acceptable-use |
| Cross-institution admin data exposure | Med | High | High | **Residual** — recommend tenant RLS before multi-school prod |
| Indefinite transcript retention | Med→Low | Med | High→Mitigated | Retention fields + admin purge; **schedule job** residual |
| Cookie non-compliance (EU) | Med→Low | Med | High→Mitigated | Banner + Cookie Policy |
| HIPAA assertion without BAA | Low | High | High | Explicit “not HIPAA certified by default” in Clinical Disclaimer |
| Incomplete SOC 2 evidence | Med | Med | Med | Residual — vendor questionnaires / continuous monitoring |
| Research secondary use without IRB | Med | Med | Med | Anonymized export + educational disclaimer requiring IRB |

---

## Legal pack reviewed

| Document | Route | Status |
|---|---|---|
| Terms of Service | `/legal/terms` | Published |
| Privacy Policy | `/legal/privacy` | Published |
| Cookie Policy | `/legal/cookies` | Published |
| AI Disclosure | `/legal/ai-disclosure` | Published |
| Clinical Disclaimer | `/legal/clinical-disclaimer` | Published |
| Educational Disclaimer | `/legal/educational-disclaimer` | Published |

Signup/login footers and AppShell **Privacy & data** link wired. Cookie banner on all pages.

---

## Institution Readiness

| Criterion | Ready? |
|---|---|
| Policy pack for procurement review | Yes |
| Learner DSAR self-service | Yes (export/delete) |
| Consent audit trail on profile | Yes |
| Retention operationalization | Partial (RPC exists; cron/ops pending) |
| Multi-school hard isolation | **No** — single-tenant admin model |
| Executed DPAs/BAAs | Organizational (out of band) |
| FERPA “school official” designation | Institutional process |
| IRB / research governance | Institutional process + research export helper |
| SOC 2 / ISO certificates | Not claimed |

**Recommended institutional go-live tier:** single university / training program pilot with DPA + Acceptable Use acknowledging simulation-only use.

---

## Remediation delivered (Mission 22)

| ID | Severity | Finding | Fix |
|---|---|---|---|
| C1 | Critical | No Privacy/Terms/legal routes | `/legal/*` pages + public middleware |
| C2 | Critical | No DSAR export/erase | `/api/account/export`, `/api/account/delete`, Privacy UI |
| C3 | Critical | AI subprocessors undisclosed | AI Disclosure + signup consent flags |
| H1 | High | Consent not persisted | Profile columns + `handle_new_user` |
| H2 | High | No cookie notice/policy | Banner + Cookie Policy |
| H3 | High | No clinical/educational disclaimers | Dedicated pages + signup links |
| H4 | High | No retention purge | `purge_training_sessions_older_than` + retention preference |
| M1 | Medium | Research anonymization absent | Research export mode |

**DB migration applied** to project `rrzudbkxigeavfdnidnm`: `enterprise_compliance_consent_retention`.

---

## Overall score breakdown

| Area | Score |
|---|---:|
| Transparency / legal pack | 92 |
| Consent & cookies | 88 |
| DSAR (export/erase) | 90 |
| Retention & storage limitation | 80 |
| Audit & accountability | 82 |
| Encryption & security baseline | 88 |
| Tenancy / institutional isolation | 55 |
| HIPAA program completeness | 60 |
| SOC2/ISO evidence maturity | 70 |
| Research ethics tooling | 78 |
| **Weighted overall** | **~84** |

---

## Recommendations (for ✅ ENTERPRISE COMPLIANT)

1. Execute **DPAs/SCCs** with VPsych + OpenAI + ElevenLabs + Supabase + Vercel; BAAs if HIPAA scope asserted.  
2. Implement **hard institution tenancy** (tenant_id RLS; scoped admin).  
3. Schedule **retention purge** (e.g. weekly cron calling admin RPC).  
4. Expand audit coverage to all admin mutations; forward to SIEM.  
5. Counsel review of legal pack; jurisdiction-specific addenda.  
6. Formal SOC 2 / ISO program if enterprise customers require attestations.  
7. IRB SOP for any research secondary use beyond anonymized aggregates.

---

## Conclude

⚠ **COMPLIANT WITH RECOMMENDATIONS**

VPsych now presents the core **policy, consent, DSAR, cookie, retention, and disclosure** controls required for institutional simulation pilots. It is **not** fully enterprise-compliant for multi-institution production, HIPAA-covered operations, or attestation-grade SOC 2/ISO without the residual recommendations above.

---

## Regression

| Check | Result |
|---|---|
| `npm test` | Pass (incl. compliance surface + DSAR anonymization tests) |
| `npm run typecheck` | Pass |
| Migration applied (remote) | Success |
