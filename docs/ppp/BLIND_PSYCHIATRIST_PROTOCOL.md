# Blind Psychiatrist Protocol

**Version:** 1.0  
**Purpose:** Reduce expectancy bias when judging patient realism.

## Design

1. Scorer is a board-eligible/certified psychiatrist (or equivalent).  
2. Scorer does **not** see marketing copy, AI-provider branding, or prior Reviewer Analytics.  
3. Materials: anonymized transcript (and optional audio) labeled only as “standardized patient encounter A/B/…”.  
4. Condition codes (kept by protocol admin, not shown to scorer during rating):
   - `ai_patient` — VPsych session  
   - `human_sp` — human standardized patient (when available)  
   - `unknown` — reserved / mixed pilots  
5. Scorer rates `overall_realism` 1–5 and optionally `would_use_in_training` (Y/N) with free-text evidence.  
6. Admin records via `POST /api/admin/ppp/blind-scores`.

## Sample size guidance

- Pilot: ≥5 blind scores before dashboard interpretation  
- Comparative claim vs human SP: pre-register N, primary endpoint, and analysis; do not claim superiority from convenience samples

## Analysis hygiene

- Separate blind means from open expert ratings  
- Do not average blind and open ratings into a single “truth” score without a written analysis plan  
- Free text may contain clinical content — de-identify before external sharing

## Out of scope for RC1 freeze

Changing patient generation, prompts, or voice casting based on interim blind scores during a frozen evaluation window — batch findings into v1.1.
