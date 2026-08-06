# Wave 3 H5-Only Independent Certification

**Evidence ID:** `RC3-W3-H5-CERT-EV-20260806T0640Z`  
**Authority:** Independent VPsych Wave 3 Certification Board (Cursor)  
**Date (UTC):** 2026-08-06  
**Scope:** **W3-H5 only** (TTS). C1/H1–H4 previously CLOSED (RDL-023).  
**Mode:** Production probes after Release Manager key replace + redeploy. **No application code changes.**  
**Governance:** RDL-024  

---

## Production under test

| Item | Observed |
|---|---|
| URL | `https://vpsych.vercel.app` |
| Deploy | `dpl_DpdpoyEksVeSZvu1wx1mYngeX2jh` READY · redeploy of `d4c4fae` |
| Remediation SHA chain | `1e44dce` (#131) ⊂ `d4c4fae` (#133) |
| Prior open finding | W3-H5: auth TTS → 503 `TTS_CONFIG` on `dpl_7b4x92…` |

---

## Decision

### ✅ WAVE 3 PASSED

| Gate | Result |
|---|---|
| W3-H5 closed | **PASS** |
| All Wave 3 Critical closed | **PASS** (W3-C1 closed in RDL-023) |
| All Wave 3 High closed | **PASS** (H1–H4 in RDL-023; H5 this cert) |
| Unlock Wave 4 | **RECOMMENDED** for Executive Board |

Recommend Executive Board unlock Wave 4. No additional engineering for Wave 3.

---

## W3-H5 evidence

| Probe | Result |
|---|---|
| Auth `POST /api/voice/tts` therapist EN | **200** `audio/mpeg` |
| Auth `POST /api/voice/tts` therapist AR | **200** `audio/mpeg` |
| Auth `POST /api/voice/tts` admin EN | **200** `audio/mpeg` |
| Auth `POST /api/voice/tts` admin AR | **200** `audio/mpeg` |
| E2E sessions (GAD/MDD/PTSD + AR) + avatar TTS + end | **PASS** (4/4) |

Detail: `docs/rc3/W3_H5_CLOSEOUT.md`.

---

## Out of scope

CQI, EOI, CVL, PME, TRE, Medium/Low findings, feature work.
