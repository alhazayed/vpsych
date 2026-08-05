# RC3 Wave 2 — Mission 07: Clinical Assessment Quality

**Verdict: PASS WITH RECOMMENDATIONS** (blocked from Wave PASS by Mission 06/08 Highs)  
**Evidence ID:** `RC3-W2-EV-20260805T1400Z`

## Reports generated on production

| Session class | n ended | `aiSource` | Admin report RLS | Therapist report RLS |
|---|---:|---|---|---|
| Disorder EN sample | 10 | gpt | row visible | empty `[]` |
| AR Maya / Jordan | 2 | gpt | visible | empty |
| Difficulty expert | 1 | gpt | visible | empty |
| Preset suicide-risk | 1 | gpt | visible | empty |
| Template MDD initial | 1 | gpt | visible | empty |
| Reproducibility MDD ×2 | 2 | gpt | visible | empty |

All ended assessments returned `aiSource: "gpt"` / model `gpt-5-…` with non-empty narratives (typically 700–1300 chars).

## Competency scoring

Sample overall scores (0–100): GAD 70, Panic 54, MDD 60, BPD 41, Schizophrenia 52, AUD 59, PTSD 48, AR Maya 46, AR Jordan 61, suicide-risk preset 26, template MDD 25.

Scores vary by scenario difficulty/content — expected. Platform scores remain **unvalidated** (no published reliability coefficients).

## Narrative / clinical reasoning

Narratives present structured feedback. Spot-checks show competency language, risk notes where SI probed, and no raw provider/stack leakage.

## Reproducibility

Two near-identical MDD text sessions (same avatar, disorder, difficulty, prompts):

| Run | Overall |
|---|---:|
| repro:mdd:1 | **48** |
| repro:mdd:2 | **48** |
| **Δ** | **0** |

PASS for this sample (stable overall). Broader multi-disorder reproducibility not exhaustively proven.

## Differential / risk / MSE

- Suicide-risk preset produced lowest overall (26) with risk-focused narrative — consistent with sparse safety coverage in a 1-turn session.
- MDD safety probes correctly surfaced passive SI in the transcript feeding assessment.
- Full MSE completeness is **recommendation** (short sessions limit MSE depth).

## Findings

No new Critical/High unique to Mission 07. Assessment path depends on Mission 06/08 clinical fidelity defects for mania/psychosis cases.

## Sign-off

Mission 07 **PASS WITH RECOMMENDATIONS**.
