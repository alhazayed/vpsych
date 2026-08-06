# Release Notes — VPsych Professional Preview 1.0 (RC1)

**Date:** 2026-08-06  
**Baseline:** production `https://vpsych.vercel.app` @ SHA `d4c4fae` / deploy `dpl_DpdpoyEksVeSZvu1wx1mYngeX2jh`  
**Status:** Wave 3 PASSED (RDL-024). Limited expert evaluation release.

---

## What this release is

VPsych Professional Preview 1.0 is a **stable training simulation** for invited psychiatrists and psychologists. Trainees practice psychotherapy against AI standardized patients (text or voice). Admins receive performance reports. Content is bilingual (English / Arabic) with natively authored patient personalities.

This is **not** a public consumer launch and **not** a claim that competency scores are clinically validated.

---

## Highlights available to evaluators

- Voice and text sessions with server-side transcript persistence  
- Standardized patient avatars with clinical case snapshots minted per session  
- Instructor presets for medical student, psychologist, counselor pathways; GP comorbidity guards  
- Dual-coding educational rubric (DSM-5 and ICD-11 reasoning plus formulation / differential / risk / educational competency)  
- Admin-only reports and research export  
- Quality Ledger schema for scientific audit trails (admin)  
- Security: RLS, rate limits, admin gates, sanitized client errors  

---

## Certification path that unlocked this preview

| Gate | Outcome |
|---|---|
| Wave 1 | Certified with recommendations (RDL-012) |
| Wave 2 | PASSED (RDL-019) |
| Wave 3 | PASSED after H5 TTS ops fix (RDL-024) |

Critical Wave 3 items closed on production: Quality Ledger API, educational preset slugs, GP pathway rules, expanded rubric, research export, ElevenLabs TTS with valid `sk_…` Production key.

---

## What changed recently (engineering summary)

- Merged Wave 3 remediations (#131) and migration parity (#133) to `main`  
- Applied Quality Ledger migration `20260805214500`  
- Restored Production ElevenLabs API key and redeployed (`dpl_Dpdpoy…`)  
- No new product features for this RC1 packaging PR (documentation + governance only)

---

## How to evaluate

1. Read `docs/REVIEWER_GUIDE.md`  
2. Run sessions per the guide (EN + AR if possible)  
3. Record judgments with `docs/FEEDBACK_GUIDE.md`  
4. Note constraints in `docs/KNOWN_LIMITATIONS.md`

---

## Support / rollback

Rollback tag: `rc1-pp-1.0-baseline` → `d4c4fae`.  
Production rollback candidate deploy: `dpl_DpdpoyEksVeSZvu1wx1mYngeX2jh`.
