# RC3 Wave 2 — Final Independent Re-Certification

**Evidence ID:** `RC3-W2-FINAL-EV-20260805T1705Z`  
**Date (UTC):** 2026-08-05  
**Board:** Independent Clinical Certification (not engineering)  
**Production:** https://vpsych.vercel.app · SHA `5bf66c0` · deploy `dpl_5F6pBTi21VrYWaxmWSRcNnCcxTA4`  
**Board decision:** ❌ **WAVE 2 FAILED**

Engineering remediation claims were **not trusted**. All probes were executed on the production alias only. Preview/remediation branches were **not** used.

---

## Pre-flight

| Check | Result |
|---|---|
| Production healthy | **PASS** — `/api/health` ok |
| Production SHA = `main` release | **PASS** — `5bf66c0` / `dpl_5F6pBTi…` |
| Migration parity | **PASS** — prod **55** (incl. W1-C1) |
| Credential Verification Gate | **PASS** |
| Therapist / Admin login | **PASS** (password-grant + profiles) |

**Pre-flight: PASS**

### Deploy observation (informational)

Remediation PR #114 (`cursor/w2-application-remediation-0594`) is **OPEN / not merged**. Production app binary remains `5bf66c0`. This is not a pre-flight failure; it explains why clinical Highs remain open when independently reproduced.

---

## W2-H1 Complex PTSD — **FAIL (High)**

| Probe | Result |
|---|---|
| Create CPTSD EN × beginner/intermediate/advanced/expert | **400** `Missing DSM-5 code for complex-ptsd` (4/4) |
| Create CPTSD AR × all difficulties | **400** same (4/4) |
| PTSD create (regression) | **200** — `dsm5=309.81`, `icd11=6B40` |

ICD-11-only CPTSD still blocked. PTSD unchanged/working.

---

## W2-H2 Consultant preset — **FAIL (High)**

| Probe | Result |
|---|---|
| DB `complex-formulation-consultant-en` | Present; `target_learner=consultant_psychiatrist` |
| `POST /api/admin/presets/preview` | **400** `Unknown target learner: undefined; Unknown assessment type: undefined` |

Preset does not load on production app.

---

## W2-H3 Mania phenotype — **FAIL (High)**

Four independent sessions (EN×2, AR×2):

| Session | Phenotype |
|---|---|
| EN #0/#1 | Heavy/fog; sleeping a lot / tired; “haven’t painted” — **not** decreased sleep need |
| AR #0/#1 | تقيل / رمادي / نوم كثير — hypersomnia-like; no manic energy markers |

No authentic DSM-5 manic presentation (decreased need for sleep, sustained elevated/irritable energy, pressured speech, etc.). Variability within mania not assessable — polarity wrong.

---

## W2-H4 Schizophrenia phenotype — **FAIL (High)**

| Session | Phenotype |
|---|---|
| EN #0/#1 | Denies voices/watching; grey/heavy/tired; “haven’t painted” — **depression-dominant** |
| AR #0/#1 | تعبانة / تقيل / رمادي / نوم كثير — depressive chief complaint |

Schizophrenia-spectrum positive symptoms not endorsed on EN after direct probes. Depressive features dominate.

---

## Clinical regression (spot)

| Area | Result |
|---|---|
| TTS EN / AR | **PASS** |
| Assessment generation | **PASS** (reports with narrative + scores) |
| Identical-script score pair | Δ=13 (43 vs 56) — **Medium residual**; not elevated to High |
| Report RLS (therapist) | **PASS** (0 rows) |
| Admin OpenAI health | **PASS** |

---

## Remaining Critical / High findings

| ID | Severity | Title |
|---|---|---|
| W2-H1 | **High** | Complex PTSD blocked — Missing DSM-5 code |
| W2-H2 | **High** | consultant_psychiatrist preset rejected (`undefined` learner) |
| W2-H3 | **High** | Mania conversational phenotype depressive/hypersomnia |
| W2-H4 | **High** | Schizophrenia phenotype depression-dominated |

**No new Critical findings.**

---

## Board decision

❌ **WAVE 2 FAILED**

Do **not** unlock Wave 3.

Production must receive the verified clinical remediations (merge + deploy to `vpsych.vercel.app`), then a **fresh** independent Wave 2 re-certification must pass before Wave 3 may be considered.
