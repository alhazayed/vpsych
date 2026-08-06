# Ethics — Clinical Validation Program

## Principles

1. **Educational research, not clinical care.** Participants practice with fictional AI patients. No real-patient PHI.  
2. **Voluntary participation.** Reviewers may withdraw; data already exported under IRB may remain in approved datasets.  
3. **Minimization.** Collect only ratings, structural session metadata, and de-identified free text needed for endpoints.  
4. **Transparency.** Scores shown to trainees (if any) remain formative; admin reports stay scoped.  
5. **No deception beyond protocol blinding.** Blind challenge withholds condition codes until analysis; participants are informed that blinding may be used.  
6. **Equity.** Invite bilingual and multi-role cohorts (psychiatrists, psychologists, residents, supervisors, educators).

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Distress from simulated crisis content | Known-limitations briefing; optional skip; CQI critical path |
| Re-identification from free text | De-identify pipeline (standard/strict); scrub emails/phones |
| Over-interpretation of AI scores | Explicit formative disclaimers on dashboards and exports |
| Coercion via training programs | Institutional consent; voluntary language in invites |

## Data classes

- **Direct identifiers:** account email (ops only); not in publication exports.  
- **Pseudonyms:** SHA-256 truncated IDs in exports.  
- **Ratings / outcomes:** analytic payload.  
- **Transcripts:** optional; if exported, require strict scrub + separate IRB appendix.

## Contact

Release Manager / Study PI (fill per site).
