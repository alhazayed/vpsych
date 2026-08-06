# Claims Audit — Website & Auth Surfaces

**Date:** 2026-08-06  
**Scope:** Landing (`/`), login hero, analysis overlay, pricing  
**Rule:** Evidence-backed only; no marketing exaggeration.

## Removed or rewritten

| Prior claim | Disposition | Evidence basis |
|---|---|---|
| “highly realistic AI patient simulations” | Softened to bilingual AI standardized patients under expert evaluation | Realism under review; not validated |
| “dynamic facial expressions” | **Removed** — false | Static SVG/PNG portraits only |
| “Instant scoring” visible to trainee | Rewritten — admin-only reports | RLS on `session_reports` |
| “charts mapping diagnostic accuracy” for users | Rewritten — not in preview | No trainee diagnostic-accuracy charts |
| “Receive AI Report” as user step | Rewritten — admin report + expert feedback | Complete page + admin reports |
| Fake stats 10,000+ / 500+ / 95% | **Removed** — replaced with demonstrable facts (40 min cap, live catalog, EN·AR, not validated) | No warehouse supporting those numbers |
| Fabricated testimonials | Replaced with evidence-stance statements | No consented reviewer quotes on file |
| Pro $29 “Most Popular” | Demoted — **not offered** in this build | No billing integration |
| “Trusted by clinicians worldwide” | Rewritten — invited preview evaluators | No worldwide deployment evidence |
| Analysis overlay “report will open automatically” | Rewritten — complete screen + admin-only | UX contradiction fixed in copy |

## Still allowed (demonstrable)

- Voice or text timed sessions  
- Bilingual UI (EN/AR) with natively authored personalities  
- Admin-only performance reports  
- Adaptive curriculum / competency graph surfaces (best-effort)  
- Professional Preview feedback (ratings, CQI, EOI) on this branch after deploy

## Residual risk

Arabic/English marketing strings must stay in parity (`messages/en.json` ↔ `messages/ar.json`). Re-run key parity check after future copy edits.
