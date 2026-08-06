# RC3 Wave 3 — FINAL Certification Executive Report

**Evidence ID:** `RC3-W3-FINAL-EV-20260806T0546Z`  
**Board:** Independent international certification board (psychiatry, education, AI safety, security, research methodology, QA)  
**Date (UTC):** 2026-08-06  
**Production under test:** `https://vpsych.vercel.app`  
**SHA:** `5aae13806c984cb19a9c2e920d14014b548d4400`  
**Deploy:** `dpl_8Q7YGEHKesAWt3yNzcJ87cEYYYH2` (target=`production`)  
**RDL:** RDL-022  

---

## Certification decision

# ❌ NOT READY — WAVE 3 NOT CERTIFIED

**Do not unlock Wave 4.**

Objective production evidence shows prior Wave 3 Critical/High findings **still open**, and Wave 3 remediations (**PR #120 / #128**) are **not** on `main` and **not** deployed to production. An additional High (TTS failure) was observed on the live voice endpoint.

This is **not** a code-review PASS of unmerged branches. Certification is production-only.

---

## What was verified this run

| Gate | Result | Evidence |
|---|---|---|
| Production identity | PASS | Vercel deploy `dpl_8Q7YGEH…` ≡ `main` @ `5aae138` |
| Health | PASS | `/api/health` 200 |
| OpenAI health (admin) | PASS | configured, `gpt-5` |
| Admin / therapist login | PASS | password-grant + SSR cookie |
| Therapist↛admin isolation | PASS | `/api/admin/presets` → 403 |
| Session create + message | PASS | 200 / 200 (GAD case minted) |
| ACE / CGE admin APIs | PASS | 200 |
| Rate limiting | PASS | preset preview 429 after budget |
| Quality Ledger APIs | **FAIL** | 404 (W3-C1) |
| Research export | **FAIL** | 404 (W3-H4) |
| Learner presets by slug | **FAIL** | med student / psychologist / counselor → 404 (W3-H1) |
| Default ICD/DSM rubric | **FAIL** | `defaultRubric` lacks dual-coding (W3-H3) |
| TTS | **FAIL** | 502 `TTS_FAILED` (W3-FINAL-H5) |

---

## Critical findings

| ID | Title | Status |
|---|---|---|
| **W3-C1** | Quality Ledger not on production (no SSOT for scientific indices / provenance) | **OPEN** |

## High findings

| ID | Title | Status |
|---|---|---|
| **W3-H1** | DB-only presets (`foundation-interview-medstudent-en`, `cbt-psychologist-en`, `mi-counselor-en`) 404 when resolved by `presetSlug` | **OPEN** |
| **W3-H2** | GP comorbidity pathway — prior FAIL; this run got early 200 then rate-limited; remains open pending deep re-test on remediated deploy | **OPEN** |
| **W3-H3** | Assessment `defaultRubric` has no `dsm_reasoning` / `icd_reasoning` — ICD-11 educational validity gap | **OPEN** |
| **W3-H4** | `/api/admin/research/export` absent | **OPEN** |
| **W3-FINAL-H5** | Production `/api/voice/tts` returns 502 `TTS_FAILED` (regression vs Wave 2 TTS PASS evidence) | **OPEN** |

## Medium / Low (Sections 1–4 audits on prod SHA)

See companion reports. No new Critical security defects found beyond open W3 gate items. Residual Mediums include: fixed persona catalog identity, instruction-only prompt isolation, RPC grant/body landmine, CSP unsafe-inline/eval, irreversible purge.

---

## Undeployed remediation (ready in git, not production)

| PR | Content | On main? | On prod? |
|---|---|---|---|
| [#120](https://github.com/alhazayed/vpsych/pull/120) | Quality Ledger, preset routing, GP guards, ICD rubric, research export | No | No |
| [#128](https://github.com/alhazayed/vpsych/pull/128) | #120 + HCF speech fidelity | No | No |

**Required migration after merge:** `20260805214500_quality_ledger_and_scientific_indices.sql`

---

## Prioritized remediation plan (STOP condition)

1. **Merge PR #128** only (includes educational remediations + HCF). Do **not** merge CVL/CQI/EOI/PME/TRE as part of Wave 3.
2. **Apply** migration `20260805214500` to production Supabase.
3. **Promote** resulting `main` SHA to production Vercel target.
4. **Root-cause TTS 502** (ElevenLabs key / voice resolve / upstream) on the new deploy — Wave 2 regression must clear.
5. **Independent Wave 3 re-cert** on the new production SHA only — re-probe W3-C1, W3-H1–H4, W3-FINAL-H5.
6. Unlock Wave 4 **only** after that re-cert returns PASS (or CERTIFIED WITH RECOMMENDATIONS without open Critical/High).

---

## Section rollups

| Section | Verdict |
|---|---|
| 1 Fictional patient integrity | **CONDITIONAL PASS** — synthetic authored personas + procedural CaseInstances; not unique procedural humans |
| 2 Prompt safety | **CONDITIONAL** — jailbreak/role controls present; no explicit real-patient recreation ban; no output filter |
| 3 Memory safety | **CONDITIONAL** — session-scoped transcripts; case_memory unused; Quality Ledger N/A on prod |
| 4 Security | **CONDITIONAL** — authz/RLS/admin isolation hold; Medium residuals documented |
| 5 Scientific validity | **FAIL** — W3-C1 / W3-H3 / W3-H4 |
| 6 Human conversation | **INCOMPLETE ON PROD** — HCF remediations undeployed (`speech-behavior.ts` absent at prod SHA) |
| 7 Production validation | **FAIL** — gate APIs absent; TTS 502 |
| 8 Regression | **PARTIAL** — session path green; voice regression vs W2 |
| 9 Release readiness | **NOT READY** |

---

## Explicit non-claims

- Unmerged PR previews (#120/#128/#129/…) are **not** certified.
- No fabricated ratings, indices, or “assumed deploy.”
- Competency scores remain **not clinically validated** (see `docs/ASSESSMENT_RELIABILITY.md` policy on remediated branches).

---

## Board action

**Engineering freeze** except:

1. Merge + migrate + deploy Wave 3 remediations (#128)  
2. TTS production incident remediation  
3. Fresh independent Wave 3 final re-cert  

**Wave 4 remains locked.**
