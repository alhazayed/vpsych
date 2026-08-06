# IRB / Ethics Packet — Template

**Study title:** Clinical Validation of an AI Standardized-Patient Simulator for Psychiatric Training (VPsych)  
**Protocol version:** 1.0  
**Platform:** VPsych Professional Preview / Clinical Validation Program  

> Customize bracketed fields for each institutional review board.

## 1. Investigators

- Principal Investigator: [Name, credentials, affiliation]  
- Co-investigators: [List]  
- Technical platform contact: VPsych Release Manager  

## 2. Purpose

To evaluate the **educational fitness**, **perceived realism**, and **measurement properties** of VPsych AI standardized-patient sessions among invited clinicians and trainees. This is **not** a study of clinical outcomes in real patients.

## 3. Participants

- Psychiatrists, psychologists, residents, supervisors, educators  
- Age ≥18; professional/trainee status  
- Target N (pilot): ≥10 reviewers; ≥30 completed rated sessions  

## 4. Procedures

1. Invitation + informed consent / agreement acceptance in-app.  
2. Optional baseline self-report educational instrument.  
3. Randomized allocation of fictional patient avatars (seeded).  
4. Conduct timed voice/text sessions (≤40 minutes).  
5. Submit Likert ratings, CQI, educational opportunity notes.  
6. Subset: dual ratings for inter-rater agreement.  
7. Subset: Blind Psychiatrist Challenge scoring.  
8. Optional post / follow-up instruments.  

## 5. Risks

Minimal: time burden; possible emotional discomfort with simulated clinical material. No physical procedures. No real PHI.

## 6. Benefits

Contribution to educational science; optional institutional feedback reports (aggregate).

## 7. Confidentiality & data handling

- Production data under existing platform security controls.  
- Research exports use pseudonymization and free-text scrubbing (`deidentify_level: standard|strict`).  
- Retention: [X years] per institutional policy.  

## 8. Consent

Electronic consent at `/validation/accept` (`consent_version` recorded on enrollment).

## 9. Analysis plan (pre-register before primary look)

- Primary (reliability pilot): ICC(2,1) or weighted κ on clinical realism dual ratings.  
- Secondary: mean educational value; CONSORT flow completeness.  
- Exploratory: EN vs AR quality ratings; institution comparison.  

## 10. Attachments

- `ETHICS.md`  
- `CONSORT.md`  
- `docs/KNOWN_LIMITATIONS.md`  
- `docs/ppp/REVIEWER_AGREEMENT.md` (or CVP-specific agreement)  
- Sample export codebook  

## 11. Determination request

Request [exempt / expedited / full] review as **educational research with minimal risk**.
