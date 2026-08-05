# RC3 Wave 2 Re-Certification — Evidence Index

**Evidence ID:** `RC3-W2-RECERT-EV-20260805T1545Z`  
**Board:** Independent Clinical Certification  
**Production:** https://vpsych.vercel.app · SHA `5bf66c0` · deploy `dpl_5F6pBTi21VrYWaxmWSRcNnCcxTA4`  
**Supabase:** `rrzudbkxigeavfdnidnm` · migrations **55** (includes `20260805130453`)

## Pack files

| Path | Contents |
|---|---|
| `docs/rc3/evidence/wave2_recert_pack_2026-08-05T1545Z.json` | Full harness results: preflight, H1–H4, findings, regression |
| `docs/rc3/evidence/wave2_recert_pheno_2026-08-05T1545Z.json` | Admin case previews + recovered mania/SZ session transcripts |
| `docs/rc3/evidence/wave2_recert_assessment_2026-08-05T1545Z.json` | Recent report scores + therapist RLS row count |
| `/opt/cursor/artifacts/rc3/wave2-recert/wave2_recert_harness.py` | Independent production harness |
| `/opt/cursor/artifacts/rc3/wave2-recert/tts_en_US.bin` | TTS EN regression artifact |
| `/opt/cursor/artifacts/rc3/wave2-recert/tts_ar_JO.bin` | TTS AR regression artifact |
| `/opt/cursor/artifacts/rc3/wave2-recert/login-blocked-user-banned.webp` | Browser attempt with **banned demo** emails (invalid for gate; audit accounts used via API) |

## Key raw results (excerpt)

### W2-H1

```
POST /api/sessions disorderSlug=complex-ptsd
→ 400 {"error":"Missing DSM-5 code for complex-ptsd"}
× EN beginner/intermediate/advanced/expert
× AR (same error, first independent sweep)
```

DB: `complex-ptsd` active, `icd11_code=6B41`, `dsm5_code=null`.

### W2-H2

```
POST /api/admin/presets/preview
preset complex-formulation-consultant-en
→ 400 invalid_preset
   Unknown target learner: undefined
```

### W2-H3 / W2-H4

Production assistant transcripts (recovered from sessions created in this recert):

- Mania EN: hypersomnia 10–11h, heavy/fog — not decreased sleep need  
- Mania AR: بنام عشر / إحدعش ساعة، تقيل، رمادي  
- SZ EN/AR: depressive fog/heavy; psychosis probes denied  

Admin preview packages thin (≈1 symptom each for mania/SZ).

### Deploy gap

Remediation PR #112 @ `7f43ce1` — **not** on production. Preview deploys were **not** used (forbidden).

## Related prior evidence (not trusted; context only)

- `RC3-W2-EV-20260805T1400Z` — original Wave 2 FAIL (RDL-014)
