# RC3 Wave 2 — Final Evidence Index (Post-Deploy)

**Evidence ID:** `RC3-W2-FINAL-RECERT-EV-20260805T1725Z`  
**Board decision:** ✅ WAVE 2 PASSED (RDL-019)

## Environment

| Item | Value |
|---|---|
| URL | https://vpsych.vercel.app |
| Deploy | `dpl_8Q7YGEHKesAWt3yNzcJ87cEYYYH2` |
| Git SHA | `5aae13806c984cb19a9c2e920d14014b548d4400` |
| Remediation SHA | `8436208453858b15d214b72ece061cfda8923565` |
| Supabase project | `rrzudbkxigeavfdnidnm` |
| Migrations (remote) | 55 (incl. `20260805130453`) |

## Artifacts

| Path | Content |
|---|---|
| `docs/rc3/evidence/wave2_final_recert_pack_2026-08-05T1725Z.json` | Full machine pack (preflight, H1–H4 transcripts, regression) |
| `docs/rc3/WAVE2_FINAL_RECERTIFICATION.md` | Board report + verdict |
| `docs/rc3/WAVE2_FINAL_SUMMARY.md` | Executive summary |
| `docs/rc3/WAVE2_FINAL_RISK_MATRIX.md` | Risk matrix |
| `docs/RELEASE_DECISION_LOG.md` | RDL-018 / RDL-019 |

## Probe inventory (production only)

| ID | Method | Outcome |
|---|---|---|
| Preflight | Vercel deploy meta + health + credential gate + logins | PASS |
| W2-H1 | 8× CPTSD session create + PTSD regression | PASS |
| W2-H2 | Admin preset preview + preset session + report | PASS |
| W2-H3 | 4× mania sessions × 4 probes; Board transcript review | PASS |
| W2-H4 | 4× schizophrenia sessions × 4 probes | PASS |
| Regression | TTS EN/AR, STT, GPT message, report RLS, unauth 401 | PASS |

## Explicit exclusions

- No preview deployments  
- No localhost  
- No source-code certification  
- No engineering / deploy / fixes in this run  
- Wave 3 not started  
