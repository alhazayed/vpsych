# Clinical Validation Program (CVP)

**Status:** Evidence-generation infrastructure for transforming VPsych from a certified simulator into a scientifically validated educational platform.  
**Hard rules:** Do not alter RC1 simulation behaviour. Do not reduce stability. Expert feedback and measurement drive v1.1+.

## Relationship to PPP

Professional Preview Program (`docs/ppp/`) collected formative expert ratings.  
CVP adds **study protocol**, **institutions**, **invitations**, **randomized assignment**, **blind challenge**, **IRA/reliability**, **outcomes**, **exports**, and **CONSORT/IRB** packaging.

## Objectives → implementation map

| # | Objective | Implementation |
|---|---|---|
| 1 | Reviewer enrollment | `cvp_enrollments` + `POST /api/cvp/accept` |
| 2 | Institution management | existing `institutions` + `POST /api/admin/cvp/institutions` + study sites |
| 3 | Invitation system | `cvp_invitations` + token hash + admin invite API |
| 4 | Reviewer dashboard | `/validation` |
| 5 | Session assignment | `cvp_assignments` + link-session API |
| 6 | Randomized avatar allocation | `planRandomizedAllocations` (seeded, deterministic) |
| 7 | Blind Psychiatrist Challenge | `cvp_blind_challenges` + `/api/cvp/blind-challenge` |
| 8 | Inter-rater agreement | Cohen κ, Fleiss κ, ICC(2,1) in `src/lib/cvp/reliability.ts` |
| 9 | Reliability statistics | Cronbach α + IRA report on dashboard |
| 10 | Educational outcome measurements | `cvp_outcome_measures` + summarize pre/post |
| 11 | Research exports | `POST .../export` publication package |
| 12 | Publication-ready datasets | de-identified CSV + codebook + ethics notes |
| 13 | Ethics documentation | `docs/cvp/ETHICS.md` |
| 14 | IRB-ready documentation | `docs/cvp/IRB_PACKET.md` |
| 15 | CONSORT-style reporting | `buildConsortFlow` + dashboard panel |
| 16 | De-identified data pipeline | `src/lib/cvp/deidentify.ts` |
| 17 | Institution comparison | dashboard `institutions[]` |
| 18 | Longitudinal reviewer tracking | `cvp_reviewer_snapshots` |
| 19 | Calibration statistics | `cvp_calibration_items` + dashboard counts |
| 20 | Clinical Validation Dashboard | `/admin/validation` |

## Migration

`supabase/migrations/20260806100000_clinical_validation_program.sql`  
(Requires PPP migration `20260806083000` for shared ratings tables.)

## Roadmap

See `ROADMAP.md` for the full path from certified simulator → validated educational platform.
