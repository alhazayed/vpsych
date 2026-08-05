# RC3 Wave 2 — Evidence Index

**Master evidence ID:** `RC3-W2-EV-20260805T1400Z`  
**Prior:** Wave 1 `RC3-W1-EV-20260805T1305Z` · Gate `RC3-C2-EV-20260805T1245Z`

## Production identity

| Item | Value |
|---|---|
| URL | https://vpsych.vercel.app |
| SHA | `5bf66c07f11d286c305f59398a015614d22b723b` |
| Deployment | `dpl_5F6pBTi21VrYWaxmWSRcNnCcxTA4` |
| Migrations | 55 (incl. W1-C1 owner-auth RPC bodies) |
| Agent | `bc-633ebfe4-f64d-4ded-a27d-101fecb90594` |

## Documents

| Path | Role |
|---|---|
| `docs/rc3/MISSION06_REPORT.md` | Patient fidelity |
| `docs/rc3/MISSION07_REPORT.md` | Assessment quality |
| `docs/rc3/MISSION08_REPORT.md` | Clinical runtime matrix |
| `docs/rc3/VOICE_CERTIFICATION.md` | STT/TTS |
| `docs/rc3/CLINICAL_RUNTIME_CERTIFICATION.md` | Safety |
| `docs/rc3/WAVE2_SUMMARY.md` | Summary |
| `docs/rc3/WAVE2_EXECUTIVE_SUMMARY.md` | Board one-pager |
| `docs/rc3/WAVE2_RISK_MATRIX.md` | Risks |
| `docs/RELEASE_DECISION_LOG.md` | RDL-013 / RDL-014 |

## Machine evidence

| Path | Contents |
|---|---|
| `docs/rc3/evidence/wave2_pack_2026-08-05T1400Z.json` | Pack (sessions, voice, findings) |
| `/opt/cursor/artifacts/rc3/wave2/wave2_harness_results.json` | Full harness |
| `/opt/cursor/artifacts/rc3/wave2/wave2_gapfill.json` | Templates + repro |
| `/opt/cursor/artifacts/rc3/wave2/tts_*.mp3` | TTS samples |
| `/opt/cursor/artifacts/rc3/wave2/*-login.png` | Login screenshots |

## Correction traceability (prepared, not prod-cleared)

| Mission | Finding | Change | RDL |
|---|---|---|---|
| 06/08 | W2-H1 | `src/lib/case-engine/validation.ts` + scenario-templates validation | RDL-014 |
| 08 | W2-H2 | `src/lib/instructor-presets/types.ts` TARGET_LEARNERS | RDL-014 |
