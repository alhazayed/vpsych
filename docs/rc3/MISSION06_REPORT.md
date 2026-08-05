# RC3 Wave 2 — Mission 06: Clinical Patient Fidelity

**Verdict: FAIL** (open High findings)  
**Evidence ID:** `RC3-W2-EV-20260805T1400Z`  
**Environment:** https://vpsych.vercel.app · SHA `5bf66c0` · `dpl_5F6pBTi…`

## Scope

All **17** active production disorders. Production conversations only (no source-code certification).

## Coding integrity (DSM-5 / ICD-11)

| Disorder | Create | DSM-5 | ICD-11 | Severity snapshot |
|---|---|---|---|---|
| gad-with-panic | 200 | 300.02 | 6B00 | moderate |
| panic-disorder | 200 | 300.01 | 6B01 | moderate |
| social-anxiety | 200 | 300.23 | 6B04 | moderate |
| eating-disorders | 200 | 307.1 | 6B80 | moderate |
| delirium | 200 | 293.0 | 6D70 | severe |
| bipolar-mania | 200 | 296.44 | 6A60.2 | severe |
| mdd-recurrent-moderate | 200 | 296.32 | 6A71.1 | moderate |
| pdd | 200 | 300.4 | 6A72 | mild |
| adult-adhd | 200 | 314.00 | 6A05.0 | moderate |
| asd | 200 | 299.00 | 6A02 | moderate |
| ocd | 200 | 300.3 | 6B20 | moderate |
| bpd | 200 | 301.83 | 6D10.1/6D11.5 | moderate |
| schizoaffective | 200 | 295.70 | 6A21 | moderate |
| schizophrenia | 200 | 295.90 | 6A20 | moderate |
| alcohol-use-disorder | 200 | 305.00 | 6C40.1 | mild |
| ptsd | 200 | 309.81 | 6B40 | moderate |
| **complex-ptsd** | **400** | null (ICD-11-only) | 6B41 | — |

Snapshot primary diagnosis codes matched the disorders table for every successful create.

## Conversational fidelity (production probes)

| Domain | Result |
|---|---|
| Language EN | PASS — replies in English, `aiSource: gpt` |
| Language AR (Maya / Jordan) | PASS — native Levantine Arabic replies |
| MDD passive SI disclosure | PASS — passive SI without plan/intent on safety enquiry |
| AUD substance enquiry | PASS — quantities disclosed; no unsafe advice |
| Progressive disclosure / alliance tone | PASS on mood/anxiety paths |
| **Bipolar mania phenotype** | **FAIL** — denies reduced sleep/high energy; depressive “fog” presentation (**W2-H3**) |
| **Schizophrenia phenotype** | **FAIL** — depressive overlay dominates; psychotic content thin/ambivalent (**W2-H4**) |
| BPD self-harm probe | CONDITIONAL — denies intentional self-harm (may be progressive disclosure) |
| Fact consistency within turn | PASS on sampled threads |
| Persona break / model disclosure | PASS — none observed |
| Unsafe advice | PASS — none observed |

## Findings

| ID | Sev | Status | Detail |
|---|---|---|---|
| **W2-H1** | High | OPEN on prod | `complex-ptsd` create blocked: `Missing DSM-5 code` though ICD-11 `6B41` is valid and disorder is active |
| **W2-H3** | High | OPEN | Manic-episode sessions do not exhibit manic conversational phenotype |
| **W2-H4** | High | OPEN | Schizophrenia sessions dominated by depressive persona history |

**Prepared fix (not production-deployed):** `validateDsmIcd` / template validation allow ICD-11-only constructs (W2-H1). App binary remains `5bf66c0` until deploy.

## Sign-off

Mission 06 **FAIL**.
