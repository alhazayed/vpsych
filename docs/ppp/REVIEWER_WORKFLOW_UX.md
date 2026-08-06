# Reviewer Workflow Verification & UX Recommendations

## Target path (no documentation)

create account → start patient → complete session → receive feedback → submit CQI → submit Educational Opportunity

## Verification (code / product reality)

| Step | Status on RC1 production | Status with this PPP branch |
|---|---|---|
| Create account | **Pass** — `/signup` | Pass |
| Start patient | **Pass** — `/avatars` → session | Pass + onboarding checklist |
| Complete session | **Pass** — end API + complete page | Pass |
| Receive feedback | **Fail / confusing** — overlay implies personal report; therapists never see full report | **Improved copy** — sets admin-only expectation; expert Likert feedback collected |
| Submit CQI | **Fail** — no product surface | **Pass** — complete-page CQI tab + API |
| Submit Educational Opportunity | **Fail** — no product surface | **Pass** — EOI tab + API |

## Highest-impact UX recommendations (no simulation changes)

1. **Keep onboarding mandatory once** for new accounts (implemented; dismissible).  
2. **Surface coach summary** already returned by session end API (ACE) as a lightweight “what to practice next” — optional, still not the admin rubric.  
3. **Mic permission tip** inside first voice session (one-line banner).  
4. **Language picker reminder** before first Arabic session.  
5. **Admin invite checklist** linking dashboard → open Critical CQI.  
6. **Enrollment prompt** after first completed session (`/api/ppp/enroll`) so reviewer count is accurate.  
7. **Feature-request shortcut** from complete page (API exists; UI can add a fourth tab later).  
8. **Empty-state dashboard** copy already warns if migration missing — apply migration before cohort kickoff.  
9. **Do not** show fake “your score: 87” to therapists until validation studies complete.  
10. **Email confirm friction** — document invite path for institutions that block confirmation mail.

## Verdict

Without this branch, the reviewer path **cannot** submit CQI/EOI in-product and is confused about “receiving feedback.”  
With this branch (after migration + deploy authorization), the path is completable without external documentation for a careful first-time psychiatrist.
