# Mission 10 — Educational Reliability

**Evidence ID:** `RC3-W3-EV-20260805T2125Z`  
**Production:** `5aae138`  
**Verdict:** **PASS** (reliability demonstrated; platform ERI endpoint absent)

---

## Method

Five identical PTSD beginner sessions on production with the same therapist script (3 turns), each ended and assessed.

| Repeat | Overall |
|---|---:|
| 0 | 64 |
| 1 | 60 |
| 2 | 64 |
| 3 | 64 |
| 4 | 55 |

- Mean overall: **61.4**
- SD: **3.97**
- n: **5**

## Educational Reliability Index (ERI)

**ERI = 90 / 100** (Board-computed from overall-score stability; formula: `100 - (SD/40)*100`, clamped).

Narrative lengths present on all successful reports; feedback fields populated on rubric items.

## Limitations

- Platform has **no** `/api/eri` or persisted ERI ledger (404).
- Inter-rater human reliability not in scope (AI–AI reproducibility only).
- Mission 12 noted discrimination anomaly (separate Medium).

## Result

Educational reliability **demonstrated** on production for identical-script overall scores within acceptable variance.
