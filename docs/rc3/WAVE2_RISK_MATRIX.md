# RC3 Wave 2 — Risk Matrix

**Evidence:** `RC3-W2-EV-20260805T1400Z` · **RDL-014**

| ID | Mission | Sev | Likelihood | Impact | Status | Treatment |
|---|---|---|---|---|---|---|
| W2-H1 | 06/08 | High | Certain | Supported trauma disorder unusable | OPEN on prod | Deploy ICD-11-only validation fix; retest create |
| W2-H2 | 08 | High | Certain | Expert consultant preset unusable | OPEN on prod | Deploy `consultant_psychiatrist` learner enum; retest |
| W2-H3 | 06 | High | High | Trainees rehearse wrong manic phenotype | OPEN | Clinical case/prompt remediation — no speculative fix this run |
| W2-H4 | 06 | High | High | Psychosis training fidelity compromised | OPEN | Clinical case/prompt remediation — no speculative fix this run |
| Score unvalidated | 07 | Med | Certain | Over-trust of competency numbers | Accepted | Existing platform rule; corpus needed |
| MSE depth | 07 | Low | Possible | Thin MSE in short sessions | Accepted | Longer sessions in later waves |

## Unlock implication

Any open High ⇒ Wave 2 cannot PASS. Wave 3 remains **LOCKED**.
