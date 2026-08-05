# Patient Authenticity Benchmark (PAB)

**Program:** Mission 22 CVHAP · **Metric:** PAB v1.0.0

## 1. Purpose

Compare VPsych PME patients against:

1. Standardized Patients (SP) — criterion reference  
2. Human-written transcripts — linguistic reference  
3. Historical / legacy VPsych prompt engine — before/after  

## 2. Dimensions (weighted)

| Dimension | Weight |
|---|---|
| Dialogue realism | 0.18 |
| Disclosure timing | 0.14 |
| Alliance development | 0.14 |
| Symptom evolution | 0.12 |
| Session continuity | 0.12 |
| Emotional consistency | 0.14 |
| Therapeutic realism | 0.16 |

## 3. Scoring sources

1. **Structural scaffolding:** HCFI + PMFI projections (`src/lib/validation/pab.ts`)  
2. **Expert overlays:** Blind PAS dimension means mapped onto PAB axes (authoritative once collected)  
3. **SP packs:** Rated separately under the same form  

## 4. Interpretation rules

- Structural PAB alone **must not** be published as clinical validation  
- Expert overlays from Mission 22 studies supersede scaffolding  
- Report `pme_delta_vs_best_comparator` with arm labels  

## 5. Current scaffolding note

Automated dry-runs show PME >> toxic legacy dialogue on HCFI-linked axes, while
SP expert overlays remain the ceiling reference (~88–90). Live SP-blind
criterion testing is required before superiority claims.
