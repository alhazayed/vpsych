# RC1 — Code Freeze Decision Log

**Date:** 2026-08-04  
**Vehicle:** PR #100 (`cursor/v1-release-certification-0579`)  
**Rule:** `main` is the only source of truth after #100 merges. No parallel “certification” streams.

Every open PR at freeze start was classified as exactly one of:

| Decision | Meaning |
|----------|---------|
| **Merge into v1.0** | Land via #100 (or already absorbed into #100) |
| **Move to v1.1** | Keep open; **do not merge** until after v1.0 tag |
| **Close without merging** | Obsolete, superseded, duplicate, or conflicting |

---

## Merge into v1.0

| PR | Disposition |
|----|-------------|
| **#100** | **Sole v1.0 release candidate.** Contains Critical runtime/SEO/legal fixes + cherry-picked Critical remediations from closed cert PRs (see below). |

### Absorbed into #100 (then source PRs closed)

| Source | Absorbed Critical/High items |
|--------|------------------------------|
| #71 / #73 | Middleware JSON 401 (already), TTS voice-id allowlist |
| #50 / #73 | Admin disorders/templates/presets rate limits; session-end DB error sanitization |
| #76 | Persona substance localization + `harm_to_others` + gender preserve on case snapshot |
| #99 | `CLAUDE.md` only (assessment reliability machinery → v1.1 with #99 remainder) |

**Explicitly rejected from #85:** fail-closed `messageRpcClient` / service-role-only message RPCs — that re-breaks therapist sessions when `SUPABASE_SERVICE_ROLE_KEY` is unset (conflicts with V1-C1 restore).

---

## Move to v1.1

Do **not** merge before `v1.0.0`. Rebase onto post-v1.0 `main` when scheduled.

| PR | Topic | Why deferred |
|----|-------|--------------|
| #62–#69 | CFI / ERI / AVI / ALE / RRS / VQI / Quality Ledger / Multi-ledger | Scientific platform — not required for training MVP v1.0 |
| #87 | Enterprise compliance (DSAR, consent) | Needs RC2/RC4 legal+ops readiness |
| #88 | Institutional multi-tenant | Enterprise scope beyond MVP |
| #89 | Disaster recovery / ops excellence | RC2 infrastructure |
| #91, #92, #96 | Human Conversation Engine | Post-1.0 realism stack |
| #93–#95 | Full SEO / AEO / GEO | Beyond RC1 robots/sitemap/legal baseline already in #100 |
| #97 | Brand & conversion | Marketing surface — post soft-launch |
| #99 | Assessment reliability measurement | Keep for scientific track; CLAUDE.md already in #100 |

---

## Close without merging

| PR | Reason |
|----|--------|
| #7 | Obsolete test-report artifact |
| #28, #44 | Superseded by merged security/functional #41–#45 |
| #46–#61 | Older `*-8acf` certification stream — duplicate of later work; many conflicting; Critical bits absorbed or obsolete |
| #70–#86 | `*-e57e` / cert remediations — Critical bits cherry-picked into #100 **or** duplicate of absorbed work; conflicts blocked clean merge |
| #90 | Prior “NOT APPROVED” board — superseded by #100 |
| #98 | Prior “NOT READY” launch cert — superseded by #100 freeze process |

---

## Target end-state after RC1 actions

| Metric | Target |
|--------|--------|
| Open **release-critical** PRs | **1** (#100) until merge; then **0** |
| Open **v1.1** deferred PRs | 19 (explicit list above) |
| Open obsolete/conflicting cert PRs | **0** |
| Uncertainty “what is v1.0?” | **0** — only #100 |

Stale remote **branches** are not deleted in this pass (needs repo admin / force-delete policy). After #100 merges, delete closed-PR head branches in a follow-up hygiene job.

---

## RC2–RC5 (unchanged gates — not claimed complete)

1. **RC2** — Migration git parity, env finalization, monitoring, backups  
2. **RC3** — Full browser/API/clinical/voice/security/load regression with evidence  
3. **RC4** — Analytics, Search Console, Bing, support, alert tests  
4. **RC5** — Tag `v1.0.0`, release notes, production deploy, post-launch monitoring  

**Public Version 1.0 is still blocked until RC2–RC5 pass.** RC1 only clears the PR swamp and freezes the v1.0 code line onto #100.
