# CONSORT-Style Reporting Guide (Educational Simulation)

CONSORT was designed for randomized clinical trials. CVP adapts the **flow diagram and reporting items** for educational simulation studies.

## Flow counts (automated)

`buildConsortFlow` / Clinical Validation Dashboard:

1. Assessed for eligibility (= invitations issued)  
2. Excluded (= expired/revoked invites)  
3. Randomized / allocated (= assignment arms)  
4. Received intervention (= completed assignments)  
5. Completed follow-up (= post outcome measures)  
6. Analysed (= dual-rated sessions or primary analysis N)

## Checklist (human narrative)

| Item | Report |
|---|---|
| Trial design | Parallel allocation of avatar arms / blind challenge subset |
| Participants | Eligibility, settings (institutions) |
| Interventions | AI standardized-patient session (voice/text); no clinical treatment |
| Outcomes | Pre-specified Likert / educational instruments |
| Sample size | Justification (pilot vs confirmatory) |
| Randomization | Seeded hash allocation (`allocation_seed`) |
| Blinding | Condition codes withheld from blind scorers |
| Statistics | Methods for κ/ICC/outcomes with CIs |
| Harms | Distress / critical CQI |
| Limitations | Synthetic patients; formative AI assessment scores |
| Registration | [Registry ID if any] |
| Funding | [Disclose] |

## Do not

- Present formative AI competency scores as validated patient outcomes.  
- Claim CONSORT “compliance” without completing the human narrative checklist.
