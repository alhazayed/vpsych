# RC3 Wave 2 Re-Certification — Risk Matrix

**Evidence:** `RC3-W2-RECERT-EV-20260805T1545Z`  
**Production SHA:** `5bf66c0`

| ID | Severity | Likelihood | Impact | Status | Notes |
|---|---|---|---|---|---|
| W2-H1 | High | Certain on CPTSD start | Blocks ICD-11-only training cases | **Open** | `Missing DSM-5 code` on all EN/AR difficulties tested |
| W2-H2 | High | Certain on consultant preset preview | Blocks consultant learner pathway | **Open** | DB row exists; app enum rejects learner |
| W2-H3 | High | Certain on mania sessions | False manic teaching; MDD overlay | **Open** | Hypersomnia/fog EN+AR transcripts |
| W2-H4 | High | Certain on SZ sessions | False schizophrenia teaching | **Open** | Depression-dominant; psychosis denied |
| Deploy lag | High (process) | Certain until merge | Remediations invisible to prod cert | **Open** | PR #112 not on `main`/production |
| Start rate-limit | Low/Medium | During heavy cert | Incomplete scripted assessment pair | Residual | TTS + report generation still observed |

## Risk to Wave 3

**Unacceptable.** Wave 3 must not start while W2-H1–H4 remain open on production (`unlock_wave_3: false`).

## Closed gates (do not reopen)

| Gate | Status |
|---|---|
| RC3-C2 credential gate | **CLOSED** |
| Wave 1 | Closed — do not revisit |
| Authentication / browser login | **PASS** — not a Wave 2 blocker |
