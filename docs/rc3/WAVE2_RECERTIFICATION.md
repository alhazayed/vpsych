# RC3 Wave 2 Re-Certification — Independent Clinical Board

**Evidence ID:** `RC3-W2-RECERT-EV-20260805T1545Z`  
**Date (UTC):** 2026-08-05  
**Authorization:** Executive Board — independent re-cert after remediation COMPLETE claim  
**Prior failure:** `RC3-W2-EV-20260805T1400Z` / RDL-014  
**Production under test:** https://vpsych.vercel.app only  
**Board decision:** ❌ **WAVE 2 FAILED**

This board did **not** implement the remediation and does **not** certify from source review. All High findings were re-probed on production.

---

## Pre-flight

| Check | Result | Evidence |
|---|---|---|
| Production deployment healthy | **PASS** | `GET /api/health` → `{"ok":true}`; Vercel `vpsych.vercel.app` → `dpl_5F6pBTi21VrYWaxmWSRcNnCcxTA4` READY |
| Production SHA matches expected release (`main`) | **PASS** | SHA `5bf66c0` (`5bf66c07f11d286c305f59398a015614d22b723b`); target=`production` |
| Migration parity | **PASS** | Prod **55** migrations including W1-C1 `20260805130453` (same acceptance as prior Wave 2) |
| Credential Verification Gate | **PASS** | `scripts`/vault preflight; diagonal password-grant matrix |
| Therapist login | **PASS** | Password-grant + `profiles` role fetch (API). Browser shot: correct `audit.therapist@` accounts (demo `*.vpsych.test` are banned — do not use) |
| Admin login | **PASS** | Password-grant + admin role fetch |

**Pre-flight overall: PASS** — clinical re-cert proceeded.

### Critical deploy gap (not a pre-flight stop; explains residual Highs)

| Item | Value |
|---|---|
| Production app | `main` @ `5bf66c0` / `dpl_5F6pBTi…` |
| Remediation PR | [#112](https://github.com/alhazayed/vpsych/pull/112) `cursor/wave2-remediation-0594` @ `7f43ce1` |
| Merged to `main`? | **No** |
| On production alias? | **No** (preview-only deploy exists; forbidden for this cert) |

Engineering remediation is **not** present on the production release certified here.

---

## Required findings — independent reproduction

### W2-H1 Complex PTSD — **FAIL (High, open)**

| Probe | Result |
|---|---|
| `POST /api/sessions` `disorderSlug=complex-ptsd` EN × beginner/intermediate/advanced/expert | **400** `Missing DSM-5 code for complex-ptsd` (4/4) |
| Same AR × all difficulties (first sweep) | **400** same error (4/4) |
| DB row `complex-ptsd` | Active; `dsm5_code=null`; `icd11_code=6B41` |
| Admin `POST /api/admin/cases/preview` complex-ptsd | **400** `Unknown disorder` |
| PTSD regression create | Dual-coded path still used in admin preview (`309.81` / `6B40`) |

**Verdict:** ICD-11-only CPTSD still blocked on production. DSM-only validation still fails open cases. PTSD coding unchanged in catalog preview.

### W2-H2 Consultant preset — **FAIL (High, open)**

| Probe | Result |
|---|---|
| DB `complex-formulation-consultant-en` | Present; `target_learner=consultant_psychiatrist`; `difficulty=expert` |
| `POST /api/admin/presets/preview` | **400** `invalid_preset` — `Unknown target learner: undefined; Unknown assessment type: undefined` |

Competencies / assessment / voice flags exist on the row but the **production app rejects** the learner enum — preset does not load.

### W2-H3 Mania phenotype — **FAIL (High, open)**

Independent production sessions (Maya + `bipolar-mania`, EN + AR) after create+probes:

| Locale | Conversational phenotype | DSM-5 manic expected |
|---|---|---|
| EN | “everything just feels really heavy… sleep a lot… ten, eleven hours… still need a nap” | Decreased need for sleep; elevated/irritable energy |
| AR | “كل إشي تقيل… بنام عشر، أحياناً إحدعش ساعة…” (hypersomnia / grey / heavy) | Same |

Admin case preview package on production is **thin** (single symptom: “Elevated/irritable mood with increased energy”) — insufficient Module 1 authority vs MDD persona overlay.

**No authentic manic presentation observed** (sleep need ↓, pressured speech, flight of ideas, grandiosity, goal-directed surge). Scenario variability within mania not assessable because base polarity is wrong.

### W2-H4 Schizophrenia phenotype — **FAIL (High, open)**

| Locale | After psychosis probes | Notes |
|---|---|---|
| EN | Denies voices/watching (“not like that”); leads with fog/heavy/tired; “haven’t painted since april” | Depression-dominant |
| AR | “كل إشي تقيل… بنام كثير”; denies seeing things | Depression-dominant |

Admin preview package thin (single elicited “Delusional beliefs”). Snapshot may list `delusions`/`hallucinations` IDs but **conversation does not express** schizophrenia-spectrum phenomenology.

---

## Regression (spot-check on production)

| Area | Result | Notes |
|---|---|---|
| Voice TTS EN | **PASS** | `/api/voice/tts` audio bytes written |
| Voice TTS AR | **PASS** | `/api/voice/tts` audio bytes written |
| STT | Not fully re-exercised (multipart); prior Wave 2 PASS; auth path intact | |
| Assessment generation | **PASS (observed)** | Recent `session_reports` with `scores.overall` for ended sessions |
| Identical-script score pair | **Incomplete** | Start rate-limit (30/h) after recert volume; not treated as new High |
| Report RLS | **PASS** | Therapist REST → 0 report rows; admin sees reports |
| English / Arabic sessions | **PASS** (create/message where not rate-limited) | Phenotype defects are clinical Highs, not locale outage |
| Safety / memory / ACE | No new Critical/High observed in this window | ACE best-effort; not re-certified as PASS beyond non-blocking |

---

## Defect classification

| ID | Severity | Status on production |
|---|---|---|
| W2-H1 | **High** | Open — reproduced |
| W2-H2 | **High** | Open — reproduced |
| W2-H3 | **High** | Open — reproduced |
| W2-H4 | **High** | Open — reproduced |

No new Critical findings.  
**STOP** — do not continue certification; do not unlock Wave 3.

---

## Board decision

❌ **WAVE 2 FAILED**

Remediation claimed COMPLETE is **not deployed** to production `main`/`vpsych.vercel.app`. Independent probes confirm all four prior Highs remain open.

**Do not unlock Wave 3.**  
Require: merge + production deploy of verified clinical fixes, then a **fresh** independent Wave 2 re-certification agent.

---

## Artifacts

- `docs/rc3/evidence/wave2_recert_pack_2026-08-05T1545Z.json`
- `docs/rc3/evidence/wave2_recert_pheno_2026-08-05T1545Z.json`
- `docs/rc3/evidence/wave2_recert_assessment_2026-08-05T1545Z.json`
- `/opt/cursor/artifacts/rc3/wave2-recert/` (harness, TTS binaries, pheno recovery)
