# VPsych — Master Execution Plan (Programs A–F)

**Created:** 2026-08-20 (UTC) · **Baseline:** `origin/main` @ `97cf879` · **Production:** `97cf879` / `dpl_FtvXAHDh1fANk7vRR5ESkCYV8jSj`
**Companion ledger:** [`VPsych_MASTER_EXECUTION_LEDGER.md`](./VPsych_MASTER_EXECUTION_LEDGER.md)
**Governing records:** `docs/RELEASE_DECISION_LOG.md` (RDL-001…035) · `docs/RELEASE_GOVERNANCE.md`
**Context base:** `docs/VPSYCH_MASTER_CONTEXT.md`

> **Standing constraints.** Competency scores are **not validated** and must never be described as
> validated. Evidence is never fabricated — missing evidence reads **Evidence Pending**. GA is
> **NO-GO** (RDL-032/033); version stays `1.0.0-rc.1`. Engineering may enforce an adopted clinical
> rule; it may never author one.

## Epistemic markers

`VERIFIED` — demonstrated by source, DB inspection, deployment inspection, executed test, or governance record.
`INFERENCE` — strongly supported, not directly demonstrated. `UNKNOWN` — insufficient evidence. `STALE` — documentation conflicts with the system.

## Status vocabulary

`NOT STARTED` · `IN PROGRESS` · `BLOCKED` · `HUMAN DECISION REQUIRED` · `VERIFYING` · `PASSED` · `FAILED` · `SUPERSEDED`

---

## Operating facts established at baseline (all VERIFIED 2026-08-20)

| # | Fact | Evidence |
|---|---|---|
| OF-1 | `main` = `97cf879`; **production = the same SHA** | `git`; Vercel `dpl_FtvXAHDh1fANk7vRR5ESkCYV8jSj`, `target: production`, READY |
| OF-2 | **Merging to `main` auto-deploys production.** PR #203 merged → production deployment created automatically | Vercel deployment metadata `githubCommitRef: main` |
| OF-3 | Gates green on `main`: lint 0 errors/13 warnings · typecheck clean · **724 tests / 88 files** · migration structure OK · audit 0 vulnerabilities | executed locally on `97cf879` |
| OF-4 | **Git↔remote migration divergence exists** (see A4) | Supabase `list_migrations` vs `supabase/migrations/` |
| OF-5 | Live data: 5 avatars (**2 published**, 1 testing, 2 draft, 0 archived) · 12 profiles · 598 sessions (1 admin-test) · 4193 messages · 480 reports · 453 case instances · 17 disorders · 130 learner competencies · 6 quality ledgers · 5 institutions · **0 memberships** | aggregate SQL, read-only |
| OF-6 | 60 open PRs · ~190 remote branches | GitHub API |
| OF-7 | Security advisors: 17 WARN, no ERROR. Highest-risk-looking two verified **safe by design** | `get_advisors`; `pg_get_functiondef` |
| OF-8 | RDL ends at **RDL-035** (Phase 3 accepted, Phase 4 authorized, scope closed) | `docs/RELEASE_DECISION_LOG.md` |

**OF-2 is the single most consequential operating fact for this plan.** In this repository
*merge means deploy*. Every merge decision from here is simultaneously a production decision, and
§16/§17 of the governing mission separate those authorities. Therefore **no merge to `main` will be
performed under this plan without explicit per-merge authorization**, regardless of CI state.

---

# PROGRAM A — STATE RECONCILIATION

**Objective:** one authoritative current-state baseline.
**Gate:** evidence matrix complete — main SHA, production SHA, branch divergence, active vs superseded work, CI, migrations, deployment, architecture drift, documentation drift, governance status, unknowns, risks.

### A0 · Read-only inspection sweep — `PASSED`
- **Objective:** inspect repo, branches, PRs, CI, tests, migrations, deployment, governance without changing anything.
- **Verification:** commands executed; no working-tree mutation.
- **Acceptance:** every downstream milestone's inputs identified. **Met.**
- **Evidence:** ledger A0.

### A1 · Git / branch / PR reconciliation — `PASSED`
- **Findings (VERIFIED):** `main` `97cf879`; 190 remote branches; 60 open PRs.
- **Active work:** **#202** `claude/voice-integration` (voice, draft, 47 files, +6430/−249, head `901207b`, base recorded as `1a83424` — **now one merge behind**).
- **Adjacent voice work:** #187 turn-taking hardening · #186 interaction audit · #184 Arabic Speech Preparation Engine · branches `claude/vpsych-tts-migration-audit-i58v9p`, `claude/vpysych-voice-arabic-quality-uhgauw`.
- **Superseded/historical:** 19 `[v1.1]` PRs (#62–#99) under a hard pre-`v1.0.0` merge gate; Phase 3 documentation PRs #191/#196/#197/#199 (content already on `main` via #195 and later); engine mission PRs #121–#164 (excellence stacks, intentionally off `main`).
- **Acceptance:** every open PR classified active / deferred / superseded. **Met.**

### A2 · Deployment reconciliation — `PASSED`
- **Findings:** production ≡ `main` ≡ `97cf879`. Auto-deploy on merge confirmed (OF-2). Rollback candidate flag present on the current production deployment.
- **Acceptance:** exact production artifact identified and tied to a SHA. **Met.**

### A3 · Gate baseline on `main` — `PASSED`
- **Verification:** `lint` → 0 errors / 13 warnings · `typecheck` → clean · `vitest run` → **724 passed / 88 files** · `test:migrations` → local structure OK · `audit:deps` → 0 vulnerabilities.
- **Acceptance:** every gate executed and raw result recorded, not inferred. **Met.**
- **Note (VERIFIED):** `test:migrations` **skips remote parity entirely** when `SUPABASE_DB_URL` is unset. A green result therefore does *not* establish schema parity — see A4.

### A4 · Migration / schema parity vs the live project — `PASSED (divergence found)`
- **Method:** Supabase `list_migrations` on `rrzudbkxigeavfdnidnm` vs `supabase/migrations/*.sql`.
- **Findings (VERIFIED):** git **75** files · remote **74** applied.

| Direction | Version | Name | Consequence |
|---|---|---|---|
| In git, **never applied** | `20260807160000` | `scientific_validation_platform` | Duplicate of applied `20260807184247` |
| In git, **never applied** | `20260807180000` | `enterprise_platform_stage10` | Duplicate of applied `20260807184355` |
| **Applied in production, absent from git** | `20260808172816` | `avatar_lifecycle_status` | **Creates `avatars.lifecycle_status`** |

- **Confirmed against the live schema:** `avatars.lifecycle_status text NOT NULL DEFAULT 'draft'` exists in production.
- **Material consequence (VERIFIED):** the migration that creates the column on which **Phase 3B lifecycle and Phase 3C admin-test gating both depend** exists only in production. **A greenfield rebuild from git cannot reproduce the production schema.** This is a restore-integrity defect, and it is invisible to CI because the parity check is skipped without `SUPABASE_DB_URL`.
- **Provenance (VERIFIED):** the Phase 3A contract already recorded this as "version drift" — git PR #188 carries the file at version `20260808171439`; #188 is unmerged, so `main` has no such migration at any version.
- **Acceptance:** exact divergence enumerated in both directions. **Met.**
- **Remediation:** A9 — **executed 2026-08-21** (A9-EXEC); remote-only divergence now empty.

### A5 · Live data baseline — `PASSED`
- **Findings:** OF-5. Aggregate-only, PHI-free, no narrative or transcript read.
- **Notable:** only **2 avatars are `published`** (learner-visible). **1** admin-test session exists in the entire corpus.

### A6 · Security posture baseline — `PASSED`
- **Findings:** 17 advisor WARN, 0 ERROR. Sixteen are `SECURITY DEFINER` functions executable by `authenticated` — the **documented architecture**, since those RPCs enforce authorization internally.
- **Two verified rather than assumed:**
  - `purge_training_sessions_older_than(p_days)` — destructive retention RPC. **Verified safe:** internal `IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'`, a `p_days >= 30` floor, and a `log_security_event` audit write.
  - `quality_ledger_reject_mutation()` — executable by `anon`. **Verified harmless:** a trigger function whose entire body raises `'quality ledger tables are append-only'`.
- **Residual:** `auth_leaked_password_protection` **disabled** (HIBP) — pre-existing SEC-S12-01; `voice_profiles_set_updated_at` has a mutable `search_path` (low).
- **Acceptance:** no unverified security claim carried forward. **Met.**

### A7 · Documentation / governance drift register — `PASSED`
| Item | Status | Detail |
|---|---|---|
| `CLAUDE.md` counts | **Current** | corrected 2026-08-20 to 724/88, 75 migrations, ~100 tables, 7 CI steps |
| `CANONICAL_MIGRATION_LEDGER.md` | **SUPERSEDED, marked** | frozen at 54; banner added; regeneration open as ARCH-S2-07 |
| Protocol OD-11 "**five** currently published avatars" | **STALE** | production has **2** published |
| Readiness assessment corpus "583 sessions / 466 reports" | **STALE** | now 598 / 480 |
| `TECHNICAL_DEBT.md` migration count "66" | **STALE** | 75 in git, 74 applied |
| `FEATURE_INVENTORY.md` "Realtime deprecated", "61 migrations", "2 avatars" | **STALE** | point-in-time Mission Omega snapshot |
| RDL | **Current** | RDL-034/035 appended 2026-08-20 |

### A8 · Evidence matrix and risk register — `PASSED`
**Top risks carried into B–F:**

| ID | Risk | Severity | Evidence |
|---|---|---|---|
| R-A1 | ~~Git cannot rebuild production (`lifecycle_status` migration missing)~~ **— closed by A9-EXEC.** Remaining: **backups have never been restore-tested**, and no greenfield rebuild has been run | **High** (was Critical) | A4; A9-EXEC; `docs/cidp/evidence/dr/` shows no drill |
| R-A2 | **Merge ⇒ production deploy** with no staging gate | **High** | OF-2 |
| R-A3 | CI's migration gate gives false assurance without `SUPABASE_DB_URL` | High | A3/A4 |
| R-A4 | Forged `admin_test` scoring-evasion defect live in production | High (P1) | Master Context D-13 |
| R-A5 | No clinical / Arabic-clinical / psychometric reviewer identified | **Blocking for C–F** | Phase 4 register |
| R-A6 | 60 open PRs / 190 branches — canonical-work ambiguity, especially voice | Medium | A1 |
| R-A7 | HIBP disabled; no pen test; no APM | Medium | A6 |

**Remaining UNKNOWNs (not converted by reasoning):** whether the 2026-08-02 persona clinical examiner was human; whether Upstash is configured in production (env not readable from here); whether the two never-applied git migrations are idempotent under a greenfield run; the intent behind landing-page pricing and statistics.

### A9 · Migration parity remediation — `EXECUTED 2026-08-21` (was `HUMAN DECISION REQUIRED`)

**Resolved.** DP-01 options **1 + 3** were authorized ("Follow the remaining of this plan") and
executed as ledger entry **A9-EXEC**. Git-only change; **no production DDL was run**.

- `20260808172816_avatar_lifecycle_status.sql` added to git, MD5-verified against the applied
  statement (`83975ab5…`, 2270 characters). It carries **more than A4 recorded**: the CHECK
  constraint and **both `lifecycle_status ↔ is_active` trigger functions and triggers** — the
  mechanism that keeps unpublished patients out of learner view. Git previously had none of it.
- **Remote-only divergence is now empty**: 74 applied versions, all present in git.
- The parity gate no longer prints a skipped remote check as a pass; opt-in
  `VPSYCH_REQUIRE_REMOTE_PARITY=1` exits 1 (verified).
- **Option 2 judged unnecessary.** The two never-applied files are byte-identical *annotated parity
  copies* of applied migrations, and every statement in them is idempotency-guarded (verified
  statement class by statement class). This converts the A8 UNKNOWN by measurement.
- **Still not established:** no greenfield rebuild has been performed, so "git can rebuild
  production" remains INFERENCE. **R-A1's restore-test half and R-A3 both stay open.**

*Original decision framing retained below.*

### A9 (original framing) · `HUMAN DECISION REQUIRED`
- **Objective:** make git canonical with production again, per the precedent of RDL-003.
- **Why not executed:** migration-history reconciliation is a **governed act** in this repository (RDL-003 exists precisely for it), and the fix has two parts with different risk profiles.
- **Prepared options** (decision packet in the ledger):
  1. **Additive-only (recommended):** add `20260808172816_avatar_lifecycle_status.sql` to git, reconstructed from the applied statements, so a greenfield build produces `lifecycle_status`. Leaves the two never-applied duplicates in place. No production change.
  2. Option 1 **plus** removing or neutralising the two never-applied duplicate migrations — larger blast radius, changes what a greenfield run executes.
  3. Defer, and instead set `SUPABASE_DB_URL` in CI so the parity gate stops giving false assurance.
- **Not a Claude decision:** it alters migration history that the governance ledger treats as evidence.
- **Independent work that continues meanwhile:** all of Program B's engineering verification.

## PROGRAM A GATE — **PASSED**
Every required element of the evidence matrix is present and evidence-backed. The one unresolved
item (A9) is a *remediation*, not a gap in knowledge — the divergence is fully characterised.
Program B may begin.

---

# PROGRAM B — VOICE CONVERGENCE

**Objective:** resolve the active voice work safely. **Merging is not assumed.**
**Subject:** PR #202 `claude/voice-integration` @ `901207b`; adjacent #184 / #186 / #187 and two voice branches.

### B0 · Voice work inventory and canonicality map — `PASSED`
- Enumerate every branch/PR touching the voice surface; classify overlap with #202.
- **Acceptance:** each is `candidate` / `superseded-if-202-lands` / `independent`.

### B1 · Independent verification of #202's engineering claims — `PASSED`
- **Every claim reproduced exactly** on `901207b`: lint 0 errors/13 warnings · typecheck clean ·
  **908 tests / 102 files** · `test:migrations` local OK · perf smoke PASS · audit 0 · **build PASS**.
- **No discrepancy between the PR body's engineering claims and observed results.**

### B2 · Base-drift and conflict check — `PASSED`
- Merge base `1a83424`; branch is 6 ahead / 1 behind current `main`. `git merge-tree` reports
  **no textual conflicts** against `97cf879`. The one behind-commit is the docs-only #203 merge.

### B3 · Clinical-semantic integrity (text layer, EN + AR) — **`FAILED`** — blocking defect
- **Method:** executed the real `normalizeArabicSpeech` / `normalizeEnglishSpeech` against a
  clinical probe corpus. Evidence is observed output, not test assertions.
- **English: clean.** Identity on doses, dates, BP, risk language; asterisk markers stripped with
  content preserved (`I am *not* okay.` → `I am not okay.`).
- **Asterisk fix (`146eac0`) verified working** and regression-pinned in
  `speech-text/clinical-integrity.test.ts` for AR + EN negation, risk content, medication+dose,
  doubled/unbalanced markers, and byte-identity on asterisk-free text.
- **Arabic: one unguarded rule corrupts clinically material values.** Cardinal-spelling fires
  across `/`, producing:

| Input | Output | Category |
|---|---|---|
| `الجرعة 1/2 حبة` | `الجرعة واحد/اثنين حبة` | **medication dose** (half-tablet → "one/two") — *disclosed by the PR* |
| `بتاريخ 15/7` | `بتاريخ 15/سبعة` | symptom-onset date — *disclosed* |
| `بتاريخ 3/7` | `بتاريخ ثلاثة/سبعة` | symptom-onset date — *disclosed* |
| **`الضغط 120/80`** | **`الضغط 120/ثمانين`** | **vital sign — NOT disclosed in the PR** |

- **Correct behaviours confirmed:** `50 ملغ` → `خمسين ميليغرام` · `2.5 ملغ` decimal protected ·
  clock `3:30` protected · `3 أسابيع` → `ثلاثة أسابيع` · risk language identity.
- **Why this fails the gate:** the mission's own standard is that any transformation changing
  clinically relevant meaning is a failure, and medication doses and numbers are named
  preservation targets. Blood pressure was found by probing rather than reported, so the
  disclosed defect list was incomplete — the root cause is broader than documented.
- **Severity:** blocking for B. Not blocking for anything outside the voice branch — **the defect
  does not exist on `main`**, which has no speech-text layer.
- **Proposed minimal remediation (not applied — not my branch):** protect slash-delimited numeric
  pairs from cardinal spelling entirely, matching the English behaviour of leaving them as digits.
  This removes the corruption without inventing a spoken form. **What a Jordanian patient *should*
  say for `120/80` or a half-tablet dose is a native-speaker clinical judgement (OD-7/OD-18
  territory), not an engineering choice.**

### B4 · Turn-taking logic verification — `PASSED (source-invariant)`
- Dedicated suites present and green: `turn-controller.test.ts`, `turn-guard.test.ts`,
  `voice-turn-cancellation.test.ts`, `playback-cancellation.test.ts`; `src/lib/architecture.test.ts`
  extended by the branch.
- **Honest limitation, inherited from the repository:** these are source-invariant and unit-level.
  `environment: node`, `.tsx` is not unit-tested, and there is no request/component harness — so
  real turn-taking behaviour in a browser remains **unverified by automation** and is part of B6/B7.

### B5 · QA instrumentation security review — `PASSED`
- Gate `NEXT_PUBLIC_VOICE_QA` with `qa-isolation.test.ts` covering `""`, `false`, `1`, `yes`, `true`.
- **No sink:** no `supabase`, `fetch`, `localStorage`, `sessionStorage`, `IndexedDB`, or
  `sendBeacon` call anywhere in `src/lib/voice/qa/` outside comments — retention is an in-memory
  ring buffer for the tab lifetime.
- **No identifiers:** no `sessionId` / `avatarId` / `userId` / `therapistId` in the non-test sources.
- Panel renders nothing unless the gate is true; the chunk is lazily imported.

### B6 · Human **English** voice QA — `HUMAN DECISION REQUIRED`
### B7 · Human **Arabic** (Levantine/Jordanian) voice QA — `HUMAN DECISION REQUIRED`
- Listening evaluation cannot be performed by inspection. Protocol: `docs/VOICE_SPEECH_EVALUATION.md`.
- **Never to be simulated or inferred.**

### B8 · Canonical-branch decision — `HUMAN DECISION REQUIRED`
- #202's own review note defers this to the branch owner.

### B9 · Merge + deploy decision — `HUMAN DECISION REQUIRED`
- Under OF-2, merging #202 deploys the voice stack to production in one action.

## PROGRAM B GATE — **BLOCKED**
| Requirement | State |
|---|---|
| Full engineering verification reproduced | **MET** (B1) |
| No unresolved clinical-semantic corruption | **NOT MET** — B3 Arabic slash rule |
| Recorded human EN voice QA | **NOT MET** — B6 |
| Recorded human AR voice QA | **NOT MET** — B7 |
| Blocking defects resolved | **NOT MET** — B3 |

**Program B decision: `REWORK REQUIRED`.** The engineering is sound and independently reproduced;
one clinical-semantic defect class must be closed, and the two human QA milestones cannot be
satisfied by inspection at all. Human listening results have not been invented.

---

# PROGRAM C — GOVERNANCE ACTIVATION

**Objective:** establish the minimum authority required before Program D may legitimately build.

### C0 · Re-derive the live open-decision set — `PASSED 2026-08-21`
Every decision resting on a checkable factual premise was re-measured against production. Full
evidence in ledger entry **C0**. **27 decisions remain open; none was closed** — re-deriving a
premise decides nothing.

| Premise | Verdict |
|---|---|
| OD-11 "five currently published avatars" | **STALE** — 5 avatars *total*: 2 published, 2 draft, 1 testing. The register conflated total with published; the deadline governs **2**. |
| OD-25 corpus "583 sessions / 466 reports / 130 competency rows" | **STALE in two of three** — now **598 / 480 / 130**. |
| OD-8 "17 declared, 11 have packages" | **CURRENT, exact** — 17 DB rows vs 11 slugs in `case-engine/catalog.ts`. The six: `asd`, `eating-disorders`, `ocd`, `pdd`, `schizoaffective`, `social-anxiety`. |
| OD-27 forged `admin_test` | **CURRENT — live and unremediated.** Live sessions INSERT policy is `WITH CHECK (therapist_id = (SELECT auth.uid()))`; nothing constrains `clinical_snapshot`. Detected and audited at end, then **403 before the assessment pipeline** — so the session stays permanently unassessed. |
| OD-13 / OD-20 / OD-21 / OD-25 appointments | **CURRENT — all UNFILLED.** RDL ends at RDL-036 with no appointment row. |

**New gap surfaced, unowned:** OD-8 tracks the 6 disorders missing from the code catalog. It does
not track that **12 of 17** DB rows carry only a 6-key stub package — no `differentials`,
`rule_outs`, `teaching_points`, or `common_therapist_mistakes`; only **5** carry the full 9-key
teaching schema. Different sets, different axes. Referred to the CGL (OD-26 territory);
**engineering must not decide what a disorder package must contain.**

### C1 · Appoint the Clinical Governance Lead (OD-13) — `HUMAN DECISION REQUIRED` — **root blocker**
### C2 · Adopt / reject / amend `VP-CLIN-PROTOCOL v1.0-draft` (OD-1, incl. DEF-1) — `HUMAN DECISION REQUIRED`
### C3 · Define clinically material version scope (OD-14) — `HUMAN DECISION REQUIRED` — gates D1
### C4 · Forged `admin_test` remediation shape (OD-27) — `HUMAN DECISION REQUIRED` (engineering may prepare options; F-5 wording must be resolved in writing first)
### C5 · Reviewer qualifications · pass thresholds · adjudication · publication authority (OD-16/17/22/24) — `HUMAN DECISION REQUIRED`
### C6 · Clinical safety incident procedure (OD-15) — `HUMAN DECISION REQUIRED`
### C7 · Appoint Educational + Psychometric reviewers (OD-20/21) — `HUMAN DECISION REQUIRED`
### C8 · Authorize corpus analysis (OD-25) — `HUMAN DECISION REQUIRED`
### C9 · Legal positions (OD-9/10) — `HUMAN DECISION REQUIRED` — **must not be guessed**

## PROGRAM C GATE
Passes only when the required records **exist in the RDL** with a named authority. A drafted memo is not approval.

---

# PROGRAM D — VALIDATION INFRASTRUCTURE

**Blocked on C.** Build **only** what adopted governance authorizes.

### D1 · Deterministic clinically-material content version (P0-2) — `BLOCKED` (needs C3)
### D2 · Immutable approval↔version linkage — `BLOCKED` (needs C3, C5)
### D3 · Clinical review state + reviewer provenance + timestamps — `BLOCKED` (needs C1, C5)
### D4 · Publication sign-off gate (`testing → published` precondition) — `BLOCKED` (needs C5)
### D5 · Stale-approval invalidation on material change — `BLOCKED` (needs C3)
### D6 · Clinical coherence rules — `BLOCKED` (needs C2 + the D1 checklist authored by the CGL, OD-26). **Engineering must not author the clinical rule.**
### D7 · Forged `admin_test` remediation — `BLOCKED` (needs C4)
### D8 · Evidence package generation — `BLOCKED` (needs C2, and OD-2 retention)
### D9 · Security review of D1–D8 — `BLOCKED`
- Threat model fixed in advance: publication bypass · forged reviewer identity · stale approval after edit · version collision/non-determinism · authorization and RLS bypass · service-role misuse · audit omission · review/edit race · superseded-approval reactivation · replay · cross-locale confusion.

## PROGRAM D GATE
Evidence required for: tests · types · build · migration integrity · authorization · RLS · version determinism · stale-approval invalidation · auditability · rollback. Code written ≠ program complete.

---

# PROGRAM E — CLINICAL / VOICE VALIDATION PILOT

**Blocked on C and D.** Requires real, qualified, named human reviewers — none identified.

### E0 · Sentinel case selection bound to fixed content versions — `BLOCKED`
### E1 · Clinical fidelity / diagnostic coherence / behavioural consistency / realism — `BLOCKED`
### E2 · Safety battery (non-compensatory) — `BLOCKED`
### E3 · Arabic clinical quality — **independent re-run, never a delta review** — `BLOCKED`
### E4 · Voice intelligibility / naturalness / clinical-semantic speech integrity — `BLOCKED`
### E5 · Educational usefulness — rated separately from realism — `BLOCKED`

## PROGRAM E GATE
Only against **predefined, approved** thresholds. No post-hoc thresholds. No averaging away a critical safety failure. Report what the pilot demonstrates, suggests, leaves unknown, and cannot support.

---

# PROGRAM F — ASSESSMENT RELIABILITY AND VALIDITY

### F0 · Inventory the instrument as built — `PASSED`

**Instrument (VERIFIED from source):** 11 dimensions, each `max: 5`, weights summing to 100 —
`risk_formulation` 12 · `dsm_reasoning` 11 · `icd_reasoning` 11 · `alliance` 10 ·
`clinical_formulation` 10 · `differential_diagnosis` 10 · `assessment` 8 ·
`educational_competency` 8 · `interventions` 8 · `safety` 8 · `structure` 4.
`weightedOverall()` = Σ (score/max × 100 × weight/Σweight), rounded. Weights are
**hand-assigned with no documented derivation.**

**Three measurement constraints found, each material to F1–F5:**

| # | Finding | Evidence | Consequence |
|---|---|---|---|
| **F0-1** | **No behavioural anchors.** The rating model receives only `id — label` per dimension (`rubricLines = rubric.map(r => \`${r.id} — ${r.label}\`)`). Nothing defines what a 0, 3, or 5 looks like. | `assessment.ts` prompt assembly | Unanchored 0–5 scales are a classic source of rater drift and low inter-rater agreement. Any IRR result will be hard to attribute between instrument and rater. |
| **F0-2** | **Scoring is non-deterministic.** `temperature: 0.3` on the examiner call. | `openAIService.chat({ temperature: 0.3 })` | The same transcript can score differently between runs. Test–retest on stored data measures *nothing* about this; it needs deliberate re-runs. |
| **F0-3** *(corrected — see F0-C1)* | **Provenance is partial, not absent.** Of **480** reports, **46 (9.6%)** carry a complete `scientific_provenance` block — `ai_model`, `ai_source`, `prompt_engine_version` all populated — starting **2026-08-06**. The remaining **434** pre-date provenance and record nothing. Within the 46: **1 distinct model, 1 distinct prompt version.** | aggregate SQL over `session_reports` | **A clean, configuration-homogeneous sub-corpus of 46 reports exists.** The 434 older reports are unusable for configuration-controlled analysis. |

**What F0-3 means for Program F.** Provenance capture is **already implemented and working** —
`buildAssessmentProvenance({ aiSource, model })` and both index wrappers receive the real model on
the LLM path, and every report written since 2026-08-06 carries it. The constraint is therefore
about *history*, not about missing machinery:

- **Usable for configuration-controlled analysis: 46 reports**, homogeneous in model and prompt
  version. Small, but enough for internal consistency (11 items × 46 subjects) — a legitimate
  Tier 1 analysis rather than nothing.
- **Not usable: the 434 reports before 2026-08-06.** Model, provider, and prompt version are
  unrecorded, and coarse recovery via `created_at` → deployment history → SHA cannot recover the
  provider or model, which are env-driven and not in git.
- Protocol **Rule 12.7.2** stays retrospectively unevaluable for the pre-2026-08-06 majority, but
  **is evaluable going forward**.

**Effect on the plan:** F1 needs only the *runner*, not new provenance capture — see PLAN CHANGE 003.

### F1 · Reliability harness (C-5 / CI-S05) — `PASSED`
- Shipped: `src/lib/assessment-reliability/` + `calibration/` + `docs/ASSESSMENT_RELIABILITY.md`
  + `npm run test:reliability`. All gates green; **743 tests / 90 files** (was 724 / 88).
- Synthetic calibration run recovers the deliberately noisy dimension — a test of the harness,
  not a finding about VPsych.
- No migration, no schema change, no runtime path touched, no production corpus access.
- **Scope fixed by PLAN CHANGE 003 — build the runner only.** The statistical primitives already
  exist and are tested on `main`: `src/lib/scientific/psychometrics.ts` exports `cronbachAlpha`,
  `pearson`, `itemTotalDiscrimination`, `summarizePsychometrics`, covered by
  `scientific-validation.test.ts`. Provenance capture also already exists.
- **What is genuinely missing:** the runner (`test:reliability`), a stored-report → item-matrix
  adapter, and `docs/ASSESSMENT_RELIABILITY.md`.
- **Constraints:** must **not** fork `weightedOverall` (guardrail-enforced for the Education and
  Supervisor layers; the same discipline applies here). Must run against **synthetic fixtures** —
  executing it against the production corpus is F2 and stays blocked on OD-21 + OD-25.
- **Flag resolved 2026-08-21.** Both `F-FIND-1` (simulated inter-rater emitted unflagged) and
  `F-FIND-2` (degenerate discrimination metric) were **fixed** under product-owner authorization.
  The simulator is retained for genuine simulation studies but can no longer reach a report, and
  discrimination now uses a corrected rest-score correlation. Forward-only: stored reports keep
  their historical simulated values, so the harness's exclusion is permanent.
### F2 · Retrospective corpus analysis (Tier 1) — `BLOCKED` (needs OD-21 psychometrician + OD-25 authorization)
- The harness is ready and the extraction layer already enforces aggregate-only, PHI-free access.
- Usable configuration-controlled sub-sample: **46 reports** (F0-3).
### F3 · Blinded expert re-rating → inter-rater reliability — `BLOCKED`
### F4 · Fairness / EN-vs-AR bias analysis — `BLOCKED`
### F5 · Claim-ladder determination — `BLOCKED`

**Claim ladder.** L0 formative AI feedback · L1 repeatable internal educational signal · L2 reproducible performance measure · L3 externally validated competence measure.
**Current supportable claim: L0.** Nothing on `main` supports L1 or above. F0 shows L1 is
**reachable in principle** — 46 configuration-homogeneous reports exist — but not yet evidenced,
and 46 subjects is a thin basis that a psychometrician, not engineering, must judge.

## PROGRAM F GATE
Passes only when evidence suffices for the *specific* intended claim; otherwise report the highest supportable lower claim. Never tune scoring to produce attractive statistics.

---

## Plan change log

*(Append every material change as: PLAN CHANGE / Original / New / Reason / Evidence / Effect on downstream programs.)*

**PLAN CHANGE 003** — 2026-08-20 · **supersedes PLAN CHANGE 002**
- **Original (002):** F1 must add forward provenance capture.
- **New:** F1 builds the runner only. Provenance capture already exists and has worked since
  2026-08-06; the statistical primitives already exist and are tested.
- **Reason:** PLAN CHANGE 002 rested on a measurement error (F0-C1) and would have duplicated
  working code — the exact failure §19 exists to prevent.
- **Evidence:** `buildAssessmentProvenance` call sites pass the real `model`; 46/46 reports since
  2026-08-06 carry `ai_model`, `ai_source`, `prompt_engine_version`.
- **Effect downstream:** F1 shrinks substantially and touches no runtime path — in particular it no
  longer touches the HMAC-signed report payload.

**PLAN CHANGE 002 — WITHDRAWN** (superseded by 003; retained for traceability)

**PLAN CHANGE 001** — 2026-08-20
- **Original:** F1 = build the reliability harness.
- **New:** F1 = build the harness **and** add forward provenance capture to the report write path.
- **Reason:** F0-3 — 0 of 480 reports record the model that produced them, so every additional
  report deepens a confound that cannot be fixed retrospectively.
- **Evidence:** aggregate SQL: 480 reports, 46 with provenance, 0 with `model_version`.
- **Effect downstream:** F2's design must caveat all pre-fix data; F5's claim ladder cannot reach
  L1 on the existing corpus alone.

**PLAN CHANGE 001** — 2026-08-20
- **Original:** the mission brief implies merge decisions are ordinary engineering steps.
- **New:** every merge to `main` is treated as a production-deployment decision requiring explicit per-merge authorization.
- **Reason:** OF-2 — merging PR #203 auto-deployed production.
- **Evidence:** Vercel `dpl_FtvXAHDh1fANk7vRR5ESkCYV8jSj`, `target: production`, `githubCommitRef: main`.
- **Effect downstream:** B9 and any D-program merge become authorization gates, not engineering gates.
