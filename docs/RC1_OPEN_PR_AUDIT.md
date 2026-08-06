# RC1 Open PR Audit & Categorization

**Date (UTC):** 2026-08-06  
**Open PRs audited:** 48 (all Draft at audit time)  
**Baseline for RC1:** `main` @ `d4c4fae` · production `dpl_Dpdpoy…`  
**Rule:** No application behavior changes for Professional Preview packaging.

Categories:

- **Merge immediately** — docs/governance needed on `main` for RC1 freeze  
- **Required for RC1** — must be on baseline before inviting experts (already on `main` unless noted)  
- **Future roadmap** — keep open; do not merge during preview  
- **Experimental** — excellence / research platforms; hold until after expert review  
- **Close as obsolete** — superseded by merged Wave remediations or earlier RDL outcomes  

---

## A. Merge immediately (docs only)

| PR | Title | Recommendation |
|---|---|---|
| **This PR** | RC1 Professional Preview package | **Merge** after review |
| [#135](https://github.com/alhazayed/vpsych/pull/135) | W3-H5 closeout / Wave 3 PASSED (RDL-024) | **Merge** (or already absorbed into this PR’s docs). Closes Wave 3 evidence on `main`. |

No product code in these merges.

---

## B. Required for RC1 — already on production / `main`

These are **not** open merges; they define the certified baseline:

| Item | Status |
|---|---|
| Wave 2 remediations | Merged `#114` → `5aae138` |
| Wave 3 remediations | Merged `#131` → `1e44dce` |
| Migration parity file | Merged `#133` → `d4c4fae` |
| Quality Ledger migration applied | Prod `20260805214500` |
| Valid Production `ELEVENLABS_API_KEY` | Ops completed; TTS 200 |

**Do not re-merge** superseded open drafts of the same work (#120, #128).

---

## C. Future roadmap — keep open, do not merge during preview

| PR | Title | Theme |
|---|---|---|
| #62–#69 | `[v1.1]` CFI/ERI/AVI/ALE/RRS/VQI/Quality Ledger/Multi-Ledger | Scientific platform (largely **superseded in schema** by Wave 3 consolidated migration — treat as historical forks; rebase only if still unique) |
| #87 | Enterprise compliance (DSAR/consent) | Compliance |
| #88 | Institutional multi-tenant | Enterprise |
| #89 | Disaster recovery & ops | Infrastructure |
| #91–#92, #96 | HCE pipeline / plan / Phases A–D | Conversation realism roadmap |
| #93–#95, #97 | SEO / AEO / GEO / brand | Launch marketing |
| #99 | Assessment reliability measurement | Scientific |

Tracked in `docs/V1_1_BACKLOG.md`. Hard gate: do not merge before a tagged public `v1.0.0` without Board waiver.

**Note on #62–#68:** Wave 3 already shipped Quality Ledger + index tables via `20260805214500`. Prefer **Close as obsolete** for duplicate engine PRs unless they contain unique non-merged value after rebase review.

---

## D. Experimental — remain open until after expert review

| PR | Title | Why hold |
|---|---|---|
| #121 | Mission 20 HCTF | Excellence fidelity stack |
| #122 | Mission 21 PME | Patient Mind Engine — large behavior change |
| #123 | Mission 22 CVHAP | Validation framework |
| #124 | TRE + TRI | Therapy Response Engine |
| #125 | VEA observational audit | Docs/audit only — may merge later as docs |
| #126 | CQI platform | Continuous quality intelligence |
| #127 | EOI platform | Educational opportunity intelligence |
| #129 | CVL Mission 100 | Clinical Validation Laboratory |

Expert preview should judge the **certified Wave 3 baseline**, not experimental mind/therapy engines.

---

## E. Close as obsolete (certification / remediation supersession)

| PR | Reason |
|---|---|
| #101 | RC2 freeze docs — historical |
| #102 | Missions 1–30 refuse — historical |
| #104–#109 | RC3-C2 / Wave 1 STOP or gate docs — superseded by later PASS RDLs |
| #110 | Wave 1 cert + W1-C1 — migration/file landed via later path; cert historical |
| #111, #113, #115–#117 | Wave 2 FAIL / drift docs — superseded by RDL-019 PASS |
| #118 | Wave 2 PASS cert docs — keep as archive or merge docs-only later; not required for RC1 code |
| #119 | Wave 3 FAIL cert — superseded by RDL-024 |
| #120 | Wave 3 educational remediation — **superseded by #131** |
| #128 | Wave 3 completion — **superseded by #131** |
| #130 | Wave 3 FINAL NOT READY — superseded by RDL-024 |
| #134 | Post-deploy NOT READY (H5 open) — superseded by #135 / RDL-024 |

Closing these reduces PR noise; evidence remains in git history and RDL.

---

## F. Summary counts (48 open)

| Category | Approx. count | Action |
|---|---:|---|
| Merge immediately | 1–2 | Merge docs PRs |
| Required (already on baseline) | — | Freeze `main` @ `d4c4fae` |
| Future roadmap | ~19 | Keep open / `[v1.1]` |
| Experimental | ~8 | Hold post-review |
| Close as obsolete | ~20+ | Close with “superseded by Wave 3 / RDL-024” |

---

## G. Recommendation to Executive Board

1. Merge **RC1 docs PR** (+ #135 if not included).  
2. Tag **`rc1-pp-1.0-baseline`** at `d4c4fae`.  
3. Invite experts against production baseline; collect feedback via Feedback Guide.  
4. **Do not** merge experimental excellence PRs until after the preview debrief.  
5. Batch-close obsolete Wave 1–3 draft PRs for hygiene.  
6. Unlock Wave 4 only when Board authorizes (Wave 3 PASSED).
