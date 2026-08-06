# Clinical Validation Laboratory (CVL) — Mission 100

**Version:** `1.0.0`  
**Branch:** `cursor/mission-100-cvl-0594`  
**Migration:** `20260806011200_clinical_validation_laboratory.sql`

## Purpose

Scientific validation center for VPsych — **not** software QA.

Validate whether avatars behave like believable psychiatric patients and whether
the platform improves therapist education. Supports publishable research,
educational validation, and continuous clinical improvement.

**Integrity rule:** No fabricated ratings, no simulated evidence, no invented
statistics. Empty metrics mean “collect human data.”

## Modules

| # | Module | Implementation |
|---|---|---|
| 1 | Blind Psychiatrist Challenge (BPC) | `bpc.ts`, blinded assignments |
| 2 | Blind Therapy Challenge (BTC) | `btc.ts` |
| 3 | Resident Education Study | `education-study.ts` |
| 4 | Longitudinal Study | `longitudinal.ts` |
| 5 | Human Conversation Fidelity | `hcf-eval.ts` |
| 6 | Clinical Fidelity Levels (CFL-1…5) | `cfl.ts` → Quality Ledger seal |
| 7 | Quality metrics (CRI/HCFI/TAI/PCI/EEI/DFI/LCI) | `metrics.ts` |
| 8 | Research export (CSV/JSON/SPSS/R/Python/package) | `export.ts`, `/api/admin/cvl/export` |
| 9 | Publication pipeline | `publication.ts` |
| 10 | Quality Vault integration | `ledger-bridge.ts` + `persist.ts` |
| 11 | Executive dashboard | `/admin/cvl` |
| 12 | Roadmap intelligence | `roadmap.ts` |
| — | Assessment accuracy | `assessment-accuracy.ts` + `cvl_assessment_accuracy` |

## Persistence

- **Source of record:** Postgres tables from migration `20260806011200` (admin RLS).
- **Fallback:** in-process memory when tables are absent (`CVL_MEMORY_FALLBACK≠0`).
- Admin APIs load the vault via `loadCvlCorpus(supabase)` and dual-write mutations.
- Response `source` is `database` or `memory`; `is_fabricated` is always `false`.

## Arms & blinding

- **Arm A** real patient (ethically approved, de-identified)  
- **Arm B** standardized patient  
- **Arm C** VPsych avatar  

Reviewer views never include `arm`. Reveal only when study status ∈
`analysis|completed|archived`.

Reviewer identities are opaque tokens (`rvw_…`).

## Clinical Fidelity Levels

| Level | Meaning |
|---|---|
| CFL-1 | Technically coherent (default without human data) |
| CFL-2 | Believable for students |
| CFL-3 | Believable to psychiatrists in transcript review |
| CFL-4 | Believable in blinded live interaction |
| CFL-5 | Educationally ≥ standardized patients for defined objectives |

CFL requires **human approval** before research claims.

## APIs

- `GET /api/admin/cvl` — dashboard  
- `POST /api/admin/cvl` — actions: `create_study`, `submit_bpc`, `submit_btc`,
  `submit_hcf`, `submit_education`, `submit_longitudinal`, `compute_cfl`,
  `set_status`, `reveal_arm`, …  
- `GET /api/admin/cvl/export?format=package|csv|publication|spss|r|python`

## Ops

1. Apply migration `20260806011200_clinical_validation_laboratory.sql`  
2. Obtain IRB / ethics approval before real-patient arms  
3. Register study → recruit reviewers → submit blinded forms  
4. Advance study to `analysis` before unblinding  
5. Approve CFL before publication claims  

## Memory fallback

`CVL_MEMORY_FALLBACK` (default on) stores studies/ratings in process memory when
tables are absent — for local protocol dry-runs only, **not** publication SoR.
