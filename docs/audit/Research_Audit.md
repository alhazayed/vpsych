# Research / Scientific Audit — Sections E (AQI) & G (SEI)

**Audit:** VEA-2026-08-05 · Production SHA `5aae138` · Observational only

## Important separation

| Layer | On production `5aae138`? |
|---|---|
| Patient chat + assessment LLM | Yes |
| Prompt engine v2 | Yes |
| CFI / ERI / AVI / ALE / RRS / VQI / HCFI / PMFI / TRI / Quality Ledger | **No** (draft PRs #120–#124) |
| Research export admin API | **No** on main |
| Human PAS/LAS corpus | **No** (n=0) |
| `docs/ASSESSMENT_RELIABILITY.md` / `calibration/` / `reliability.ts` | **Missing** despite CLAUDE.md references |

Scientific excellence on **production** is therefore largely **aspirational architecture in draft**, not a live research platform.

---

## Section E — AI Quality Index (AQI)

| Dimension | Score | Notes |
|---|---:|---|
| Consistency | 58 | Snapshot helps; LLM variance remains |
| Hallucinations | 52 | Prompt constraints; no secondary filter; diagnosis leakage risk |
| Prompt robustness | 60 | Modular v2; injection residual |
| Memory | 55 | Session messages + case_memory; no PME mind on prod |
| PME behaviour | 20 | Not deployed |
| Dialogue quality | 55 | See Conversation audit |
| Clinical reasoning (patient) | 58 | Package-dependent |
| Failure recovery | 62 | Persona fallback exists; must propagate `aiSource` |
| Regression stability | 70 | CI green on main; clinical runtime regressions partial |

**AQI = 55 / 100**

---

## Section G — Scientific Excellence Index (SEI)

| Dimension | Score | Notes |
|---|---:|---|
| CFI (live) | 15 | Engine not on production |
| AVI (live) | 15 | Not on production |
| ERI (live) | 15 | Not on production |
| ALE (live) | 15 | Not on production |
| RRS (live) | 15 | Not on production |
| PMFI (live) | 10 | Not on production |
| VQI (live) | 15 | Not on production |
| Quality Ledger (live) | 10 | Migration/code not on main |
| Reproducibility | 45 | Case snapshots + versions partial on prod |
| Versioning | 50 | Prompt v2; scientific_meta incomplete vs draft stack |
| Research export | 20 | Not on production |
| Audit trail (scientific) | 40 | Security audit exists; quality ledger absent |
| Publication readiness | 25 | Explicit non-validation; no coefficients |

**SEI = 35 / 100**

### Publication gate (board)

Until PAS/LAS thresholds and reliability coefficients exist, **no peer-reviewed educational effectiveness claim** should cite VPsych scores as validated instruments.

---

## Findings

| ID | Sev | Finding | Root cause | Impact | Priority |
|---|---|---|---|---|---|
| SCI-C1 | Critical | Scientific index stack not in production | Unmerged Wave 3+ | Research ops cannot run on live | P0 |
| SCI-C2 | Critical | CLAUDE references missing reliability infrastructure | Docs/tooling drift | False confidence | P0 |
| SCI-H1 | High | Human study n=0 | Not executed | Blocks publication | P0 |
| SCI-H2 | High | Draft dashboards can look “green” structurally | Offline corpora | Misread as validity | P1 |
| SCI-M1 | Medium | Assessment formula SSOT drift vs CLAUDE | `reliability.ts` absent | Future score drift | P2 |

---

## Recommendations

| Rec | Impact | Priority |
|---|---|---|
| Either merge scientific stack with DB migration plan, or remove overclaiming docs | Integrity | P0 |
| Preregister PAS/LAS; collect data | Publication path | P0 |
| Restore or rewrite reliability docs to match tree | Hygiene | P1 |
| Ban “validated assessment” language in UI/sales | Ethics | P0 |
