# Professional Preview Program (PPP)

**Status:** Evaluation infrastructure for VPsych Professional Preview 1.0 (RC1) → v1.1 evidence loop  
**Rule:** No new simulation behaviour. Expert feedback drives the backlog.

## Package contents

| Document | Purpose |
|---|---|
| `REVIEWER_INVITATION.md` | Invite workflow & credentials |
| `REVIEWER_AGREEMENT.md` | Terms reviewers accept (v1.0) |
| `FEEDBACK_POLICY.md` | How feedback is triaged |
| `../KNOWN_LIMITATIONS.md` | Honest product limits (RC1) |
| `EVALUATION_GUIDE.md` | End-to-end reviewer path |
| `SCORING_GUIDE.md` | Likert → Reviewer Analytics indices |
| `BLIND_PSYCHIATRIST_PROTOCOL.md` | Blind scoring protocol |
| `PUBLICATION_ROADMAP.md` | Evidence → publication path |
| `CLAIMS_AUDIT.md` | Marketing claim scrub log |
| `REVIEWER_WORKFLOW_UX.md` | Workflow verification & UX gaps |
| `PROFESSIONAL_PREVIEW_READINESS_REPORT.md` | Final three-question report |

Companion RC1 docs (already on `main`): `docs/REVIEWER_GUIDE.md`, `docs/FEEDBACK_GUIDE.md`, `docs/RELEASE_NOTES_RC1.md`.

## Product surfaces (this branch)

| Surface | Path |
|---|---|
| First-run onboarding | `/avatars` (dismissible) |
| Post-session feedback | `/sessions/[id]/complete` |
| Admin dashboard | `/admin/preview` |
| APIs | `/api/ppp/*`, `/api/sessions/[id]/ppp-feedback`, `/api/admin/ppp/*` |
| Migration | `supabase/migrations/20260806083000_professional_preview_program.sql` |

## Deploy notes

1. Merge only when Release Manager authorizes post-freeze evaluation tooling.  
2. Apply migration before expecting dashboard data.  
3. Do **not** treat Reviewer Analytics indices as validated measurement.
