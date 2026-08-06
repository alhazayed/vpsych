# Feedback Policy — Professional Preview

## Channels

| Channel | When | Where |
|---|---|---|
| Session ratings (Likert 1–5) | After every completed session | Session complete → Ratings tab |
| CQI issue report | Defects / risks / blockers | Session complete → CQI tab |
| Educational opportunity | Teaching moments & curriculum gaps | Session complete → EOI tab |
| Feature request | Non-blocking ideas | `POST /api/ppp/feature-request` (or CQI severity `wishlist`) |
| Blind psychiatrist score | Protocol sessions only | Admin `POST /api/admin/ppp/blind-scores` |
| Written debrief | Cohort wrap-up | Release Manager channel |

## Severity definitions (CQI)

| Severity | Meaning | SLA (preview) |
|---|---|---|
| **Critical** | Blocks evaluation or risks harm / data integrity | Immediate triage; may justify production hotfix under RC1 Critical exception |
| **High** | Serious clinical/educational distortion | Fix before expanding cohort |
| **Medium** | Noticeable but workable | Batch into next preview patch |
| **Wishlist** | Roadmap | v1.1 backlog — must not delay Critical/High |

## Triage rules

1. Wishlist never outranks Critical/High.  
2. Simulation behaviour remains frozen unless Critical production defect is verified.  
3. Duplicate reports are linked; first reporter retained.  
4. Reviewer Analytics indices update from ratings only — never invent scores.  
5. Public claims may only cite cohort aggregates after Release Manager review (`CLAIMS_AUDIT.md`).

## Retention

Feedback rows live in PPP tables with RLS (owner + admin). Export for research requires admin auth and de-identification of free text.
