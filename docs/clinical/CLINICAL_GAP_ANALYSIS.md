# Clinical Gap Analysis

**Stage 3 — documentation only.** Missing concepts are catalogued; **not implemented**.

**Method:** Compared the requested clinical domain list + standard SP ontology expectations against live types, schemas, personas, migrations, and prompt wiring (Aug 2026 codebase).

---

## How to read status

| Status | Meaning |
|--------|---------|
| **Present** | First-class runtime typed (+ usually prompted) |
| **Partial** | Exists as string, flag, proxy, or authored-only |
| **Missing** | Not found as a structured clinical concept |

---

## Domain coverage matrix

| Domain | Status | Evidence | Notes |
|--------|--------|----------|-------|
| Identity | Present | Module 2 identity | |
| Demographics (age/gender) | Present | ClinicalCore | |
| Culture | Present | CulturalContext | |
| Language / dialect | Present | Personality + Module 3 | |
| Religion | Partial | HPE string + faith framing | No practice schedule |
| Education | Present | identity + HPE | |
| Occupation | Present | identity + random variant | |
| Housing / living environment | Partial | living_situation string | No Living Environment Engine |
| Finances | Partial | socioeconomic_context + RandomizedContext | |
| Daily routine | Missing | — | |
| Relationships / family | Partial | family_context prose; LTM relationship | No genogram |
| Children | Partial | LTM category only | No structured child entities |
| Medical illnesses | Partial | Authored developmental/medical prose | Not ClinicalCore |
| Psychiatric diagnoses | Present | Case Engine disorders | |
| DSM mapping | Present | dsm5_code (+ optional null) | |
| ICD mapping | Present | icd10 + icd11 (11 required) | |
| Current symptoms | Present | symptom_profile | |
| Past symptoms | Missing structured | Authored history only | |
| Medication list | Partial | Localization string + LTM category | Chart meds placeholder |
| Substance use | Partial | Risk boolean + AUD package + localization | No pattern/quantity model |
| Risk factors (static/dynamic) | Partial | Authored MSE prose | Not RiskProfile |
| Protective factors | Partial | Authored persona history | **Not** ClinicalCore; CFI gap |
| Trauma history | Partial | Domain + LTM + PTSD packages | No staging ontology |
| Psychological / case formulation | Missing patient object | Trainee rubric only | |
| Personality / temperament | Present | HPE | |
| Attachment | Present | HPE attachment_style enum | |
| Memory | Present | LTM + case_memory | |
| Emotion | Present | Emotion Engine | |
| Behaviour / conversation state | Present | CBE + Adaptation | |
| Therapy history | Partial | Authored case_file | |
| Treatment adherence | Missing | — | |
| Recovery stage | Partial | Authored session_arc | Not enforced |
| Insight | Partial | Difficulty modifier + authored MSE | |
| Judgement | Partial | clinical_teaching + authored MSE | |
| Impulse control | Missing structured | May appear in symptom text | |
| Mental status examination | Partial | Authored only | **Not** runtime ClinicalCore |
| Speech | Present | Personality + speech-behavior | |
| Thought form / content | Partial | Authored MSE | |
| Perception | Partial | Authored MSE / psychotic symptoms | |
| Cognition / attention / executive | Partial | Symptom domain + authored MSE | |
| Sleep / appetite | Partial | Symptom domains | |
| Energy / motivation | Partial | Emotion variables + symptoms | |
| Risk assessment object | Partial | RiskProfile slim | |
| Suicide | Present (levels) | RiskProfile.suicidal_ideation | |
| Violence | Partial | harm_to_others boolean | |
| Self-neglect | Partial | Authored MSE only | |
| Social / occupational functioning | Partial | Prose + WHO-DAS text authored | |
| Voice profile | Present | voice_profiles + CVP | |
| Animation profile | Partial | NBE runtime | Not durable clinical profile |
| Humanization profile | Present (turn plan) | Humanization Engine | |
| Clinical scoring (trainee) | Present | session_reports | Not patient ontology |
| Assessment history (patient instruments) | Missing | Narrative instruments only | |
| SNOMED / LOINC | Missing | — | |
| Labs / psych testing | Missing | TRM chart null | |
| Formal cultural formulation interview | Missing | — | |
| Genogram / family systems graph | Missing | — | |
| Defence mechanisms catalog | Partial | Authored therapy_behaviour; not engine | |
| Comorbid packages (OCD, ASD, eating, …) | Missing | UUID slots reserved | |

---

## High-signal gaps (detail)

### G-01 Protective factors on runtime ClinicalCore
- **Status:** Missing (authored only)  
- **Priority:** Critical  
- **Reason:** CFI dimension expects them; risk formulation incomplete at runtime.  
- **Impact:** Assessment/CFI under-specified; Module 4 cannot cite structured protectives.  
- **Recommended owner:** Case Engine (`ClinicalCore` / disorder package)

### G-02 Runtime Mental Status Exam object
- **Status:** Missing (authored personas only)  
- **Priority:** Critical  
- **Reason:** Rich MSE exists in library but engines/prompts cannot rely on it.  
- **Impact:** Dual-model drift; mse_realism is cue-based only.  
- **Recommended owner:** Case Engine (promote subset into snapshot)

### G-03 Structured medication model
- **Status:** Missing  
- **Priority:** High  
- **Reason:** Meds are prose/LTM only; chart `current_medication` not backed by typed list.  
- **Impact:** Inconsistent SP medication recall; teaching pharmacology weak.  
- **Recommended owner:** Case Engine package + optional LTM sync

### G-04 Substance use pattern
- **Status:** Partial (boolean + AUD diagnosis)  
- **Priority:** High  
- **Reason:** No amount/frequency/route/withdrawal/tolerance fields.  
- **Impact:** AUD cases under-specified beyond package symptoms.  
- **Recommended owner:** Case Engine disorder package extension

### G-05 Past symptom / history timeline
- **Status:** Missing structured  
- **Priority:** High  
- **Reason:** Only onset_duration string + authored HPI.  
- **Impact:** Longitudinal teaching and LTM extraction lack schema.  
- **Recommended owner:** Case Engine history module

### G-06 Patient formulation object
- **Status:** Missing  
- **Priority:** High  
- **Reason:** Rubric scores trainee formulation; SP has no 5P/biopsychosocial object.  
- **Impact:** Cannot grade against a gold-standard formulation artifact.  
- **Recommended owner:** Case Engine teaching package (not Personality)

### G-07 Living environment engine / structured housing
- **Status:** Missing / thin strings  
- **Priority:** Medium  
- **Reason:** No daily routine, housing enum, environmental triggers.  
- **Impact:** Limits ecological validity for some scenarios.  
- **Recommended owner:** New Living Environment package referenced by Case Engine / Module 2

### G-08 Self-neglect & risk to dependents
- **Status:** Missing on RiskProfile  
- **Priority:** High  
- **Reason:** Present in authored MSE risk prose only.  
- **Impact:** Module 4 incomplete for family/elder-care cases.  
- **Recommended owner:** Extend RiskProfile (Case Engine)

### G-09 Recovery stage / session_arc enforcement
- **Status:** Authored only  
- **Priority:** Medium  
- **Reason:** session_arc not a runtime state machine.  
- **Impact:** Multi-session curricula cannot assert expected clinical phase.  
- **Recommended owner:** Case Engine + ACE curriculum bridge

### G-10 Treatment adherence
- **Status:** Missing  
- **Priority:** Medium  
- **Recommended owner:** Adaptation or Case Engine therapy-process

### G-11 Thought form/content & perception typed MSE
- **Status:** Authored only  
- **Priority:** High (psychotic/delirium cases)  
- **Recommended owner:** Case Engine MSE subset

### G-12 Instrument scores (PHQ-9, GAD-7, C-SSRS, …)
- **Status:** Narrative only  
- **Priority:** Medium  
- **Recommended owner:** Case Engine instruments registry (educational, not device)

### G-13 Impulse control
- **Status:** Missing structured  
- **Priority:** Low  
- **Recommended owner:** ClinicalCore or MSE cognition/behaviour

### G-14 Genogram / children entities
- **Status:** Missing  
- **Priority:** Low–Medium  
- **Recommended owner:** Family Dynamics extension (future)

### G-15 Defence mechanisms engine
- **Status:** Authored lists; no engine  
- **Priority:** Medium  
- **Recommended owner:** Future Defence Engine reading Case teaching cues; CBE may enact

### G-16 Reserved disorders without packages
- **Status:** Missing packages  
- **Priority:** High (catalog completeness)  
- **Recommended owner:** Case Engine catalog

### G-17 Emotion vs Adaptation trust/rapport duplication
- **Status:** Present conflict  
- **Priority:** Medium (architecture)  
- **Reason:** Two owners track overlapping constructs.  
- **Impact:** Divergent prompt cues possible.  
- **Recommended owner:** Keep split but add explicit contract: Emotion=affect, Adaptation=alliance — document sync rules (no silent merge)

### G-18 Authored case_file not snapshotted
- **Status:** Partial harvest  
- **Priority:** Critical (integrity)  
- **Reason:** Dual clinical model (library vs runtime).  
- **Impact:** Engineers may assume MSE/protectives exist at runtime — they do not.  
- **Recommended owner:** Case Engine promotion pipeline + ontology enforcement

---

## Conflicting / duplicate definitions found

| Issue | Detail | Action |
|-------|--------|--------|
| Dual patient models | personas case_file vs ClinicalCore | Documented; promote deliberately |
| Attachment in HPE vs persona therapy_behaviour prose | Two narratives | HPE enum is runtime owner |
| Trust/rapport in Emotion and Adaptation | Parallel variables | Ownership contract G-17 |
| ICD-10 on DisorderRow but not ClinicalCore type | Asymmetry | Roadmap parity |
| Insight as difficulty vs MSE.insight | Proxies | Documented in MSE model |

---

## Hidden assumptions (now explicit)

1. Module 1 is a **slim** presentation, not the full psychiatric case file.  
2. Persona JSON richness is for authors/examiners, not the patient LLM — except substance/medication localization.  
3. Diagnosis is always session-minted.  
4. Trainee scores are not patient clinical state.  
5. Soft-fail turn engines may leave emotion/adaptation empty without failing the session.  
6. “Living environment” in product language ≠ a formal clinical environment model today.
