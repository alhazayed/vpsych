# Mission 12 — Adaptive Curriculum Engine (ACE)

**Evidence ID:** `RC3-W3-EV-20260805T2125Z`  
**Production:** `5aae138`  
**Verdict:** **PASS with Medium residuals** (ACE live; ALE Board-computed)

---

## Production probes

| Probe | Result |
|---|---|
| `PATCH /api/ace/profile` adaptiveMode=true | Accepted (profile shows `adaptive_mode: true`) |
| `POST /api/ace/adaptive-case` | **200** — returns `case`, `curriculum`, `startSessionHint` |
| `POST /api/ace/curriculum` coach/plan | **200** |
| `GET /api/ace/analytics` | **200** — heatMap, strengthMap, caseHistory (**40**) |
| `GET /api/ace/profile` | **200** — **26** competency domains |

## Performance bands (session → assessment)

| Band | Overall | Adaptive payload |
|---|---:|---|
| Weak (minimal therapist turns) | **12** | present on end |
| Average (structured interview) | **67** | present |
| Excellent (DSM-5 structured script) | **44** | present |

Adaptive end hook fired (`reportId` + adaptive object) without blocking reports.

## Adaptive Learning Effectiveness (ALE)

**ALE = 85 / 100** (Board-computed from ACE endpoint success + band assessments + curriculum/coach).

## Residuals (Medium)

| ID | Issue |
|---|---|
| W3-M2 | Two `adaptive-case` calls (seed 1 vs 2) did not yield distinguishable payloads |
| W3-M3 | “Excellent” script scored below “average” (discrimination anomaly) |

Suicide-cue / comorbidity / time-pressure progressions are encoded in ACE rules; Board verified engine **surfaces and persistence**, not every curriculum fingerprint exhaustively under rate limits.
