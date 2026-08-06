# Wave 3 — Human Conversation Fidelity Review

**Branch:** `cursor/w3-completion-0594`  
**Production at review:** `vpsych.vercel.app` @ `5aae138` / `dpl_8Q7YGEH…`  
**Related:** RDL-021 remediations (PR #120) + this HCF completion

## Scope

Consultant-facing conversation believability across every **active builtin**
disorder. Evaluated dimensions: natural language, emotional expression, thought
organization, speech tempo, vocabulary, affect, rapport, cultural
appropriateness, therapeutic resistance, disclosure timing, diagnostic
consistency, multi-session continuity (session arc limited to disclosure +
memory scope on this branch — full PME/HCTF engines remain on unmerged mission
branches and were **not** ported).

## Production verification (2026-08-06)

| Check | Result |
|---|---|
| Production SHA | `5aae138` (Wave 3 FAIL baseline) — **W3 remediations not deployed** |
| Preview deploy of W3 remediation | `dpl_6E1mo9cM…` @ `af046c4` (PR #120) — not production |
| W3-C1 / H1–H4 on production | Still open (ledger, research export, preset slug fixes absent on `main` prod) |

Unauthenticated probes to `/api/admin/*` return **401** via middleware before
route resolution — cannot use HTTP status alone to prove route absence. Source
of record: `origin/main` lacks `src/app/api/admin/research/export` and
`src/lib/quality-ledger`.

## Root causes (HCF)

1. **Thin Case Engine packages** (PTSD, ADHD, AUD, panic, BPD, delirium) had
   1–3 symptoms and 1 disclosure rule → model fell back to generic helpful AI.
2. **`clinical_teaching.speech_behavior_cue` never reached Module 1** — generated
   but unused by `assembleSystemPrompt`.
3. **Diagnosis override** stripped only “HOW YOU ARE RIGHT NOW”; Maya/Jordan
   “HOW YOU TALK” / “DO-DONT” still fought mania/psychosis/trauma Module 1.
4. **Difficulty modifiers** lived only in `ideal_approach` (not in patient prompt).

## Remediations shipped (this branch)

| Change | Files |
|---|---|
| Disorder speech profiles → Module 1 | `speech-behavior.ts`, `prompt-engine.ts`, `resolve.ts` |
| Difficulty behaviour block in Module 1 | `resolve.ts` fidelity hints |
| Thicken thin packages (≥4 symptoms, ≥3 disclosure rules, patient language) | `catalog.ts` |
| Strip HOW YOU TALK / DO-DONT on override | `resolve.ts` |
| Disclosure union by topic (prefer richer notes) | `generator.ts` |
| Real speech cue at case generation | `generator.ts` |
| Regression suite | `w3-hcf-fidelity.test.ts` |

## Per-disorder verdict (post-remediation, local engine)

| Disorder | Verdict | Notes |
|---|---|---|
| MDD (Maya default) | Strong | Authored persona + profile |
| GAD (Jordan default) | Strong | Authored persona + profile |
| Bipolar mania | Improved | Pressured speech profile + talk-block strip |
| Schizophrenia | Improved | Thought-disorder lines + strip |
| PTSD / CPTSD | Improved | Titration disclosure + trauma speech |
| BPD | Improved | Affect/identity/abandonment phenotype |
| Panic | Improved | Sensory panic + avoidance |
| Adult ADHD | Improved | Distractibility speech + working memory |
| AUD | Improved | Ambivalence / minimize / MI-congruent |
| Delirium | Improved | Fluctuating attention / misidentification |

**Not active packages** (reserved IDs only): PDD, social anxiety, OCD, ASD,
schizoaffective, eating — no primary-case support until packages exist.

## Acceptance vs consultant bar

Local engine + prompt assembly now encode disorder-specific speech, disclosure
timing, and resistance/insight cues for every active builtin. **Final acceptance
requires production deploy of W3 remediation + this HCF commit, migration apply,
and blind consultant sessions** — not green unit tests alone.

## Ops before independent Wave 3 re-cert

1. Merge PR #120 + this HCF completion to `main`
2. Deploy production
3. Apply `20260805214500_quality_ledger_and_scientific_indices.sql`
4. Re-run Missions 9–13 + HCF spot-checks on production SHA
5. Do **not** unlock Wave 4 until board PASS
