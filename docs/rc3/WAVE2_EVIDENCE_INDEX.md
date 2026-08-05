# RC3 Wave 2 — Evidence Index (Final Independent Re-Cert)

**Evidence ID:** `RC3-W2-FINAL-EV-20260805T1705Z`  
**Production:** https://vpsych.vercel.app · SHA `5bf66c0` · `dpl_5F6pBTi21VrYWaxmWSRcNnCcxTA4` · migrations **55**

## Pack

| Path | Contents |
|---|---|
| `docs/rc3/evidence/wave2_final_pack_2026-08-05T1705Z.json` | Full harness: preflight, H1–H4, regression, findings |
| `/opt/cursor/artifacts/rc3/wave2-final/final_harness.py` | Independent production harness |
| `/opt/cursor/artifacts/rc3/wave2-final/harness.log` | Console transcript |
| `/opt/cursor/artifacts/rc3/wave2-final/tts_en_US.bin` | TTS EN artifact |
| `/opt/cursor/artifacts/rc3/wave2-final/tts_ar_JO.bin` | TTS AR artifact |

## Key raw results

### W2-H1
```
POST /api/sessions disorderSlug=complex-ptsd
→ 400 Missing DSM-5 code for complex-ptsd
× EN×4 difficulties × AR×4 difficulties
PTSD regression → 200 (309.81 / 6B40)
```

### W2-H2
```
POST /api/admin/presets/preview (complex-formulation-consultant-en)
→ 400 Unknown target learner: undefined; Unknown assessment type: undefined
```

### W2-H3 / W2-H4
Production transcripts in pack under `w2_h3.sessions` / `w2_h4.sessions` (EN×2 + AR×2 each).

### Deploy gap
Production SHA `5bf66c0` — remediation PR #114 not on production.

## Prior evidence (context only; not trusted for this verdict)

- `RC3-W2-EV-20260805T1400Z` — original FAIL  
- `RC3-W2-RECERT-EV-20260805T1545Z` — prior independent FAIL  
