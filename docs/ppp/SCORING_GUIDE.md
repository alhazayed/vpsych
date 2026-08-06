# Scoring Guide — Reviewer Analytics

Expert Likert ratings (1–5) are aggregated into **formative** 0–100 indices.  
These are **not** published reliability coefficients and must not be marketed as validated.

## Session rating fields

| Field | Required | Maps to index |
|---|---|---|
| Clinical realism | Yes | Clinical Authenticity (with believability) |
| Educational value | Yes | Educational Value Index |
| Conversation naturalness | Yes | Conversation Naturalness Index |
| Therapeutic alliance | Yes | Therapeutic Alliance Score |
| Patient believability | Yes | Patient Believability Score (+ Authenticity) |
| Learning impact | Yes | Learning Impact Score |
| Voice realism | Optional | Voice Realism Score |
| Arabic quality | Optional | Arabic Quality Score |
| English quality | Optional | English Quality Score |

## Conversion

\[
\text{index} = \mathrm{round}_{0.1}\big((\bar{x} - 1) / 4 \times 100\big)
\]

where \(\bar{x}\) is the mean of contributing Likert values.

**Clinical Authenticity Index** uses the mean of `clinical_realism` and `patient_believability` across all ratings.

## Anchors (1–5)

| Score | Meaning for preview |
|---|---|
| 1 | Unacceptable for training use |
| 2 | Major caveats; limited educational value |
| 3 | Usable with clear caveats |
| 4 | Strong for invited preview |
| 5 | Excellent for preview (still not a validation claim) |

## Blind scores

Blind psychiatrist protocol scores (`overall_realism` 1–5) are tracked separately on the dashboard and are **not** blended into the nine indices until the protocol sample is large enough for a pre-registered analysis (`BLIND_PSYCHIATRIST_PROTOCOL.md`).

## Implementation

`src/lib/ppp/indices.ts` · `computeReviewerAnalytics` · version `PPP_INDICES_VERSION = 1.0.0`
