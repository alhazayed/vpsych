# Reviewer Invitation Workflow

**Program:** VPsych Professional Preview  
**Agreement version:** 1.0

## Goal

Invite psychiatrists, psychologists, residents, supervisors, and educators into a controlled cohort without public marketing funnels.

## Steps (Release Manager)

1. **Select cohort** — specialty mix, bilingual capability, training role. Target ≥10 active reviewers before claiming program coverage.  
2. **Provision access** — create accounts via `/signup` or institutional invite; optionally elevate a coordinator to `admin` for report review.  
3. **Send invite packet** containing:
   - Production URL (`https://vpsych.vercel.app`)
   - `docs/ppp/REVIEWER_AGREEMENT.md` (summary + link)
   - `docs/ppp/EVALUATION_GUIDE.md`
   - `docs/KNOWN_LIMITATIONS.md`
   - Expected time budget (60–90 minutes for first pass)
   - Feedback channel (email / shared tracker)
4. **On first login** — reviewer sees onboarding checklist on `/avatars`; dismiss after reading.  
5. **Optional enrollment API** — `POST /api/ppp/enroll` with `acceptAgreement: true` records cohort membership for the dashboard.  
6. **Track completion** — Admin → Professional Preview dashboard: reviewers, completed sessions, ratings, CQI, EOI.  
7. **Debrief** — collect Critical/High items within 48h; wishlist items enter v1.1 backlog.

## Invite email template (short)

Subject: VPsych Professional Preview — expert evaluation invite

You are invited to evaluate VPsych as a clinical educator/clinician.  
Please complete 1–2 sessions (voice or text), then submit ratings and any CQI / educational opportunity notes on the session-complete screen.  
Full competency reports remain admin-only; scores are formative and not validated.  
See Known Limitations before starting. Do not enter real patient PHI.

## Do not

- Promise “validated” scores or “most realistic simulator” status  
- Share service-role keys or admin accounts casually  
- Ask reviewers to debug experimental excellence PRs during RC1 freeze
