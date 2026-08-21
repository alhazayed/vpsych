# VPsych — Master Execution Ledger

**Append-only record of what actually happened.** Companion to
[`VPsych_MASTER_EXECUTION_PLAN.md`](./VPsych_MASTER_EXECUTION_PLAN.md).

Rules: one entry per milestone attempt · record raw outcomes, not intentions · a milestone is
`PASSED` only when its acceptance criteria were demonstrated · corrections are new entries.

---

## A0 · Read-only inspection sweep

```
Milestone:            A0
Program:              A — State reconciliation
Status:               PASSED
Started:              2026-08-20T22:00Z
Completed:            2026-08-20T22:12Z
Source SHA:           97cf879 (origin/main)
Resulting SHA:        97cf879 (no change)
Changes:              none — read-only
Tests executed:       none (inspection only)
Test results:         n/a
Deployment tested:    none
Production affected:  NO
Evidence:             git fetch/branch/rev-list; GitHub list_pull_requests (60 open);
                      Vercel list_deployments; Supabase list_projects / list_migrations /
                      information_schema / pg_proc reads; local file inspection
Human review required: no
Human decision:       n/a
Unresolved risks:     none for this milestone
Next allowed:         A1
```

## A1 · Git / branch / PR reconciliation

```
Milestone:            A1
Status:               PASSED
Source SHA:           97cf879
Changes:              none
Evidence:             main = 97cf879; 190 remote branches; 60 open PRs.
                      Active voice work = PR #202 claude/voice-integration @ 901207b
                        (draft, 47 files, +6430/-249, 6 commits, base recorded 1a83424).
                      Adjacent voice: #187, #186, #184 + branches
                        claude/vpsych-tts-migration-audit-i58v9p,
                        claude/vpysych-voice-arabic-quality-uhgauw.
                      Deferred: 19 [v1.1] PRs (#62-#99), hard-gated pre-v1.0.0.
                      Superseded doc PRs: #191, #196, #197, #199 (content on main).
                      Excellence engine PRs #121-#164: intentionally off main.
Production affected:  NO
Unresolved risks:     R-A6 canonical-work ambiguity on the voice surface
Next allowed:         A2
```

## A2 · Deployment reconciliation

```
Milestone:            A2
Status:               PASSED
Evidence:             Production deployment dpl_FtvXAHDh1fANk7vRR5ESkCYV8jSj,
                      target=production, state=READY, githubCommitSha=97cf879,
                      githubCommitRef=main, isRollbackCandidate=true.
                      => production ≡ main ≡ 97cf879.
KEY FINDING (OF-2):   Merging PR #203 to main created a production deployment with no
                      separate promotion step. In this repository MERGE MEANS DEPLOY.
Production affected:  NO (observation only; the deploy was caused by the earlier merge)
Unresolved risks:     R-A2 no staging gate between merge and production
Next allowed:         A3
```

## A3 · Gate baseline on main

```
Milestone:            A3
Status:               PASSED
Source SHA:           97cf879
Tests executed:       npm run lint · npm run typecheck · npx vitest run ·
                      npm run test:migrations · npm run audit:deps
Test results:         lint            PASS  0 errors / 13 warnings
                      typecheck       PASS  clean
                      vitest          PASS  724 passed / 88 files / 15.76s
                      test:migrations PASS  local structure OK
                                            REMOTE PARITY SKIPPED (SUPABASE_DB_URL unset)
                      audit:deps      PASS  0 vulnerabilities
Production affected:  NO
Unresolved risks:     R-A3 — a green migration gate does NOT establish schema parity
Next allowed:         A4
```

## A4 · Migration / schema parity vs the live project

```
Milestone:            A4
Status:               PASSED (divergence found and characterised)
Evidence:             Supabase list_migrations (rrzudbkxigeavfdnidnm): 74 applied.
                      git supabase/migrations/*.sql: 75 files.
                      IN GIT, NEVER APPLIED:
                        20260807160000_scientific_validation_platform.sql
                        20260807180000_enterprise_platform_stage10.sql
                        (duplicates of applied 20260807184247 / 20260807184355)
                      APPLIED IN PRODUCTION, ABSENT FROM GIT:
                        20260808172816  avatar_lifecycle_status
                      Live schema confirms:
                        avatars.lifecycle_status text NOT NULL DEFAULT 'draft'
MATERIAL CONSEQUENCE: The migration creating the column that Phase 3B lifecycle and Phase 3C
                      admin-test gating both depend on exists ONLY in production. A greenfield
                      rebuild from git cannot reproduce the production schema. CI cannot see
                      this because the parity check is skipped without SUPABASE_DB_URL.
Production affected:  NO (read-only)
Unresolved risks:     R-A1 (Critical) — git cannot rebuild production AND backups have never
                      been restore-tested
Next allowed:         A5 · remediation deferred to A9
```

## A5 · Live data baseline

```
Milestone:            A5
Status:               PASSED
Evidence (aggregate only, PHI-free, no narrative/transcript read):
                      avatars 5 — published 2 · testing 1 · draft 2 · archived 0
                      profiles 12 · sessions 598 (admin_test 1) · session_messages 4193
                      session_reports 480 · case_instances 453 · disorders 17
                      learner_competencies 130 · quality_ledgers 6
                      institutions 5 · institution_memberships 0
Notable:              Only 2 avatars are learner-visible. Governance text referring to
                      "the five currently published avatars" (OD-11) is STALE.
Production affected:  NO
Next allowed:         A6
```

## A6 · Security posture baseline

```
Milestone:            A6
Status:               PASSED
Evidence:             get_advisors(security) — 17 WARN, 0 ERROR.
                      16 are SECURITY DEFINER functions executable by `authenticated`,
                      which is the documented architecture (RPCs enforce authz internally).
                      VERIFIED RATHER THAN ASSUMED:
                        purge_training_sessions_older_than(p_days) — destructive retention
                          RPC. Body contains:
                          IF auth.uid() IS NULL OR NOT public.is_admin()
                            THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
                          plus p_days >= 30 floor and log_security_event audit write.
                          => NOT a vulnerability.
                        quality_ledger_reject_mutation() — executable by anon; body raises
                          'quality ledger tables are append-only' and nothing else.
                          => NOT a vulnerability.
Residual:             auth_leaked_password_protection DISABLED (HIBP, SEC-S12-01)
                      voice_profiles_set_updated_at has mutable search_path (low)
Production affected:  NO
Next allowed:         A7
```

## A7 · Documentation / governance drift register

```
Milestone:            A7
Status:               PASSED
Evidence:             CLAUDE.md counts CURRENT (corrected 2026-08-20)
                      CANONICAL_MIGRATION_LEDGER.md SUPERSEDED and marked
                      OD-11 "five currently published avatars" STALE (actual: 2)
                      Readiness assessment "583 sessions / 466 reports" STALE (598 / 480)
                      TECHNICAL_DEBT.md "66 migrations" STALE (75 git / 74 applied)
                      FEATURE_INVENTORY.md Realtime/migrations/avatars rows STALE
                      RDL CURRENT through RDL-035
Production affected:  NO
Next allowed:         A8
```

## A8 · Evidence matrix and risk register

```
Milestone:            A8
Status:               PASSED
Evidence:             Plan §"Operating facts" (OF-1..OF-8) and §A8 risk table R-A1..R-A7.
Unresolved UNKNOWNs recorded without conversion:
                      - persona clinical examiner: human or AI (UNKNOWN)
                      - Upstash configured in production (UNKNOWN — env not readable here)
                      - idempotency of the two never-applied git migrations (UNKNOWN)
                      - intent behind landing-page pricing/statistics (UNKNOWN)
Production affected:  NO
Next allowed:         A9 (blocked) → Program B
```

## A9 · Migration parity remediation

```
Milestone:            A9
Status:               HUMAN DECISION REQUIRED — superseded by A9-EXEC (2026-08-21), below
Source SHA:           97cf879
Changes:              NONE — prepared only
Production affected:  NO
Human decision:       RESOLVED — DP-01 option 1 + 3 authorized; executed as A9-EXEC
Next allowed:         Program B proceeds independently
```

---

## B0 · Voice work inventory and canonicality map

```
Milestone:            B0
Program:              B — Voice convergence
Status:               PASSED
Source SHA:           901207b (origin/claude/voice-integration)
Changes:              none — read-only
Evidence:             Candidate: PR #202 @ 901207b — 6 commits, 47 files, +6430/-249.
                        f911893 speech-text layer + turn controller + segmented TTS
                        5815eac one patient response per therapist turn
                        146eac0 asterisk normalization no longer deletes content
                        05ba740 barge-in cancels the whole in-flight turn
                        1c70c5c therapist may take the floor mid-turn
                        901207b dev-only Voice QA instrumentation
                      Overlapping, canonicality NOT decided by Claude: #184, #186, #187,
                        claude/vpsych-tts-migration-audit-i58v9p,
                        claude/vpysych-voice-arabic-quality-uhgauw
Production affected:  NO
Human decision:       B8 — which voice line is canonical (branch owner's call, per #202 itself)
Next allowed:         B1
```

## B1 · Independent verification of #202's engineering claims

```
Milestone:            B1
Status:               PASSED
Source SHA:           901207b
Tests executed:       lint · typecheck · vitest · test:migrations · test:perf-smoke ·
                      audit:deps · build
Test results:         lint            PASS  0 errors / 13 warnings (same set as main)
                      typecheck       PASS  clean
                      vitest          PASS  908 passed / 102 files
                      test:migrations PASS  local structure (remote parity skipped)
                      perf-smoke      PASS  latency budgets + TTS timeout markers intact
                      audit:deps      PASS  0 vulnerabilities
                      build           PASS
Comparison to claim:  PR body claimed 908 tests / 102 files and all gates passing.
                      EVERY CLAIM REPRODUCED EXACTLY. No discrepancy.
Deployment tested:    none
Production affected:  NO
Next allowed:         B2
```

## B2 · Base-drift and conflict check

```
Milestone:            B2
Status:               PASSED
Evidence:             merge-base = 1a83424; branch 6 ahead / 1 behind origin/main (97cf879).
                      git merge-tree against current main: no textual conflicts.
                      The single behind-commit is the docs-only #203 merge.
Production affected:  NO
Next allowed:         B3
```

## B3 · Clinical-semantic integrity (EN + AR)

```
Milestone:            B3
Status:               FAILED — blocking clinical-semantic defect
Source SHA:           901207b
Method:               Executed the real normalizeArabicSpeech / normalizeEnglishSpeech against a
                      clinical probe corpus and recorded OBSERVED OUTPUT (not test assertions).
                      Probe file was removed after the run; no branch modification.

ENGLISH — CLEAN
  "I am *not* okay."            => "I am not okay."          markers stripped, content intact
  "The dose is 1/2 tablet."     => identity
  "I take sertraline 50 mg."    => identity
  "Since 15/7."                 => identity
  "Blood pressure 120/80."      => identity
  risk language                 => identity

ARABIC — CORRECT BEHAVIOURS
  "أنا *مش* مبسوط."              => "أنا مش مبسوط."          negation preserved (146eac0 works)
  risk language                 => identity
  "آخد سيرترالين 50 ملغ يومياً."  => "خمسين ميليغرام"          correct expansion
  "الجرعة 2.5 ملغ."              => decimal protected, unit expanded
  "الساعة 3:30."                 => protected
  "من 3 أسابيع."                 => "ثلاثة أسابيع"            correct

ARABIC — DEFECT: cardinal spelling fires across "/" on clinically material values
  "الجرعة 1/2 حبة."   => "الجرعة واحد/اثنين حبة."   MEDICATION DOSE   (disclosed in PR)
  "بتاريخ 15/7."      => "بتاريخ 15/سبعة."          ONSET DATE        (disclosed in PR)
  "بتاريخ 3/7."       => "بتاريخ ثلاثة/سبعة."       ONSET DATE        (disclosed in PR)
  "الضغط 120/80."     => "الضغط 120/ثمانين."        VITAL SIGN        *** NOT DISCLOSED ***

Assessment:           One unguarded rule, at least three clinically material categories. The PR
                      disclosed two of them; blood pressure was found by probing. The disclosed
                      defect list was therefore incomplete — the root cause is broader than the
                      documentation states. Tests in src/lib/voice/qa/number-corpus.test.ts PIN
                      the defective output (characterization tests, not failing tests), which is
                      why the suite is green.
Regression cover verified for the asterisk fix:
                      speech-text/clinical-integrity.test.ts covers AR + EN negation, risk
                      content, medication name + dose, doubled/unbalanced markers, byte-identity
                      on asterisk-free text, and mixed-script.
Scope of impact:      Voice branch ONLY. main has no speech-text layer, so production is not
                      affected by this defect.
Repair attempted:     NO — deliberately. This is not my branch (authorization for
                      claude/voice-integration was explicitly withheld from this session), and
                      the correct spoken form for a Jordanian patient saying "120/80" or a
                      half-tablet dose is a native-speaker clinical judgement (OD-7 / OD-18),
                      not an engineering choice.
Proposed remediation: Protect slash-delimited numeric pairs from cardinal spelling entirely,
                      matching the English behaviour of leaving them as digits. Removes the
                      corruption without inventing a spoken form.
Production affected:  NO
Human decision:       DP-03
Next allowed:         B4, B5 (independent); B6-B9 remain blocked
```

## B4 · Turn-taking logic verification

```
Milestone:            B4
Status:               PASSED (source-invariant only)
Evidence:             turn-controller.test.ts · turn-guard.test.ts ·
                      voice-turn-cancellation.test.ts · playback-cancellation.test.ts all green
                      within the 908-test run; src/lib/architecture.test.ts extended by the branch.
Honest limitation:    Source-invariant and unit-level. vitest runs environment:node, .tsx files
                      are not unit-tested, and the repository has no request/component harness.
                      Real browser turn-taking behaviour is NOT verified by automation and
                      remains part of B6/B7.
Production affected:  NO
Next allowed:         B5
```

## B5 · QA instrumentation security review

```
Milestone:            B5
Status:               PASSED
Evidence:             Gate NEXT_PUBLIC_VOICE_QA; qa-isolation.test.ts covers "", "false", "1",
                      "yes", "true".
                      NO SINK: no supabase / fetch / localStorage / sessionStorage / IndexedDB /
                      sendBeacon call anywhere in src/lib/voice/qa/ outside comments. Retention
                      is an in-memory ring buffer for the browser tab lifetime.
                      NO IDENTIFIERS: no sessionId / avatarId / userId / therapistId in the
                      non-test sources.
                      Panel renders nothing unless the gate is true; chunk is lazily imported.
Production affected:  NO
Next allowed:         B6 (blocked — human)
```

## B6-B9 · Human QA and merge decisions

```
Milestones:           B6 (human EN voice QA) · B7 (human AR voice QA) ·
                      B8 (canonical branch) · B9 (merge + deploy)
Status:               HUMAN DECISION REQUIRED
Changes:              none
Evidence:             Not obtainable by inspection. No TTS listening was performed and none is
                      claimed. docs/VOICE_SPEECH_EVALUATION.md exists on the branch and defines
                      the protocol.
Production affected:  NO
Human decision:       DP-03
```

## PROGRAM B REVIEW

```
1. Intended:          Resolve the active voice work safely.
2. Achieved:          Engineering claims independently reproduced; conflict-free against current
                      main; asterisk clinical-safety fix verified and regression-pinned; QA
                      instrumentation verified non-persisting and identifier-free; one blocking
                      Arabic clinical-semantic defect class characterised, including a category
                      the PR did not disclose.
3. Evidence:          Ledger B0-B5; executed gates; observed normalizer output.
4. Unverified:        All real-audio behaviour. Browser turn-taking. Arabic naturalness,
                      pronunciation, prosody, dialect fidelity.
5. Failed:            B3.
6. Deferred:          B6-B9 (human authority).
7. Scope creep:       None. No branch modified; probe file removed after use.
8. Security/privacy:  Preserved. QA instrumentation reviewed; no production data touched.
9. Clinical boundary: Preserved. No spoken-form judgement invented for Arabic.
10. Gate passes?      NO.

VERDICT: PROGRAM BLOCKED
Program B decision: REWORK REQUIRED
```

---

## F0 · Instrument inventory

```
Milestone:            F0
Program:              F — Assessment reliability and validity
Status:               PASSED
Source SHA:           97cf879
Changes:              none — read-only source inspection + aggregate/structural SQL.
                      NO Tier 1 analysis performed: OD-25 corpus authorization does not exist.
                      No narrative, transcript, or per-learner score was read or exported.
Evidence:             INSTRUMENT
                        11 dimensions, max 5 each, weights summing to 100:
                        risk_formulation 12 · dsm_reasoning 11 · icd_reasoning 11 ·
                        alliance 10 · clinical_formulation 10 · differential_diagnosis 10 ·
                        assessment 8 · educational_competency 8 · interventions 8 ·
                        safety 8 · structure 4
                        weightedOverall = Σ (score/max × 100 × weight/Σweight), rounded
                        Weights hand-assigned, no documented derivation.

                      F0-1 NO BEHAVIOURAL ANCHORS
                        The examiner model receives only "id — label" per dimension.
                        Nothing defines what 0 / 3 / 5 means.

                      F0-2 NON-DETERMINISTIC SCORING
                        temperature: 0.3 on the examiner call. Same transcript may score
                        differently between runs.

                      F0-3 SCORE PROVENANCE EFFECTIVELY ABSENT
                        session_reports columns: id, session_id, scores, narrative,
                        excerpts, created_at, language — no model/provider/prompt column.
                        Of 480 reports (2026-07-30 → 2026-08-20):
                          scientific_provenance present   46  (9.6%)
                          assessment_schema_version       46  (9.6%)
                          model_version non-null           0  (0.0%)

Correction recorded: An initial reading of the table columns suggested no provenance existed
                      at all. Structural inspection of the scores jsonb showed a
                      scientific_provenance block does exist for a minority of reports. The
                      finding was corrected before being recorded: provenance exists but is
                      sparse, and model_version is null in every single report.

Consequence:          The corpus cannot be stratified by model, provider, or prompt version.
                      Default model, provider path and prompt engine all changed inside the
                      collection window (Stages 6-12). Tier 1 estimates would carry an
                      unmeasured confound that cannot be removed retrospectively. Protocol
                      Rule 12.7.2 is retrospectively unevaluable. Partial recovery via
                      created_at → deployment history → SHA is coarse; provider/model are
                      env-driven and env history is not in git.
Production affected:  NO
Human review required: no for F0; yes for F2 (OD-21 + OD-25)
Next allowed:         F1 (scope revised by PLAN CHANGE 002)
```

---

## F0-C1 · CORRECTION to F0-3

```
Milestone:            F0-C1 (correction; references F0)
Program:              F
Status:               PASSED
Source SHA:           97cf879
Changes:              none — correction of a recorded finding

WHAT WAS RECORDED (WRONG):
  "0 of 480 reports carry a model_version" → concluded that the model producing every
  score is unrecorded and the corpus cannot be stratified at all.

WHY IT WAS WRONG:
  The query probed scores#>>'{scientific_provenance,model_version}'. That key does not
  exist. The actual key is 'ai_model'. The query returned a true zero for a key nobody
  writes, and I read it as absence of provenance.

WHAT IS ACTUALLY TRUE (re-measured):
  reports_total              480
  has_provenance              46   (9.6%)
  has ai_model                46   (all of them)
  has ai_source               46
  has prompt_engine_version   46
  provenance begins    2026-08-06
  distinct models              1
  distinct prompt versions     1

  Provenance keys actually written: ace_engine_version · ai_model · ai_source ·
  assessed_at · assessment_mode · assessment_schema_version · case_snapshot_version ·
  cge_engine_version · prompt_engine_version · rubric_schema_version ·
  scientific_limitations

CORRECTED CONCLUSION:
  Provenance capture is implemented and working. buildAssessmentProvenance({aiSource,
  model}) receives the real model on the LLM path. The constraint is historical: the
  434 reports written before 2026-08-06 have no provenance; the 46 written since have
  complete provenance and are homogeneous in model and prompt version.
  => A clean, configuration-controlled sub-corpus of 46 reports EXISTS. That is a
  materially better position than F0-3 originally stated, and it makes an internal
  consistency analysis (11 items x 46 subjects) a legitimate Tier 1 target.

KNOCK-ON:
  PLAN CHANGE 002 (add forward provenance capture to F1) rested on this error and is
  WITHDRAWN, superseded by PLAN CHANGE 003. Acting on it would have duplicated working
  code and touched the HMAC-signed report payload for no reason.

Production affected:  NO
Next allowed:         F1 (runner only)
```

## F1 · Reliability harness — scope determined

```
Milestone:            F1
Status:               NOT STARTED (scope fixed, work not begun)
Evidence — ALREADY ON MAIN, must be reused not rebuilt:
                      src/lib/scientific/psychometrics.ts exports mean, variance, stddev,
                      cronbachAlpha, pearson, itemTotalDiscrimination,
                      summarizePsychometrics; covered by scientific-validation.test.ts.
                      src/lib/eri/ provides ERI aggregation and confidenceInterval.
                      Version constants exist in src/lib/scientific/versions.ts.
Genuinely missing:    the runner (test:reliability), a stored-report → item-matrix adapter,
                      and docs/ASSESSMENT_RELIABILITY.md.
Constraints:          must NOT fork weightedOverall (architecture.test.ts enforces this for
                      the Education and Supervisor layers; same discipline applies).
                      Must run against synthetic fixtures — running it against the
                      production corpus is F2, blocked on OD-21 + OD-25.
Flag raised:          src/lib/eri/engine.ts exports simulateInterRaterAgreement(). A
                      SIMULATED agreement figure must never be presented as reliability
                      evidence. Whether it surfaces in any admin view should be checked
                      before F2.
Production affected:  NO
```

---

## F-FIND-1 · Simulated inter-rater agreement is emitted unflagged

```
Milestone:            F-FIND-1 (finding raised during F1 scoping)
Program:              F
Status:               PASSED (finding characterised; NOT remediated)
Source SHA:           97cf879
Changes:              none

WHAT IT DOES
  src/lib/eri/from-assessment.ts:52
    const irr = simulateInterRaterAgreement(scores01to5, 0.45, opts.seed ?? 42)
  ...:87
    inter_rater_r: irr.r,
    inter_rater_pct_agree: irr.pct_agree,

  A second rater is SIMULATED by adding gaussian noise (sd 0.45, fixed seed 42) to the
  single AI rating, then correlating the result with itself. There is one rater. The
  "agreement" is manufactured from the same scores.

  src/lib/eri/weights.ts weights `inter_rater_agreement` at 0.06 of the composite
  Educational Reliability Index, which is attached to every report at
  scores.educational_reliability.

WHAT IS DISCLOSED
  - engine.ts docstring: "Simulate a second rater with controlled noise"
  - weights.ts rationale: "Simulated dual-rater agreement approximates scoring stability"
  So this is labelled in source. It is not concealed by its authors.

WHAT IS NOT DISCLOSED
  - The emitted field is named `inter_rater_r` with no simulated/synthetic flag.
  - It sits beside test_retest_r, cronbach_alpha and inter_session_r, ALL of which are
    honestly null when unmeasured. A consumer reading the JSON sees one populated
    "reliability" number among nulls with nothing marking it synthetic.
  - scientific_limitations does not mention it. It says only "LLM examiner scores
    require human OSCE co-validation before high-stakes claims".

BLAST RADIUS (traced, VERIFIED)
  - /api/admin/ops/cidp passes inter_rater_agreement: 0 — hardcoded, does NOT consume it.
  - phase14-evidence / phase16-dashboards accept inter_rater_reliability as an input, but
    NO CALLER SUPPLIES IT — it is undefined, so the GA gates do not consume it either.
  => The simulated value does not currently reach any dashboard or GA gate.

WHY IT STILL MATTERS
  Program F draws its evidence from exactly where this value lives: session_reports.scores.
  A Tier 1 analysis that naively reads inter_rater_r would report a manufactured number as
  measured reliability. That is the single most consequential misreading available in this
  corpus.

REMEDIATION (proposed, NOT implemented)
  1. Flag it in the payload (e.g. inter_rater_simulated: true) and/or add an explicit
     scientific_limitations line naming it.
  2. Binding on F1 regardless: the harness MUST exclude inter_rater_r from any reliability
     computation and compute Cronbach's alpha from the item scores directly.
  Not implemented here: changing emitted report content is outside the RDL-035 scope
  (C-9, C-2/P0-1, C-3, C-1, C-5, P0-2) and touches the HMAC-signed payload.

Production affected:  NO
Human decision:       Added to DP-04
Next allowed:         F1 (with the exclusion constraint above)
```

---

## F-FIND-2 · itemTotalDiscrimination is degenerate and inflates AVI

```
Milestone:            F-FIND-2 (finding raised during F1 construction)
Program:              F
Status:               PASSED (characterised; shared helper NOT modified)
Source SHA:           97cf879
Changes:              none to the shared helper; the F1 harness avoids it by construction

WHAT IT DOES
  src/lib/scientific/psychometrics.ts
    itemTotalDiscrimination(itemsMatrix, totals)
      = pearson(itemsMatrix.map(row => mean(row)), totals)

  cronbachAlpha documents the matrix as rows = subjects, cols = items. In that
  orientation itemsMatrix.map(row => mean(row)) is the per-subject MEAN, and totals
  are the per-subject TOTALS. total = k x mean, so the correlation is 1 by
  construction. It is not an item statistic under any orientation — it never varies
  by item.

VERIFIED EMPIRICALLY (probe, removed after use):
  6 subjects x 4 items, varied scores
    cronbachAlpha        = 0.925      (correct, behaves sensibly)
    discrimination_index = 1          (exactly 1)
    vs unrelated totals  = -0.637     (only differs when totals are unrelated to the items)

BLAST RADIUS (traced)
  src/lib/avi/corpus.ts:193  summarizePsychometrics({overalls, itemMatrix, retest})
  src/lib/avi/corpus.ts:244  discrimination_index: psy.discrimination_index
  src/lib/avi/engine.ts:106-109
      if (input.discrimination_index >= 0.3) score += 20;
      else if (>= 0.15) score += 10;
      else recs.push("Low item-total discrimination — revise weak items")

  => The Assessment Validity Index awards its FULL +20 discrimination band on a metric
     that cannot fail. The "revise weak items" recommendation is unreachable.
     Same family as F-FIND-1: a psychometric output that reads as evidence and is not.

  Exposure today is limited — the AVI corpus path is a simulation/corpus path and the
  scientific score tables are largely empty — but the defect is in the scoring logic,
  not in the data.

WHY THE SHARED HELPER WAS NOT FIXED HERE
  psychometrics.ts is consumed by avi/, eri/, validation/psychometric-engine and
  scientific/outcomes-simulate. Changing it changes those outputs. That is a
  behaviour change outside the RDL-035 scope and outside milestone F1, and §15
  forbids bundling unrelated fixes. Raised as DP-04 instead.

WHAT F1 DID INSTEAD
  src/lib/assessment-reliability/reliability.ts computes a CORRECTED item-total
  correlation — each item against the sum of the OTHER items — and does not import
  itemTotalDiscrimination. A test asserts |r| < 1 for every item, which the degenerate
  form could never satisfy.

Production affected:  NO
Human decision:       DP-04
```

## F1 · Assessment reliability harness

```
Milestone:            F1
Program:              F
Status:               PASSED
Source SHA:           97cf879 (branch base)
Changes:              src/lib/assessment-reliability/{types,reliability,extract,index}.ts
                      src/lib/assessment-reliability/{reliability,calibration}.test.ts
                      calibration/synthetic-corpus.json · calibration/README.md
                      docs/ASSESSMENT_RELIABILITY.md
                      package.json  + "test:reliability": "vitest run src/lib/assessment-reliability"
                      CLAUDE.md     harness section updated (was "not shipped on main yet")
Migration:            NONE   Schema: UNCHANGED   RLS: UNCHANGED   Runtime paths: UNCHANGED

Tests executed:       lint · typecheck · vitest (full) · test:migrations · test:perf-smoke ·
                      audit:deps · build · test:reliability
Test results:         lint             PASS  0 errors / 13 warnings (unchanged set)
                      typecheck        PASS
                      vitest           PASS  743 tests / 90 files  (was 724 / 88; +19, +2)
                      test:migrations  PASS  local structure
                      perf-smoke       PASS
                      audit:deps       PASS  0 vulnerabilities
                      build            PASS
                      test:reliability PASS  19 tests

Calibration run (SYNTHETIC, 60 subjects, homogeneous configuration):
                      cronbach alpha 0.95 · overall mean 45.15 (sd 17.48)
                      weakest item: structure  corrected r 0.468, alpha-if-dropped 0.955
                      => the harness recovered the dimension the fixture was built to
                         make noisy. That is a test of the harness, not a finding about
                         VPsych.

Design decisions, each defensive:
  - overall is READ from the stored report, never recomputed; weightedOverall is not forked
  - corrected item-total correlation, not the degenerate shared helper (F-FIND-2)
  - inter_rater_r never read (F-FIND-1); asserted absent from extracted subjects by test
  - missing dimensions excluded, never zero-filled
  - extraction reads ONLY numeric structure + provenance — no narrative, no excerpts, so
    no transcript content can leave the admin boundary through this path (risk R-5)
  - blocking[] returns null alpha instead of a number when the sample cannot support one
  - limitations[] is ALWAYS non-empty; three entries are unconditional

CI:                   deliberately NOT added as a separate CI step. `npm test` already runs
                      these files, so a separate step would duplicate work for no coverage.
                      test:reliability is the focused entry point.

Scope NOT taken:      no run against the production corpus (that is F2, blocked on OD-21 +
                      OD-25); no change to psychometrics.ts, eri/, or avi/; no change to the
                      report write path or the HMAC-signed payload.
Production affected:  NO
Human review required: no for F1; yes for F2
Next allowed:         F2 (BLOCKED on OD-21 + OD-25)
```

---

## F-FIND-1-FIX / F-FIND-2-FIX · DP-04 resolved by the product owner

```
Milestone:            F-FIND-1-FIX, F-FIND-2-FIX
Program:              F
Status:               PASSED
Authorization:        Product owner instruction ("fix F-FIND-2 and the simulated IRR"),
                      2026-08-21. This resolves DP-04. NOTE: it is a change to emitted
                      scientific-index values and was NOT inside the scope RDL-035 closed
                      (C-9, C-2/P0-1, C-3, C-1, C-5, P0-2) — an RDL row is RECOMMENDED to
                      record the scope extension. Not written unilaterally.

FIX 1 — F-FIND-2  src/lib/scientific/psychometrics.ts
  Before: itemTotalDiscrimination(matrix, totals)
            = pearson(matrix.map(row => mean(row)), totals)
          Since total = k x mean, this returned exactly 1 for any input.
  After:  itemTotalDiscrimination(matrix)
            per item: pearson(item column, sum of the OTHER items)  [rest-score]
            then the mean across items.
          Signature lost the now-meaningless `totals` argument; the only caller
          (summarizePsychometrics) was updated.

  MEASURED EFFECT (6x4 coherent matrix):
            OLD 1.0        -> AVI discrimination band +20
            NEW 0.9045     -> AVI discrimination band +20
          The band outcome is UNCHANGED on coherent data, and that is correct. The
          fix is not that AVI scores lower; it is that the metric can now VARY AND
          FAIL. Previously it was structurally incapable of falling below the 0.3
          threshold for any input, so the "revise weak items" recommendation was
          unreachable. A discordant item now measurably lowers it (asserted by test).

FIX 2 — F-FIND-1  src/lib/eri/from-assessment.ts
  Before: irr = simulateInterRaterAgreement(scores01to5, 0.45, seed ?? 42)
          emitted as inter_rater_r / inter_rater_pct_agree on every report.
  After:  inter_rater_r:        opts.inter_rater_r ?? null
          inter_rater_pct_agree: opts.inter_rater_pct_agree ?? null
          The simulator import is removed. Inter-rater is now null unless a real
          second rater supplies a value — identical to how test_retest_r,
          cronbach_alpha and inter_session_r were already handled in this module.

  ERI needed no weight-matrix change: scoreInterRater() already handles a null
  input, returning a neutral dimension (score 50, confidence 40, evidence
  ["simulation_unavailable"]). The 0.06 weight stays; the dimension now reports
  honestly that no inter-rater data exists.

  src/lib/eri/corpus.ts (an explicitly simulated corpus) also stopped requesting
  it. A noise-perturbed copy of one rating is not agreement between raters in a
  simulation any more than in production, so one rule now holds everywhere.

  simulateInterRaterAgreement() itself is KEPT and still tested — it is a legitimate
  utility for genuine simulation studies. What changed is that it can no longer
  reach a report.

GUARDRAILS ADDED (src/lib/architecture.test.ts)
  - eri/from-assessment.ts must not mention simulateInterRaterAgreement, and must
    pass inter-rater values through from opts.
  - ai/assessment.ts must not mention it either.
  - psychometrics.ts must not contain pearson(itemMeans, totals) and must use
    restScores.

REGRESSION COVER (src/lib/scientific/psychometrics.test.ts, new)
  discrimination is not 1 · is high-but-sub-1 on coherent items · drops on a
  discordant item · returns null when the matrix cannot support it · returns null
  when every item is constant · alpha unchanged.

IMPORTANT LIMIT — THE FIX IS FORWARD-ONLY
  Stored reports are not rewritten. The 46 reports carrying
  scores.educational_reliability still contain the simulated inter_rater_r. That is
  precisely why the F1 harness excludes the field when reading stored reports, and
  why that exclusion is permanent rather than transitional.

Tests executed:       lint · typecheck · vitest · test:migrations · test:perf-smoke ·
                      test:reliability · audit:deps · build
Test results:         lint             PASS  0 errors / 13 warnings (unchanged set)
                      typecheck        PASS  (caught a stale `seed` call site in
                                              eri/corpus.ts before it shipped)
                      vitest           PASS  753 tests / 91 files (was 743 / 90)
                      test:migrations  PASS
                      perf-smoke       PASS
                      test:reliability PASS  19 tests
                      audit:deps       PASS  0 vulnerabilities
                      build            PASS
Migration:            NONE   Schema: UNCHANGED   RLS: UNCHANGED
Stored data:          UNCHANGED (forward-only)
Production affected:  NO (not deployed by this change)
Next allowed:         F2 still BLOCKED on OD-21 + OD-25
```

---

## MERGE-01 · PR #204 merged to main and auto-deployed to production

```
Milestone:            MERGE-01 (release event, not a program milestone)
Status:               PASSED
Authorization:        Product owner instruction "merge it", 2026-08-21, given after the
                      merge-means-deploy consequence (OF-2) had been stated in this session
                      and in the PR body itself. Treated as informed authorization for BOTH
                      the merge and the production deployment it necessarily causes.

PRE-MERGE VERIFICATION (per governing mission §16)
  CI on head 385f264   verify = success (run 352); 12/12 runs green on the branch
  Review threads       none
  mergeable_state      clean
  Diff scope           19 files, +8576/-25, confined to
                         docs/ · src/lib/ · calibration/ · package.json · CLAUDE.md
                       NO supabase/ or .sql file touched
                       NO src/app/ route or src/components/ file touched
                       => no migration, no schema, no RLS, no runtime request path

MERGE
  Method               squash (repo convention — #200, #201, #203 are squash commits)
  Resulting SHA        696575e  on main
  Confirmed on main    src/lib/assessment-reliability/ present; RDL-036 present

PRODUCTION DEPLOYMENT (automatic, per OF-2)
  Deployment           dpl_CX9X67WUzXtJagjQZavZDpqW76cb
  Target               production
  Commit               696575e
  Aliases              vpsych-alhazayed-1540s-projects.vercel.app
                       vpsych-git-main-alhazayed-1540s-projects.vercel.app
  State                READY at 2026-08-21T07:24:36Z (build 48s); aliasError: null
  Aliased to           vpsych.vercel.app  (production domain)

POST-DEPLOY VERIFICATION (live, via Vercel fetch — the session proxy blocks the host)
  GET /api/health      200 OK
                       {"ok":true,"service":"vpsych","version":"1.0.0-rc.1",
                        "certId":"VPSYCH-1.0-RC1-STAGE12"}
  Version on prod      1.0.0-rc.1 — UNCHANGED, as intended
  Security headers     intact on the live response: CSP with the documented connect-src
                       allow-list, HSTS max-age 63072000 preload, COOP same-origin,
                       CORP same-site, Permissions-Policy, X-Frame-Options DENY,
                       X-Content-Type-Options nosniff
  API cache posture    cache-control: no-store on /api/* — as documented

WHAT REACHED PRODUCTION
  Behavioural change is confined to two scientific-index computations authorized by
  RDL-036:
    - ERI no longer emits a simulated inter_rater_r; the dimension now reports
      simulation_unavailable and scores neutrally.
    - itemTotalDiscrimination returns a corrected rest-score correlation instead of
      exactly 1, so the AVI discrimination band can now vary and fail.
  Everything else is additive: a new read-only library, a synthetic fixture, an npm
  script, docs, and governance rows.

WHAT DID NOT CHANGE
  Stored data (no report rewritten) · schema · RLS · migrations · session lifecycle ·
  assessment scoring formula (weightedOverall untouched) · report confidentiality ·
  admin-test isolation · locale separation · auth boundaries.

CLAIMS UNCHANGED
  Competency scores remain NOT validated. GA remains NO-GO (RDL-032/033). Version
  remains 1.0.0-rc.1. Highest supportable assessment claim remains L0.

Production affected:  YES — first production-affecting action taken in this programme.
Rollback             `696575e` is preceded by `97cf879`, which remains a Vercel rollback
                      candidate; no migration was applied, so rollback is deploy-only and
                      requires no data action.
Next allowed:         A9 / DP-01 remain open. F2 still BLOCKED on OD-21 + OD-25.
```

---

# DECISION PACKETS

## DP-01 · Migration parity remediation (milestone A9) — **RESOLVED 2026-08-21**

**Outcome:** options **1 + 3** authorized and executed — see **A9-EXEC** at the end of this
ledger. Option 2 was left untaken; the idempotency question that gated it is now answered, and
the answer makes option 2 unnecessary. *Original packet retained below for traceability.*

### DP-01 (original)

**Decision required:** how to restore git↔production migration parity.

**Why this is not Claude's call:** migration history is treated as governance evidence in this
repository — RDL-003 exists specifically to record a prior reconciliation. Rewriting or extending
that history changes what a future restore executes and what a future audit reads.

**The problem, precisely:** production applied `20260808172816_avatar_lifecycle_status`, which
creates `avatars.lifecycle_status`. No migration in git creates that column at any version. Phase
3B lifecycle and Phase 3C admin-test gating both depend on it. Git additionally carries two
migrations that were never applied (`20260807160000`, `20260807180000`), duplicating applied ones.

**Options:**

| # | Action | Risk | Effect |
|---|---|---|---|
| **1 (recommended)** | Add `20260808172816_avatar_lifecycle_status.sql` to git, reconstructed from the applied statements. Leave the two duplicates alone. | Low — additive, no production change | A greenfield build produces `lifecycle_status`. Parity gap closes in the direction that matters for restore. |
| 2 | Option 1 **plus** removing/neutralising the two never-applied duplicates | Medium — changes what a greenfield run executes; idempotency currently UNKNOWN | Full symmetry between git and production |
| 3 | Defer the file work; instead set `SUPABASE_DB_URL` in CI | Low | Stops the false assurance, but git still cannot rebuild production |

**Recommendation:** **1 + 3.** Option 1 closes the restore-integrity hole; option 3 stops CI from
reporting parity it never checked. Option 2 should wait until the duplicates' idempotency is tested.

**What continues regardless:** all Program B engineering verification.

---

## DP-02 · Program C — governance authority (milestones C1–C9)

**Decision required:** the appointments and adoptions listed in Program C, rooted at **OD-13,
appoint a Clinical Governance Lead.**

**Why Claude cannot legitimately make these:** they allocate clinical and organizational authority,
set clinical pass criteria, and determine legal exposure. Engineering can enforce an adopted rule;
authoring one converts an engineer's assumption into enforced clinical policy — the precise failure
the validation protocol exists to prevent.

**Minimum unblock set for Program D:** OD-13 (CGL) → OD-1 (adopt protocol) → OD-14 (clinically
material version scope). Three decisions; the third gates the design of P0-2.

**Startable without the CGL:** OD-21 (psychometrician) + OD-25 (corpus authorization) → Program F
Tier 1, against the existing 598-session / 480-report corpus.

**What continues regardless:** Program B engineering verification; F0 instrument inventory.


---

## DP-03 · Program B — voice convergence (milestones B3, B6–B9)

**Decisions required, in order:**

1. **B3 remediation.** Approve the minimal fix — protect slash-delimited numeric pairs from Arabic
   cardinal spelling — or direct a different approach. **Who fixes it:** authorization for
   `claude/voice-integration` was explicitly withheld from this session, so the patch is proposed,
   not pushed. The defect affects the voice branch only; **production is unaffected**.
2. **B6 / B7 human voice QA.** Real EN and Levantine-Arabic listening evaluation against generated
   audio. Cannot be inspected, inferred, or simulated. Protocol: `docs/VOICE_SPEECH_EVALUATION.md`.
   Arabic must cover naturalness, clinical terminology, pronunciation, numbers, medication names,
   pauses, interruption, prosody, and end-of-turn detection.
3. **B8 canonical branch.** #202 vs #184 / #186 / #187 and the two voice branches. #202's own
   review note defers this to the branch owner.
4. **B9 merge.** **Under OF-2, merging #202 deploys the voice stack to production in one action**
   — there is no staging step. Merge authorization and deployment authorization are the same
   decision here, and neither has been given.

**Why Claude cannot close these:** (2) requires human hearing; (3) is an ownership call; (4) is a
production-deployment authority; and the *linguistically correct* Arabic spoken form in (1) is a
native-speaker clinical judgement reserved to OD-7 / OD-18.

**What continues regardless:** Program F0 (instrument inventory, read-only). *(A9 was pending DP-01
at the time this packet was written; DP-01 is now resolved and A9 executed — see A9-EXEC.)*


---

## DP-04 · Simulated inter-rater agreement + degenerate discrimination — **RESOLVED 2026-08-21**

**Decision taken by the product owner:** fix both. Implemented and verified — see
F-FIND-1-FIX / F-FIND-2-FIX above. **Scope extension recorded as RDL-036** (2026-08-21), so the
governance ledger now carries the authorization rather than the commit message alone.

*Original packet retained below for traceability.*

### DP-04 (original) · Simulated inter-rater agreement (finding F-FIND-1)

**Decision required:** whether to flag the simulated inter-rater figure in the emitted report
payload, and whether it should remain a weighted component of the Educational Reliability Index.

**Why it needs you:** it changes emitted report content, which is part of the HMAC-signed
`create_session_report` payload, and it is outside the scope RDL-035 closed. Whether a simulated
figure may legitimately contribute 6% of a published "reliability" index is also a measurement
policy question, not an engineering one — it belongs with the psychometric authority (OD-21).

**Not urgent in production:** traced and confirmed that the value reaches no dashboard and no GA
gate today.

**Second item now folded into this packet (F-FIND-2):** `itemTotalDiscrimination()` in
`lib/scientific/psychometrics.ts` returns ≈1 by construction and awards the Assessment Validity
Index its full +20 discrimination band on a metric that cannot fail. Fixing it changes the output
of `avi/`, `eri/`, `validation/psychometric-engine` and `scientific/outcomes-simulate`, so it is a
behaviour change outside RDL-035 scope. The F1 harness sidesteps it; the shared helper is
untouched and still wrong.

**Urgent for Program F:** F2 would read this field. F1 will exclude it by construction, and that
constraint is recorded so it cannot be quietly lost.

---

## A9-EXEC · Migration parity remediation — **EXECUTED 2026-08-21**

```
Milestone:            A9-EXEC (executes A9 under DP-01 option 1 + 3)
Program:              A — Ground truth
Status:               PASSED
Source SHA:           1f3ffc2 (branch claude/vpsych-master-consolidation-kpwgk9)
Authorization:        Product owner, "Follow the remaining of this plan" (2026-08-21).
                      DP-01 recommended 1 + 3; option 2 NOT taken.
Production affected:  NO — git-only change. No DDL was executed against production;
                      no migration was applied, re-applied, or repaired remotely.
```

### Change 1 — reconstruct the missing migration

`supabase/migrations/20260808172816_avatar_lifecycle_status.sql` **added to git**, reconstructed
verbatim from the statements recorded in production's `supabase_migrations.schema_migrations`.

**Byte-fidelity VERIFIED, not assumed:**

| Check | Result |
|---|---|
| MD5 of git file vs applied statement | `83975ab5d2e053d36749b938c184c7fd` — **match** |
| Length | **2270 characters** — match (an earlier "MISMATCH" was my own bytes-vs-characters error: the file's three `→` are 3 bytes each, so 2276 bytes = 2270 characters) |

**The migration is materially larger than A4 recorded.** A4 characterised it as the migration that
creates `avatars.lifecycle_status`. It also carries, and git had none of:

- the `avatars_lifecycle_status_check` CHECK constraint (`draft|testing|published|archived`);
- `sync_avatar_is_active_from_lifecycle()` + trigger `avatars_lifecycle_is_active_sync`;
- `sync_avatar_lifecycle_from_is_active()` + trigger `avatars_is_active_lifecycle_sync`.

Those two triggers **are** the `lifecycle_status ↔ is_active` synchronisation that keeps therapists
from seeing unpublished patients. A greenfield rebuild from git would previously have produced a
schema in which publication state silently stopped gating learner visibility. Confirmed present in
production: `lifecycle_triggers = 2`.

### Change 2 — the parity gate can no longer report a pass it did not check

`scripts/verify-migration-parity.mjs`: the single line
`"Skipping remote parity (SUPABASE_DB_URL unset). Local structure OK."` is replaced by two separate
statements — local structure OK, **and** `REMOTE PARITY NOT CHECKED` — plus an explicit note that
this does not establish that git can rebuild the deployed schema. Adds opt-in strict mode
`VPSYCH_REQUIRE_REMOTE_PARITY=1`, which fails when parity was never verified.

**Strict-mode exit behaviour VERIFIED** (a first attempt was inconclusive because `$?` captured a
piped `tail` rather than the script):

```
node scripts/verify-migration-parity.mjs                              → DEFAULT_EXIT=0
VPSYCH_REQUIRE_REMOTE_PARITY=1 node scripts/verify-migration-parity.mjs → STRICT_EXIT=1
```

Strict mode is **not** enabled in CI: CI has no `SUPABASE_DB_URL`, so enabling it would fail every
run. Wiring that secret remains **open as R-A3** and is a repository-administration decision.

### Evidence — parity re-measured against production after the change

Production `supabase_migrations.schema_migrations`: **74** versions. Git: **76** files.

| Direction | Before A9-EXEC | After A9-EXEC |
|---|---|---|
| **Remote-only (applied, absent from git)** — the restore-integrity class | `20260808172816` | **∅ (empty)** |
| Local-only (in git, never applied) | `20260807160000`, `20260807180000` | unchanged — explained below |

### A8 UNKNOWN converted — by measurement, not reasoning

A8 recorded *"idempotency of the two never-applied git migrations (UNKNOWN)"*. **Now VERIFIED**, and
the two files turn out not to be a divergence at all:

- `diff 20260807160000_scientific_validation_platform.sql 20260807184247_scientific_validation_platform.sql`
  → identical but for a 3-line header reading *"Parity copy: remote schema_migrations version matches
  this filename."* Same for `20260807180000` vs applied `20260807184355`. They are **deliberate,
  already-annotated parity copies**, not orphans.
- Their content **is** applied: production carries **13** `enterprise_*` tables and **3**
  `validation_*` tables, matching the tables the files create.
- Every statement is guarded, checked one class at a time: `CREATE TABLE`/`CREATE INDEX` use
  `IF NOT EXISTS`; `ALTER TYPE … ADD VALUE` uses `IF NOT EXISTS`; all 4 bare `CREATE TYPE` sit inside
  `DO $$ … EXCEPTION WHEN duplicate_object THEN NULL; END $$`; `CREATE POLICY` counts match
  `DROP POLICY IF EXISTS` counts exactly (**6/6** and **25/25**); the one `UPDATE` is
  `SET tenant_type = COALESCE(tenant_type, …)`, a no-op on re-run.

**Consequence:** DP-01 **option 2 is now evaluable and is judged unnecessary.** Removing the
duplicates would change what a greenfield run executes in exchange for no correctness gain. Not
taken.

### Gates executed

```
audit:deps      PASS  0 vulnerabilities
lint            PASS  0 errors / 13 warnings (same set as main)
typecheck       PASS  clean
vitest          PASS  753 passed / 91 files
test:migrations PASS  76 local, structure OK, remote-not-checked stated explicitly
test:perf-smoke PASS  latency budgets + TTS timeout markers intact
build           PASS
```

### What this does NOT establish

- **Not a restore test.** Git can now *express* the production schema; **no greenfield rebuild has
  been performed**, so "git can rebuild production" remains INFERENCE, not VERIFIED. R-A1's second
  half — backups have never been restore-tested — is **untouched**.
- CI still does not compare git to production on any run (**R-A3 open**).
- Reconstruction fidelity is established for the migration *text*. Whether the production schema
  contains further objects created outside the migration system was not exhaustively enumerated.

```
Next allowed:         PROGRAM A GATE re-review → Program C0 (re-derive live open-decision set).
                      Merge of this work requires explicit authorization: under OF-2, merging to
                      main deploys production.
```

---

## C0 · Re-derive the live open-decision set — **EXECUTED 2026-08-21**

```
Milestone:            C0
Program:              C — Governance activation
Status:               PASSED
Source SHA:           c62921a
Changes:              none — read-only re-measurement
Production affected:  NO — aggregate counts and schema/policy introspection only.
                      No narrative, transcript, or learner-identifying field was read.
```

**Method:** every open decision whose entry rests on a *checkable factual premise* was re-measured
against production and the current tree. Decisions resting on judgement alone (OD-1, OD-9, OD-10,
OD-14…) have no premise to re-derive and are unchanged.

### Premises re-measured

| Premise as registered | Measured 2026-08-21 | Verdict |
|---|---|---|
| **OD-11** — "the **five** currently published avatars" | **5 avatars total**: 2 `published`, 2 `draft`, 1 `testing`, 0 `archived` | **STALE — and the error is a conflation.** The register counted *all* avatars as published. The grandfathering deadline governs **2** avatars, not 5. |
| **OD-25** — corpus of "583 sessions / 466 reports / 130 competency rows" | **598** sessions · **480** reports · **130** competency rows | **STALE in two of three.** Competency rows are exact. The corpus grew ~2.6% during Phase 4; still small. |
| **OD-8** — "17 disorder IDs are declared, 11 have packages" | **17** rows in `public.disorders`; **11** disorder slugs in `src/lib/case-engine/catalog.ts` | **CURRENT — reproduces exactly.** The six: `asd`, `eating-disorders`, `ocd`, `pdd`, `schizoaffective`, `social-anxiety`. The register's "`asd` and `eating` especially" both fall in that set. |
| **OD-27** — a therapist can direct-INSERT `clinical_snapshot.admin_test = true`; sessions INSERT RLS constrains only `therapist_id` | Live policy `Therapists can create own sessions`, `WITH CHECK (therapist_id = (SELECT auth.uid()))` — **nothing constrains `clinical_snapshot`** | **CURRENT — defect live, unremediated.** |
| **OD-13 / OD-20 / OD-21 / OD-25** appointments | RDL ends at **RDL-036**; **no appointment row of any kind exists** | **CURRENT — all UNFILLED.** Program C's root blocker stands. |

### A near-miss worth recording

The first `disorders` probe returned **17 of 17 with a non-null `package`**, which reads as
"OD-8 is stale, all disorders are packaged." That would have been the F0-3 failure repeated —
a conclusion drawn from the wrong field. Inspecting the package *contents* instead shows two
distinct schemas:

- **Full teaching package (9 keys)** — `common_therapist_mistakes · differentials · ideal_approach ·
  risk_defaults · rule_outs · session_goals · severity_default · symptom_domains · teaching_points`
  → **5 disorders** (`adult-adhd`, `alcohol-use-disorder`, `gad-with-panic`,
  `mdd-recurrent-moderate`, `ptsd`).
- **Stub (6 keys)** — `symptom_profile` in place of `symptom_domains`, and **no** `differentials`,
  `rule_outs`, `teaching_points`, or `common_therapist_mistakes` → **12 disorders**.

**New gap, not previously registered:** OD-8 tracks the **6** disorders absent from the code
catalog. It does **not** track that **12 of 17** DB rows carry no differentials, rule-outs, or
teaching points. Those are different sets on different axes, and the second is unowned. Flagged for
the CGL rather than resolved here — what a disorder package must contain is a clinical-content
judgement (**OD-26** territory), not an engineering one.

### OD-27 — refinement, not downgrade

The vector is **detected and audited**, which the register did not record. On end, a forged marker
is caught by `assertAdminTestSkipAllowed` (`reason: "not_admin"`), written to
`security_audit_events` as `admin.avatar.test_session.forged_skip_denied`, and answered **403**.

That does not close it. **The 403 returns before the assessment pipeline**, so the outcome is
exactly what the register describes: the session is permanently unassessed. The learner-facing
create path *does* strip the marker (`stripAdminTestMarker`, `src/app/api/sessions/route.ts:137`) —
but the vector bypasses that route entirely by writing to the table. **The application-layer guard
exists; the database-layer one does not.** Of the three remediation shapes, only the third —
constrain the snapshot at INSERT — addresses it, and it remains untaken.

**Not re-verified:** the register's further claim that a forged session is hidden from the
therapist's own history. Out of scope for a read-only pass; left as registered.

### Register status after C0

**27 decisions remain open. None was closed by this pass** — re-deriving premises does not decide
anything. Three entries need a factual correction before they are acted on (OD-11, OD-25, and the
OD-8 scope note above); the rest reproduce as written.

```
Next allowed:         C1–C9 remain HUMAN DECISION REQUIRED, rooted at OD-13.
                      Programs D and E stay BLOCKED behind C.
                      F2–F5 stay BLOCKED on OD-21 + OD-25.
                      No unblocked engineering milestone remains in this plan.
```

---

## MERGE-02 · PR #205 merged to main and auto-deployed to production

```
Milestone:            MERGE-02 (release event, not a program milestone)
Status:               PASSED
Authorization:        Product owner instruction "merge 205", 2026-08-21, given after the
                      merge-means-deploy consequence (OF-2) had been restated in-session
                      and in the PR body. Informed authorization for BOTH the merge and
                      the production deployment it necessarily causes.

PRE-MERGE VERIFICATION (per governing mission §16)
  CI on head 36e9dc9   verify = success (run 32461460687), completed 08:05:55Z
  Review threads       none
  mergeable_state      clean
  Base                 696575e = main at merge time (no drift, no conflict)
  Diff scope           4 files, +442/-11
                         docs/VPsych_MASTER_EXECUTION_LEDGER.md
                         docs/VPsych_MASTER_EXECUTION_PLAN.md
                         scripts/verify-migration-parity.mjs
                         supabase/migrations/20260808172816_avatar_lifecycle_status.sql (new)
                       NO src/ file of any kind
                       => the deployed application bundle is unchanged; scripts/ is not
                          part of the Next build, and Vercel does not run migrations.

MERGE
  Method               squash (repo convention — #200, #201, #203, #204)
  Resulting SHA        f76a07a  on main
  PR state             merged; branch restarted from main for follow-up work

PRODUCTION DEPLOYMENT (automatic, per OF-2)
  Deployment           dpl_CwRMrTYMTsDuDdzY8rpsN2da8nYe
  Target               production · region iad1 · commit f76a07a (verified signature)
  State                READY, build 48.5s; aliasError: null
  Aliased to           vpsych.vercel.app (production domain)
                       + vpsych-alhazayed-1540s-projects.vercel.app
                       + vpsych-git-main-alhazayed-1540s-projects.vercel.app

POST-DEPLOY VERIFICATION (live site, not inferred from deploy state)
  GET /api/health      200 OK
                       {"ok":true,"service":"vpsych","version":"1.0.0-rc.1",
                        "certId":"VPSYCH-1.0-RC1-STAGE12"}
  Version on prod      1.0.0-rc.1 — UNCHANGED
  Security headers     intact on the live response: CSP with the documented connect-src
                       allow-list, HSTS max-age 63072000 preload, COOP same-origin,
                       CORP same-site, Permissions-Policy (microphone=(self)),
                       X-Frame-Options DENY, X-Content-Type-Options nosniff
  API cache posture    cache-control: no-store on /api/*

DATABASE VERIFIED UNAFFECTED (the point of the change — it must NOT have applied anything)
  applied_migrations   74 — UNCHANGED. The new .sql file was added to git only; the merge
                       did not apply, re-apply, or repair any migration remotely.
  lifecycle_status     column present · both sync triggers present (2)
  Data                 598 sessions · 480 reports · 2 published avatars — all unchanged

WHAT REACHED PRODUCTION
  No behavioural change whatsoever. The diff touches no file that ships in the runtime
  bundle. This merge exists to make git canonical, not to alter the running system.

CLAIMS UNCHANGED
  Competency scores remain NOT validated. GA remains NO-GO (RDL-032/033). Version remains
  1.0.0-rc.1. Highest supportable assessment claim remains L0.

Production affected:  YES (deployment created) — but with NO runtime or data change.
Rollback              `696575e` precedes it and remains a Vercel rollback candidate. No
                      migration was applied, so rollback is deploy-only, needs no data
                      action, and would merely restore the parity gap in git.
Next allowed:         No unblocked engineering milestone remains. Program C is the path
                      forward and is rooted at OD-13 (appoint a Clinical Governance Lead).
```

### What the cycle closed, and what it did not

**Closed:** Program A end to end (A0–A9), Program F0 and F1, decision packets DP-01 and DP-04,
and the git↔production restore-integrity gap.

**Not closed, and not closeable by engineering:** **R-A1's restore half** — backups have still
never been restore-tested and no greenfield rebuild has been run, so "git can rebuild production"
remains **INFERENCE** · **R-A3** — CI still compares git to production on no run, pending the
`SUPABASE_DB_URL` secret · **R-A4** — the forged `admin_test` vector is live in production,
re-verified against the live RLS policy under C0 · and every decision in **DP-02** and **DP-03**.
