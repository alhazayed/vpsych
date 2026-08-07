# Clinical Educator — Mission 9

**Status:** Implemented (formative training signals — **not** validated high-stakes credentials)

Replaces a single overall-score-first report with a **ten-dimension OSCE-style** Clinical Educator assessment, detailed educational feedback, and transcript examples.

## Dimensions (equal weight, sum = 100)

| Id | Label |
|---|---|
| `rapport` | Rapport |
| `empathy` | Empathy |
| `risk_assessment` | Risk assessment |
| `history_taking` | History taking |
| `dsm_reasoning` | DSM reasoning |
| `therapeutic_alliance` | Therapeutic alliance |
| `communication` | Communication |
| `professionalism` | Professionalism |
| `session_structure` | Session structure |
| `treatment_planning` | Treatment planning |

Each dimension scores **0–5** with shared anchors (Absent → Exemplary). A weighted **composite** is retained for ACE / ERI / AVI compatibility but is **not** the primary educator UX.

## Deliverables

| Artifact | Location |
|---|---|
| Scoring engine | `src/lib/clinical-educator/engine.ts` |
| Rubrics + anchors | `src/lib/clinical-educator/rubrics.ts` |
| Dashboard | `/admin/clinical-educator` · `GET /api/admin/clinical-educator` |
| PDF report | `GET /api/admin/clinical-educator?format=pdf&sessionId=…` (print-ready HTML) |
| Tests | `src/lib/clinical-educator/clinical-educator.test.ts` |

## Session lifecycle

`assessSession()` uses the Clinical Educator default rubric when the avatar has no custom rubric. Scores persist `scores.clinical_educator` on `session_reports` alongside `overall` + `items`.

Heuristic fallback (`persona_fallback`) still produces all ten dimensions with mined transcript examples when the LLM examiner is unavailable.

## Integrity notes

- Scores are **formative** — UI and PDF carry an explicit disclaimer.
- Transcript examples are therapist turns only; never invent clinical events.
- Arabic labels and feedback are natively authored (not machine-translated from English).
