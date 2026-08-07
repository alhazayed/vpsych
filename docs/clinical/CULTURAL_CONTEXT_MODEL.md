# Cultural Context Model

**Owner:** Avatar Personality Module 2 (`CulturalContext` in `types.ts`) + Personality Engine culture/religion strings + native locale authorship.

---

## Purpose

Ensure each locale’s standardized patient is a **natively authored human**, not a translation, and that culture shapes help-seeking and expression without altering diagnosis.

---

## Runtime CulturalContext

| Field | Role |
|-------|------|
| `stigma_framing` | How illness/distress is socially framed |
| `help_seeking_attitude` | Orientation to professional help |
| `family_involvement?` | Family role in care |
| `authority_orientation?` | Power distance with clinicians |
| `disclosure_norms?` | What can be said aloud |
| `faith_or_meaning_framing?` | Faith / meaning |
| `taboo_topics?` | Topics avoided |

Additional cultural signals:

| Field | Owner |
|-------|-------|
| `idioms_of_distress[]` | Avatar Personality |
| `clinical_localization[]` | Avatar Personality (symptom id → local expression) |
| `language` / `dialect` / `direction` | Avatar Personality |
| HPE `culture`, `religion` | Personality Engine Module 2b |
| `authored_natively` / `never_translate` | Personality invariants |

---

## Prompt representation

- **Module 2:** cultural_context + idioms + clinical_localization + identity.  
- **Module 3:** language/dialect directives.  
- **Module 2b:** culture/religion traits.  
- **Invariant:** Module 1 syndrome authority overrides Module 2 current-state conflicts; culture does not rewrite DSM/ICD.

---

## Locale model

| UI locale | Personality locales |
|-----------|---------------------|
| `en` | typically `en-US` |
| `ar` | typically `ar-JO` |

EN and AR personalities are different humans (names, cities, idioms) with shared clinical function for the case — documented in persona index.

---

## Relationships

```
Culture (M2) ──colours──► Symptom expression
Culture ──must not──► Diagnosis codes
Disclosure norms ──align with──► disclosure_rules (clinical) + CBE gates
Faith framing ──HPE religion──► Module 2b
```

---

## What is missing

| Concept | Status |
|---------|--------|
| Formal cultural formulation (e.g. DSM cultural formulation interview structure) | Missing |
| Acculturation scales | Missing |
| Interpreter-use state | Missing |
| Religion as structured practice schedule | Thin string only |

---

## Security / integrity

- Never machine-translate Module 2 from EN→AR or reverse.  
- Crisis resources must be locale-appropriate (`safety_module.crisis_resources`).  
- Taboo topics must not suppress Module 4 safety obligations.
