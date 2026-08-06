# Professional Preview Readiness Report

**Product:** VPsych Professional Preview 1.0 (RC1) + PPP evaluation tooling  
**Date:** 2026-08-06  
**Scope rule:** No new simulation logic; production freeze respected (tooling lands via reviewable PR).

---

## 1. Is VPsych ready for expert evaluation?

**Yes — for invited expert evaluation on the frozen RC1 simulation baseline, with conditions.**

Ready:

- Account → session → end flow works for therapists  
- Bilingual standardized patients (EN/AR) are live  
- Admin performance reports generate after session end  
- Wave 3 remediation passed; RC1 packaging exists (`REVIEWER_GUIDE`, `FEEDBACK_GUIDE`, `KNOWN_LIMITATIONS`)  
- This PPP package adds in-product onboarding, CQI/EOI capture, Reviewer Analytics, and an admin preview dashboard so expert feedback can drive v1.1

Conditions before kicking off a broad cohort:

1. Apply migration `20260806083000_professional_preview_program` and deploy this evaluation tooling when the Release Manager authorizes it (RC1 freeze still applies to simulation behaviour).  
2. Confirm production TTS key remains valid (Wave 3 H5 ops).  
3. Brief reviewers that full scores are admin-only and formative — never “validated.”  
4. Scrubbed marketing claims must ship with (or before) public invite traffic.

Not ready for:

- High-stakes credentialing  
- Public “most realistic simulator” marketing  
- Unsupervised wide release without Critical/High CQI burn-down

---

## 2. What are the ten highest-impact improvements remaining?

1. **Clinician-rated calibration corpus** with published reliability coefficients (`ASSESSMENT_RELIABILITY.md` still missing as a living evidence file).  
2. **Trainee-visible formative coach summary** (end API already returns ACE coach data; wire UI without exposing admin rubric prematurely).  
3. **Blind psychiatrist protocol pilot** (N≥5) vs optional human SP transcripts.  
4. **Disorder-package unevenness** — strengthen weaker phenotypes called out in known limitations.  
5. **Voice latency / casting consistency** across EN and AR (ops + registry, not new sim features).  
6. **Safety-response audit** under adversarial therapist prompts (document outcomes).  
7. **Onboarding enrollment conversion** — prompt `ppp_reviewers` enrollment after first session so dashboard denominator is correct.  
8. **Institutional invite / email-confirm reliability** for residency programs.  
9. **Research export of de-identified PPP ratings** aligned with quality-ledger export patterns.  
10. **Claims governance CI check** — fail build if banned marketing phrases reappear in `messages/*.json`.

---

## 3. What evidence would be required before calling VPsych the most realistic psychiatric training simulator available?

All of the following — not a subset:

1. **Pre-registered comparative study** against human standardized patients (and/or leading simulators) with a priori primary endpoints for realism and educational usefulness.  
2. **Adequate powered sample** of blinded psychiatrist ratings (see `BLIND_PSYCHIATRIST_PROTOCOL.md`) showing superiority or non-inferiority on the primary endpoint with confidence intervals.  
3. **Published inter-rater reliability** for assessment rubrics (ICC / κ) on an expert-scored corpus.  
4. **Educational outcome evidence** (e.g., OSCE or supervised performance change) with ethics approval — not only Likert satisfaction.  
5. **Locale-specific evidence** for Arabic and English independently (natively authored personalities; no translation sleight-of-hand).  
6. **Transparent limitations** still disclosed; superiority claims scoped to the measured population, disorders, and modalities.  
7. **Peer-reviewed or preprint methods** citable by DOI; marketing language locked to the paper’s exact claims.  
8. **Independent replication** or multi-site cohort — single-lab enthusiasm is insufficient for a global superlative.

Until then, permitted language remains: *Professional Preview / under expert evaluation / formative scores.*

---

*End of report.*
