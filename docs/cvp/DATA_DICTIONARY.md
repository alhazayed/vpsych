# Data Dictionary — Publication Exports

## Ratings CSV (de-identified)

| Column | Type | Description |
|---|---|---|
| study_pseudonym | string(12) | Hash of study id |
| session_pseudonym | string(12) | Hash of session id |
| rater_pseudonym | string(12) | Hash of rater profile id |
| institution_pseudonym | string(12)\|null | Hash of institution id |
| clinical_realism | 1–5\|null | Expert Likert |
| educational_value | 1–5\|null | Expert Likert |
| conversation_naturalness | 1–5\|null | Expert Likert |
| therapeutic_alliance | 1–5\|null | Expert Likert |
| patient_believability | 1–5\|null | Expert Likert |
| learning_impact | 1–5\|null | Expert Likert |
| voice_realism | 1–5\|null | Optional |
| arabic_quality | 1–5\|null | Optional |
| english_quality | 1–5\|null | Optional |
| free_text | string\|null | Scrubbed |
| created_at | ISO\|null | Omitted at `strict` |

## De-identify levels

- `none` — internal only; not for external share  
- `standard` — pseudonyms + email/phone scrub  
- `strict` — standard + stronger name scrub; drop timestamps  

## Ethics

See export `ethics_notes` and `docs/cvp/ETHICS.md`.
