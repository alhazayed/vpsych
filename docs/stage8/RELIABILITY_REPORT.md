# Stage 8 — Reliability Report

## Inter-rater

Engine supports multiple expert raters via `storeExpertRating` / admin POST `action:"rate"`.

Metrics:

- Percent agreement (binned)  
- Cohen's κ (two-rater categorical)  
- ICC(1,1) approximation  
- Weighted agreement  

Inference gate: ≥2 raters and ≥5 paired cases; otherwise `sufficient_for_inference=false` and coefficients may be null.

## Domains

`overall_realism`, `diagnostic_agreement`, `risk_agreement`, `communication_agreement`, alliance, MSE, emotion, behaviour, therapy_response.

## Disclosure

Empty rating corpora → `reliability.overall = null`. Platform educational scores remain **unvalidated**. No fabricated significance.
