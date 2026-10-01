# VPsych Excellence Audit — Executive Summary

**Audit ID:** VEA-2026-08-05  
**Mode:** Observational only (no product code changes; no score optimization)  
**Production under audit:** https://vpsych.vercel.app  
**Production SHA (GitHub Production deploy):** `5aae138` (2026-08-05T17:18:48Z)  
**Git `origin/main` tip:** `5aae138`  
**Package version:** `0.1.0`  
**Board posture:** Evidence over assumptions. Measure first. Improve later.

---

## One-line verdict

VPsych is a serious, security-conscious bilingual training platform with a strong educational engine stack on production — but it is **not** yet the world’s leading psychiatric training simulator, and must not be marketed as clinically or conversationally validated.

---

## Executive decision

# ⚠ READY FOR LIMITED EXPERT PREVIEW

**Not** ready for Professional Beta.  
**Not** ready for public clinical-validation claims.

### Conditions for Limited Expert Preview

1. Experts are briefed that production runs **prompt engine v2** (Case Engine + personas + ACE/CGE) — **not** the unmerged PME / TRE / HCFI / Quality Ledger stack in draft PRs #120–#124.
2. Landing-page social proof (`10,000+`, `500+`, `25+`, `95%`, “Trusted by Professionals”) is treated as a **trust defect** and must not be shown to external experts until corrected (remediation roadmap — not performed in this audit).
3. Assessment scores are disclosed as **unvalidated educational heuristics / LLM examiner outputs**, not OSCE instruments.
4. Preview is protocol-bound (Mission 22 style): supervised, small n, no marketing quotes, distress debrief available.
5. Arabic reviewed as **ar-JO**, not pan-Arabic.

If those conditions cannot be met → downgrade to **❌ NOT READY FOR EXPERT PREVIEW**.

---

## Index scores (production-primary)

| Index | Score | Band |
|---|---:|---|
| Clinical Excellence Index (CEI) | **62** | Conditional |
| Human Conversation Fidelity Index (HCFI) | **48** | Weak |
| Educational Excellence Index (EEI) | **74** | Strongest pillar |
| User Experience Index (UXI) | **70** | Adequate |
| AI Quality Index (AQI) | **55** | Conditional |
| Voice Authenticity Index (VAI) | **72** | Adequate–strong |
| Scientific Excellence Index (SEI) | **35** | Weak |
| Security Excellence Index (SSI) | **84** | Strong |
| Performance Excellence Index (PEI) | **78** | Adequate–strong |
| Enterprise Readiness Index (ERI-E) | **48** | Weak–conditional |
| Digital Presence Index (DPI) | **52** | Weak–conditional |
| **VPsych Excellence Index (VEI)** | **61** | Conditional |

**VEI formula (audit composite):**  
`0.15·CEI + 0.15·HCFI + 0.12·EEI + 0.08·UXI + 0.12·AQI + 0.08·VAI + 0.10·SEI + 0.08·SSI + 0.05·PEI + 0.04·ERI-E + 0.03·DPI`

---

## Critical production facts (verified)

| Fact | Evidence |
|---|---|
| Production deploy SHA | GitHub Deployments `environment=Production` → `5aae138` |
| Liveness | `GET /api/health` → `{"ok":true,"service":"vpsych"}` (200) |
| Auth gate | `/avatars`, `/admin/reports` → 307 → `/login?next=…`; `/api/admin/*` → 401 JSON |
| Security headers live | CSP, HSTS preload, XFO DENY, COOP/CORP, Permissions-Policy mic=self |
| SEO baseline live | `/robots.txt`, `/sitemap.xml`, `/privacy`, `/terms` → 200 |
| Prompt on main/prod | `VPSYCH PATIENT-AVATAR SYSTEM PROMPT — v2 (multilingual)` |
| PME / TRE / HCFI libs | **Absent from `origin/main`** (exist only on draft PR branches) |
| Quality Ledger migration | **Absent from `origin/main`** |
| Human PAS/LAS | **n = 0** (Mission 22 docs; in-memory rating store empty) |
| Landing claims | Production HTML contains `10,000+`, `500+`, `25+`, `95%`, `Trusted by` with no data source |
| Open Graph / JSON-LD / llms.txt | **Absent** on production homepage |

---

## Deployment drift (Critical finding)

A large “excellence” stack exists in open draft PRs but is **not production**:

| PR | Title | On production? |
|---|---|---|
| #120 | Wave 3 educational remediation / Quality Ledger | No |
| #121 | Mission 20 HCTF / HCFI | No |
| #122 | Mission 21 PME / PMFI | No |
| #123 | Mission 22 CVHAP validation | No |
| #124 | Excellence TRE / TRI | No |

**Root cause:** stacked draft branches ahead of `main`; Production tracks `main@5aae138`.  
**Impact:** Any board evaluating “Patient Mind Engine” or “Therapy Response Engine” as live capability is evaluating **non-production code**. This audit scores **production** and treats unmerged work as roadmap evidence only (does not inflate CEI/HCFI/SEI).

---

## Top strengths (board view)

1. Bilingual native persona architecture (en-US / ar-JO, never machine-translated).  
2. Dynamic Clinical Case Engine (persona ≠ diagnosis; immutable clinical snapshot).  
3. ACE + CGE adaptive curriculum stack on production.  
4. Defense-in-depth security (middleware + API guards + RLS + report HMAC).  
5. Voice pipeline (STT → patient reply → ElevenLabs TTS) operational.  
6. Admin-only reports (therapist cannot fetch report content from end API).  
7. Security certification culture with documented remediations.  
8. CI discipline (lint → typecheck → test → migrations → build).  
9. Public legal/SEO allowlist fixed and live.  
10. Honest internal docs in Mission 22 / CLAUDE that scores are not validated — when those docs are followed.

---

## Top weaknesses (board view)

1. Human authenticity evidence empty (PAS/LAS n=0).  
2. Competency scores unvalidated but generated for admin reports.  
3. Production clinical AI still prompt-v2; PME/TRE not live.  
4. False landing social proof.  
5. Scientific quality ledgers not on production.  
6. No published reliability coefficients / missing reliability harness referenced by CLAUDE.md.  
7. Thin disorder packages for several active catalog entries.  
8. Enterprise tenancy/SSO/licensing incomplete.  
9. SEO/AEO shallow (no OG, structured data, llms.txt).  
10. Accessibility not WCAG-certified; sparse automated a11y coverage.

---

## What “Limited Expert Preview” means

| Allowed | Forbidden |
|---|---|
| Closed cohort of clinicians/educators | Public “clinically validated” claims |
| Scripted sessions + structured ratings | Marketing quotes from unverified stats |
| Feedback on Case Engine / voice / ACE | Claiming PME/TRE as production features |
| Security-reviewed accounts | Broad institutional rollout |

---

## Document map

| Deliverable | Path |
|---|---|
| Master audit | `docs/audit/VPsych_Excellence_Audit.md` |
| Clinical | `docs/audit/Clinical_Audit.md` |
| Conversation | `docs/audit/Conversation_Audit.md` |
| Educational | `docs/audit/Educational_Audit.md` |
| UX | `docs/audit/UX_Audit.md` |
| Security | `docs/audit/Security_Audit.md` |
| Performance | `docs/audit/Performance_Audit.md` |
| Research / Scientific | `docs/audit/Research_Audit.md` |
| Enterprise | `docs/audit/Enterprise_Audit.md` |
| SEO / AEO | `docs/audit/SEO_AEO_Audit.md` |
| Competitive | `docs/audit/Competitive_Analysis.md` |
| Roadmap | `docs/audit/Product_Roadmap.md` |
| Quality dashboard | `docs/audit/Quality_Dashboard.md` |

---

*End of Executive Summary — VEA-2026-08-05*
