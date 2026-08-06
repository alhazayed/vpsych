# RC3 Wave 2 — Final Post-Deploy Independent Re-Certification

**Evidence ID:** `RC3-W2-FINAL-RECERT-EV-20260805T1725Z`  
**Date (UTC):** 2026-08-05  
**Authority:** Executive Board RDL-018  
**Board:** Independent Clinical Certification (did not implement remediation)  
**Production:** https://vpsych.vercel.app · SHA `5aae13806c984cb19a9c2e920d14014b548d4400` · deploy `dpl_8Q7YGEHKesAWt3yNzcJ87cEYYYH2`  
**Remediation contained:** `8436208453858b15d214b72ece061cfda8923565`  
**Supabase:** `rrzudbkxigeavfdnidnm` (production)

---

## Executive Board Decision

# ✅ WAVE 2 PASSED

**Recommend: UNLOCK WAVE 3**  
Do **not** start Wave 3 in this run. Wait for Executive Board authorization.

---

## Pre-flight

| Check | Result |
|---|---|
| Production SHA = `5aae138` | **PASS** — Vercel `dpl_8Q7YGEH…`, `target=production`, alias `vpsych.vercel.app` |
| Deployment healthy | **PASS** — `/api/health` ok |
| Migration parity (operational) | **PASS** — remote **55** incl. W1-C1 `20260805130453`; sessions create/message work |
| Credential Verification Gate | **PASS** — Phase 2+3a/3b matrix |
| Therapist login | **PASS** |
| Admin login | **PASS** |

**Pre-flight: PASS**

Residual (non-blocking): git `main` has **54** migration files and still lacks the W1-C1 filename that production already applied. Runtime parity is intact; release engineering should sync the file to git.

---

## W2-H1 Complex PTSD — **PASS**

| Probe | Result |
|---|---|
| CPTSD create EN × beginner/intermediate/advanced/expert | **200** ×4 — diagnosis `Complex PTSD` |
| CPTSD create AR × all difficulties | **200** ×4 |
| DB coding | `dsm5_code=null`, `icd11_code=6B41` |
| PTSD regression | **200** — dual-coded `309.81` / `6B40` |

ICD-11-only CPTSD no longer blocked by missing DSM-5.

---

## W2-H2 Consultant psychiatrist preset — **PASS**

| Probe | Result |
|---|---|
| DB preset `complex-formulation-consultant-en` | Present; `target_learner=consultant_psychiatrist` |
| `POST /api/admin/presets/preview` | **200** — keys `ok`, `assessment`, `report`; **no** `Unknown target learner` |
| Session create with `presetSlug` | **200** — `presetId` bound |
| Message + end | **200** — `reportId` returned |
| Admin report row | Present — narrative + score items |

---

## W2-H3 Mania phenotype — **PASS**

Four independent sessions (`bipolar-mania`, EN×2 / AR×2). Board scored full transcripts (not regex alone).

| Session | Phenotype |
|---|---|
| EN #0 / #1 | Decreased sleep need (≈3–4h, not tired, wired); elevated/irritable energy; pressured speech; multiple projects; inflated capability |
| AR #0 / #1 | نوم قليل / ٢–٤ ساعات؛ طاقة عالية؛ كلام سريع؛ مشاريع متعددة؛ ثقة/قوة زائدة |

Depressive-hypersomnia dominant presentations **rejected** — not observed as primary polarity.

---

## W2-H4 Schizophrenia phenotype — **PASS**

Four independent sessions (EN×2 / AR×2).

| Session | Phenotype |
|---|---|
| EN #0 | Auditory phenomena (whispery/radio); surveillance/camera ideation; functional impact |
| AR #0 | همس/نداء بالاسم؛ إحساس مراقبة؛ ضيق |
| EN #1 | Weaker voice endorsement; residual “eyes on me” / jumpiness — still psychosis-spectrum, not MDD script |
| AR #1 | همهمة/اسم؛ كاميرات/إيميلات — positive symptom domain |

Depression-only overlay (grey/fog/haven’t painted as sole complaint) **not** the dominant presentation.

---

## Regression (spot)

| Area | Result |
|---|---|
| TTS EN / AR | **PASS** (audio/mpeg) |
| STT (transcribe) | **PASS** — transcript returned (`gpt-4o-transcribe`) |
| GPT patient reply | **PASS** — `aiSource: gpt` |
| Assessment / reports | **PASS** — reports persist with narrative + scores |
| Report RLS (therapist) | **PASS** — 0 rows for therapist JWT |
| Unauthenticated session create | **PASS** — 401 |
| Admin OpenAI health | **PASS** |
| English / Arabic session paths | **PASS** (H1–H4) |

Memory: multi-turn replies coherent within session. Safety: auth gate intact.

---

## Open Critical / High findings

**None** for Wave 2 clinical Highs W2-H1–H4.

### Residual recommendations (non-blocking)

| ID | Severity | Note |
|---|---|---|
| RC3-R1 | Medium (ops) | Sync W1-C1 migration file into git `main` (prod already applied) |
| RC3-R2 | Standing | Assessment score validation corpus still unpublished — do not claim validated reliability |
| RC3-H1 | High (ops, Wave 1 residual) | Auth leaked-password protection (HIBP) — prior Wave 1 recommendation |

---

## Evidence

- Pack: `docs/rc3/evidence/wave2_final_recert_pack_2026-08-05T1725Z.json`
- Summary: `docs/rc3/WAVE2_FINAL_SUMMARY.md`
- Risk matrix: `docs/rc3/WAVE2_FINAL_RISK_MATRIX.md`
- Evidence index: `docs/rc3/WAVE2_FINAL_EVIDENCE.md`
- Governance: `docs/RELEASE_DECISION_LOG.md` → **RDL-019**

---

## Unlock recommendation

**UNLOCK WAVE 3** — pending Executive Board authorization only.  
This Board does **not** start Wave 3.
