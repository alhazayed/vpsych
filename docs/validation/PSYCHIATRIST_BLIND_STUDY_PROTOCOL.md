# Psychiatrist Blind Study Protocol (PAS)

**Program:** Mission 22 CVHAP · **Metric:** Psychiatrist Authenticity Score (PAS) v1.0.0  
**Status:** Protocol ready — human data collection not yet started

## 1. Objective

Estimate whether consultant psychiatrists, psychiatry residents, and clinical
psychologists perceive VPsych PME patients as clinically realistic under
blinding to diagnosis, engine version, and architecture.

## 2. Design

- **Type:** Randomized, blinded, multi-arm rating study
- **Unit:** Case pack (transcript ± voice clip ± short interactive excerpt)
- **Arms (hidden from raters):** `pme_v1` · `legacy_prompt` · `standardized_patient` · `human_transcript`
- **Allocation:** Block randomization by disorder cluster (mood / anxiety / psychosis / trauma / personality)
- **Blinding:** Raters must not see diagnosis, engine version, patient architecture, or scenario author. Forms enforce `blinded: true` and `arm_unknown_to_rater: true` (`POST /api/admin/validation`).

## 3. Participants

| Role | Minimum n | Inclusion |
|---|---|---|
| Consultant psychiatrist | 4 | Board-certified / equivalent |
| Psychiatry resident | 4 | PGY-2+ |
| Clinical psychologist | 2 | Licensed / equivalent |

Target analytic n ≥ 8 completed PAS forms per arm for CI reporting.

## 4. Materials

Each pack contains:

1. De-identified dialogue (8–20 turns)
2. Optional 60–90s voice sample
3. Rating form dimensions (1–5 Likert):

   - Clinical realism  
   - Diagnostic authenticity  
   - Emotional authenticity  
   - Consistency  
   - Natural conversation  
   - Therapeutic alliance  
   - Interview difficulty  
   - Overall realism  

4. Optional: `suspected_ai` (yes/no/unsure), `would_use_for_teaching`, free text

## 5. PAS computation

Implementation: `src/lib/validation/pas.ts`

- Likert 1–5 → 0–100  
- Weighted composite (clinical 16%, diagnostic 14%, emotional 14%, consistency 12%, natural 14%, alliance 10%, difficulty 6%, overall 14%)  
- Aggregate mean + 95% CI across raters  

**Success threshold (beta):** PAS overall ≥ 70 with CI lower bound ≥ 60.

## 6. Analysis plan (preregister)

1. Primary: PAS overall PME vs SP (non-inferiority margin 5 points)  
2. Secondary: PAS PME vs legacy; suspected-AI rate; ICC(2,k) inter-rater reliability  
3. Sensitivity: exclude persona_fallback sessions  

## 7. Ethics / governance

- IRB / ethics board review as required by host institution  
- No real patient data in packs  
- Distress debrief available for raters  
- No marketing claims until thresholds met  

## 8. Operational API

- Template: `POST /api/admin/validation` `{ "action": "template_pas", ... }`  
- Submit: `{ "action": "submit_pas", "form": { ... } }`  
- Dashboard: `GET /api/admin/validation`
