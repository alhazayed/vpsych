# ICD Mapping

**Owner:** Case Engine (`disorders.icd10_code`, `disorders.icd11_code`)  
**Evidence:** catalog, validation (ICD-11 required), assessment `icd_reasoning`, CFI `icd11_consistency`.

---

## Purpose

Provide ICD-10 and ICD-11 codes for educational diagnostic fidelity. **ICD-11 is mandatory** for every active disorder package.

---

## Implementation rules

| Rule | Evidence |
|------|----------|
| `icd11_code` required | case-engine validation |
| `icd10_code` stored on DisorderRow / snapshot diagnosis | may be null only if not authored — catalog currently fills both when available |
| ClinicalCore type has `icd11_code?` but **not** `icd10_code` | types.ts asymmetry — ICD-10 lives on snapshot diagnosis |
| Locale/culture must not alter codes | Case Engine invariant |
| Patient does not announce ICD codes | prompt rules |

---

## Builtin disorder → ICD

| Slug | ICD-10 | ICD-11 | Category |
|------|--------|--------|----------|
| `mdd-recurrent-moderate` | F33.1 | 6A71.1 | mood |
| `gad-with-panic` | F41.1 | 6B00 | anxiety |
| `ptsd` | F43.10 | 6B40 | trauma |
| `adult-adhd` | F90.0 | 6A05.0 | neurodevelopmental |
| `alcohol-use-disorder` | F10.10 | 6C40.1 | substance |
| `panic-disorder` | F41.0 | 6B01 | anxiety |
| `bpd` | F60.3 | 6D10.1/6D11.5 | personality |
| `complex-ptsd` | null | 6B41 | trauma |
| `schizophrenia` | F20.9 | 6A20 | psychotic |
| `bipolar-mania` | F31.2 | 6A60.2 | mood |
| `delirium` | F05 | 6D70 | medical |

---

## Related coding (authored, not runtime catalog)

| Kind | Where | Runtime? |
|------|-------|----------|
| Z-code psychosocial strings | persona `diagnosis.psychosocial_and_contextual` | No |
| Specifiers | persona diagnosis block | No |
| SNOMED / LOINC | — | Missing |

---

## Assessment surfaces

- Rubric: `icd_reasoning`  
- CFI: `icd11_consistency`  
- Template objectives may include `icd_reasoning` category  

---

## Extension points

- Add ICD-11 (+ ICD-10 when applicable) with every new disorder package.  
- Consider adding `icd10_code?` to ClinicalCore for parity with snapshot diagnosis (roadmap; do not fork a second coding model in another engine).
