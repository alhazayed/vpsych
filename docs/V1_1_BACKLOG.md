# VPsych v1.1 Backlog Registry

**Milestone:** `v1.1` (canonical tracker — create matching GitHub milestone when API access allows)  
**Rule:** Nothing deferred from RC1 may remain an ambiguous open PR.  
**Owner (product):** Aladdin Zayed (`alhazayed`)  
**Status vocabulary:** `Deferred` · `Ready for rebase` · `In progress` · `Blocked` · `Merged to v1.1`  
**Hard gate:** Do **not** merge any row below into `main` before tag `v1.0.0`.

After `v1.0.0`, each PR must be rebased onto `main` and re-reviewed before merge.

---

## Registry (19 PRs)

| PR | Title (normalized) | Theme | Status | Owner | Deferred because |
|----|--------------------|-------|--------|-------|------------------|
| [#62](https://github.com/alhazayed/vpsych/pull/62) | `[v1.1] CFI — Clinical Fidelity Index` | Scientific | Deferred | alhazayed | Scientific scoring platform; not required for training MVP cut |
| [#63](https://github.com/alhazayed/vpsych/pull/63) | `[v1.1] ERI — Educational Reliability Index` | Scientific | Deferred | alhazayed | CBME reliability metric; depends on stable assessment baseline |
| [#64](https://github.com/alhazayed/vpsych/pull/64) | `[v1.1] AVI — Assessment Validity Index` | Scientific | Deferred | alhazayed | Psychometric validity work; post soft-launch |
| [#65](https://github.com/alhazayed/vpsych/pull/65) | `[v1.1] ALE — Adaptive Learning Effectiveness` | Scientific | Deferred | alhazayed | Effectiveness metric; ACE already ships in v1.0 without ALE |
| [#66](https://github.com/alhazayed/vpsych/pull/66) | `[v1.1] RRS — Research Readiness Score` | Scientific | Deferred | alhazayed | Research claims must wait for reproducibility package |
| [#67](https://github.com/alhazayed/vpsych/pull/67) | `[v1.1] VQI — VPsych Quality Index` | Scientific | Deferred | alhazayed | Hierarchical master metric; depends on #62–#66 |
| [#68](https://github.com/alhazayed/vpsych/pull/68) | `[v1.1] Quality Ledger engine` | Scientific | Deferred | alhazayed | Immutable ledger; enterprise/research scope |
| [#69](https://github.com/alhazayed/vpsych/pull/69) | `[v1.1] Multi-Ledger platform` | Scientific / Enterprise | Deferred | alhazayed | Large platform expansion; depends on #68 |
| [#87](https://github.com/alhazayed/vpsych/pull/87) | `[v1.1] Enterprise compliance (DSAR/consent)` | Compliance | Deferred | alhazayed | Needs RC2 retention jobs + RC4 legal/consent ops |
| [#88](https://github.com/alhazayed/vpsych/pull/88) | `[v1.1] Institutional multi-tenant` | Enterprise | Deferred | alhazayed | Multi-org tenancy beyond single-tenant MVP |
| [#89](https://github.com/alhazayed/vpsych/pull/89) | `[v1.1] Disaster recovery & ops excellence` | Infrastructure | Deferred | alhazayed | Fold essential checks into RC2; full DR playbook is v1.1 |
| [#91](https://github.com/alhazayed/vpsych/pull/91) | `[v1.1] HCE orchestration pipeline` | AI / HCE | Deferred | alhazayed | Realism stack; v1.0 ships current voice/AI pipeline |
| [#92](https://github.com/alhazayed/vpsych/pull/92) | `[v1.1] HCE architecture plan (docs)` | AI / HCE | Deferred | alhazayed | Design docs accompany #91/#96 |
| [#93](https://github.com/alhazayed/vpsych/pull/93) | `[v1.1] Full Technical SEO suite` | Launch / SEO | Deferred | alhazayed | RC1 already ships robots/sitemap/legal; full suite post soft-launch |
| [#94](https://github.com/alhazayed/vpsych/pull/94) | `[v1.1] AEO certification` | Launch / AEO | Deferred | alhazayed | AI-engine discoverability after public indexability proven |
| [#95](https://github.com/alhazayed/vpsych/pull/95) | `[v1.1] GEO certification` | Launch / GEO | Deferred | alhazayed | Generative-engine optimization after AEO baseline |
| [#96](https://github.com/alhazayed/vpsych/pull/96) | `[v1.1] HCE Phases A–D` | AI / HCE | Deferred | alhazayed | Full realism stack; supersedes/extends #91 |
| [#97](https://github.com/alhazayed/vpsych/pull/97) | `[v1.1] Brand & conversion` | Marketing | Deferred | alhazayed | Conversion surfaces after core product stable in production |
| [#99](https://github.com/alhazayed/vpsych/pull/99) | `[v1.1] Assessment reliability measurement` | Scientific | Deferred | alhazayed | Reliability machinery deferred; `CLAUDE.md` already in #100 |

---

## Dependency order (suggested for post-v1.0)

1. **HCE:** #92 → #91 → #96  
2. **Scientific:** #62 → #63 → #64 → #65 → #66 → #67 → #68 → #69 (+ #99 in parallel with assessment work)  
3. **Enterprise:** #87 → #88 (after RC2 retention/ops foundations)  
4. **Launch discoverability:** #93 → #94 → #95 → #97  
5. **Ops playbook:** #89 (after RC2 monitoring/backups proven)

---

## GitHub milestone / labels (manual one-time — agent API is 403)

Run as a repo admin (not available to the cloud agent token):

```bash
gh milestone create "v1.1" --description "Post-v1.0.0 deferred work. Do not merge before tag v1.0.0."
gh label create "v1.1" --description "Deferred until after v1.0.0" --color "5319E7"
gh label create "status:deferred" --description "Explicitly deferred; not abandoned" --color "FBCA04"

for n in 62 63 64 65 66 67 68 69 87 88 89 91 92 93 94 95 96 97 99; do
  gh pr edit "$n" --add-label "v1.1,status:deferred" --milestone "v1.1"
done
```

PR titles are updated by the RC agent to include `[v1.1]` regardless.

---

## Exit criteria for “nothing simply remains open”

A deferred PR is **compliant** when all are true:

1. Title starts with `[v1.1]`  
2. Listed in this registry with Status / Owner / Deferred because  
3. Comment on the PR points here and forbids pre-`v1.0.0` merge  
4. (When admin script run) GitHub milestone `v1.1` + labels applied  

Until (4), this file is the **source of truth**.
