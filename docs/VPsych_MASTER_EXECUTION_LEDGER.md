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
Status:               HUMAN DECISION REQUIRED
Source SHA:           97cf879
Changes:              NONE — prepared only
Production affected:  NO
Human decision:       PENDING — see decision packet DP-01 below
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

# DECISION PACKETS

## DP-01 · Migration parity remediation (milestone A9)

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

**What continues regardless:** Program F0 (instrument inventory, read-only). Program A9 remains
pending DP-01.
