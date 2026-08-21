# VPsych — Track B Roadmap (OD-13 unfilled)

**Created:** 2026-08-21 (UTC) · **Baseline:** `main` @ `998e586` ≡ production
**Governing records:** `docs/RELEASE_DECISION_LOG.md` · `docs/VPsych_PHASE4_OPEN_DECISIONS_REGISTER.md`
**Supersedes nothing.** The Master Execution Plan's Programs C/D/E remain as written and blocked.

> **Premise, stated by the product owner 2026-08-21:** *"I do not currently have a suitable
> Clinical Governance Lead for OD-13. Keep OD-13 open and explicitly unfilled. Do not design
> around a fake or temporary appointment."*
>
> **OD-13 is UNFILLED — open, owned by nobody, not deferred and not delegated.** Nothing in this
> roadmap appoints, simulates, or works around a Clinical Governance Lead. Where clinical
> authority is required, the work stops.

---

## 0. The strategic picture in five lines

1. **OD-13 blocks Track A entirely** — all clinical approval, and Programs D and E behind it.
2. **Track B does not need a CGL.** The register states OD-21 is *"independent of OD-13 — this is
   the one clinical-adjacent appointment that does not require a CGL first."*
3. **Track B needs two things, and you can obtain both:** one contract psychometrician (OD-21,
   estimated 40–80 hours) and one authorization decision that is *yours* to make (OD-25).
4. **Your only evidence asset is smaller than it looks:** 480 reports exist, but only **46** are
   configuration-homogeneous. That number is the real sample size, and it grows ~3/day by itself.
5. **Therefore the highest-value engineering available today is the work that makes those 46
   become 200 faster and cleaner** — plus closing a live security defect that would taint any
   analysis run over the corpus.

---

## 1. Work we can FULLY COMPLETE now

No appointment, no clinical judgement, no new authority. Ordered by value.

### T1 · Close the forged `admin_test` vector — **DONE 2026-08-21 · vector CLOSED in production**

**Completed.** PR #208 → `main` @ `30fd38a`; migration applied as `20260821084315` (RDL-038 chose
the shape, RDL-039 records the application; ledger `T1` and `APPLY-01`). Verified by execution
against the live database, both controls, transaction aborted so nothing was written: forged
therapist INSERT **rejected `42501`**, legitimate admin INSERT **allowed**. **R-A4 closed.**
**F-5 is moot for all future sessions.** The precondition this roadmap placed ahead of **OD-25** is
therefore met.

*Original entry retained below.*

### T1 (original) · Close the forged `admin_test` vector — **highest value**
**What:** A trainee can insert a session marked as an admin test, and their session is then never
assessed — permanently, and invisibly to them. Re-verified live under C0: the sessions INSERT
policy is `WITH CHECK (therapist_id = (SELECT auth.uid()))`; **nothing constrains the snapshot.**

**Why it is Track B work, not Track A:** the register assigns OD-27 to `Engineering +
Security/Governance` — **not** to the CGL. The CGL consultation it mentions is on *"whether a
forged session should be assessed or refused."* **Remediation shape 3 — constrain the snapshot at
INSERT — makes that question moot**, because forging stops being possible at all. That path needs
no clinical input.

**Why it must precede any corpus analysis:** the register's own warning — *"analysing a corpus
whose scores can be selectively evaded weakens every Tier 1 conclusion."* Fixing this after the
analysis cannot repair the caveat retrospectively. **Do this before OD-25 is exercised.**

**Prerequisite:** resolve the **F-5 contract wording** in writing first (Phase 3C says "do not
skip" in §5.2 while the implemented rule is 403). That is a product-owner call.

**Deliverable:** migration (trigger or RPC) + guardrail test + RDL row.

### T2 · Provenance completeness — makes the corpus analysable
**Measured today:** 480 reports · **46** carry `scores.scientific_provenance.ai_model` +
`prompt_engine_version` · 1 model (`gpt-5-2025-08-07`) · 1 prompt version (`2.0.0`) · earliest
complete 2026-08-06.

**What:** verify every new report writes the provenance block without exception, and add a
regression test so it cannot silently regress. **The 434 older reports cannot be backfilled** —
the configuration that produced them was never recorded, and inventing it would be fabrication.

**Why it matters:** a defensible reliability estimate needs a configuration-controlled sample.
At ~3.3 reports/day, n=100 is reachable in ~16 days and n=200 in ~47 days **with no decision from
anyone** — provided the writer never drops the block.

### T3 · R-A3 — wire `SUPABASE_DB_URL` into CI
Repository administration. Makes the migration-parity gate actually compare git to production
instead of skipping the comparison. The strict mode already exists
(`VPSYCH_REQUIRE_REMOTE_PARITY=1`, verified to exit 1). **Never paste the value into a chat.**

### T4 · R-A1 — first backup restore test
Never performed. Must run into an **isolated, disposable** environment — never over production.
Closes the remaining half of the programme's oldest critical risk.

### T5 · Enable leaked-password protection (HIBP)
Pre-existing finding SEC-S12-01: `auth_leaked_password_protection` is **disabled**. One setting.

### T6 · Voice — fix the numeric-pair corruption (narrow half of DP-03A)
The Arabic normalizer converts `الضغط 120/80` into `الضغط 120/ثمانين`. **This is a defect under
any dialect** — a blood-pressure reading is being mangled, and that is not a question of taste.
Fixing the corruption needs no language authority.

**Explicitly NOT included:** what the *ideal* Levantine spoken form should be. That needs a native
speaker (OD-7 / OD-18) — a far easier hire than a CGL, and **not** a CGL.

### T7 · Correct the stale premises C0 found
OD-11 says "five currently published avatars" — there are **2** (5 exist in total).
OD-25 says "583 sessions / 466 reports" — now **598 / 480**. Stale premises corrupt decisions
made from them.

### T8 · Test–retest harness on synthetic data
F0-2 established scoring is non-deterministic (examiner `temperature: 0.3`), so test–retest
**cannot be inferred from stored data** — it needs deliberate re-runs. Build the re-run machinery
and exercise it on synthetic fixtures only.

**Why now:** it is the one substantive F-program capability that needs neither OD-21 nor OD-25,
and it is precisely what a newly appointed psychometrician would otherwise wait weeks for.

---

## 2. Work we can PROTOTYPE but NOT clinically approve

Buildable as mechanism. **None of it may be switched on, populated with thresholds, or described
as a governance control** until a CGL exists. Each carries real risk of building the wrong shape —
accepted deliberately, and bounded by keeping these to data model and plumbing.

| # | Item | Build | Must NOT do |
|---|---|---|---|
| **P1** | **P0-2 content version identifier** (gated by OD-14) | A deterministic version hash over **all** content fields — the conservative default | Decide which fields are "clinically material". Only the CGL narrows the scope (OD-14). |
| **P2** | **Clinical review state + sign-off gate** (D3/D4) | Reviewer identity, timestamps, approval↔version linkage, stale-approval invalidation | Set any pass threshold · define approval semantics · enable the gate · seed a default approver |
| **P3** | **Evidence package generation** (D8) | The structure and export plumbing | Fill it with clinical content or represent output as evidence of review |
| **P4** | **Voice branch consolidation** (DP-03C) | Compare the five branches, pick one canonical line, preserve unique work | Merge to production without EN + AR human listening QA (DP-03B) |

**Standing rule for this section:** a prototype that cannot be distinguished from a live control
is worse than no prototype. Anything built here ships **inert and visibly inert**.

---

## 3. Work that MUST REMAIN BLOCKED

No workaround, no proxy, no "temporary" version.

**Clinical authority — blocked at OD-13:**
- Approving any simulated patient for trainee use · publication sign-off
- Adopting `VP-CLIN-PROTOCOL` (OD-1) · amending it
- Defining "clinically material" change scope (OD-14)
- Authoring the D1 diagnostic coherence checklist (OD-26)
- Reviewer qualification standards, pass thresholds, adjudication, publication authority (OD-16/17/22/24)
- Clinical safety incident procedure (OD-15)
- Change-classification table (OD-23) · D13 medication question (OD-12)
- Filling the **12 of 17** disorder packages that carry only a 6-key stub — clinical content authorship
- **Program E in full** — the clinical/voice pilot
- Publishing any new simulated patient to learners

**Blocked at OD-21 / OD-25 (not at OD-13):**
- **F2** retrospective corpus analysis · **F3** blinded expert re-rating · **F4** EN-vs-AR fairness
- **F5 claim-ladder determination** — the highest supportable claim stays **L0**

**Blocked at OD-9 / OD-10 — must not be guessed:**
- Legal position on consequential scores · human-subjects obligations

**Absolutely and permanently, regardless of progress:**
- Any statement that competency scores are validated, clinically validated, psychometrically
  validated, certified, or production-ready. **GA remains NO-GO** (RDL-032/033). Version stays
  `1.0.0-rc.1`.

---

## 4. What a CGL appointment unlocks — immediately, and next

**Same week (decisions the CGL can take alone or with the Board):**
- **OD-1** adopt/reject/amend the protocol → the protocol acquires an owner
- **OD-14** clinically material version scope → **releases software item P0-2**, so P1 above stops
  being a prototype and becomes the real thing
- **OD-15** clinical safety incident procedure
- **OD-16 / OD-17 / OD-22 / OD-24** reviewer standards, thresholds, adjudication, publication authority

**Immediately after:**
- **OD-26** D1 coherence checklist → unblocks **D6**
- **OD-23** change classification · **OD-12** D13 medication question
- **Program D in full** — D1 through D9, the clinical review and sign-off system
- **Program E** becomes reachable once D is built and reviewers are appointed (OD-18/19/20)
- **OD-8** the six unpackaged disorders, and the newly-surfaced 12-stub gap, acquire an owner

**What a CGL does NOT unlock:** F2–F5. Those need **OD-21 + OD-25**. Assessment validity and
clinical validity are different programmes with different authorities — appointing a CGL does not
advance the reliability evidence by one step.

---

## 5. Recommended sequence

**Do now, in this order, needing nobody new:**
1. **T1** forged `admin_test` — resolve F-5 wording, then close the vector *before* any corpus analysis
2. **T2** provenance completeness — every day of delay is a day of unusable reports
3. **T3** CI parity secret · **T5** HIBP · **T7** stale premises — cheap, same cycle
4. **T8** test–retest harness · **T6** voice numeric fix
5. **T4** restore test — schedule deliberately, isolated environment

**Then, the two decisions that actually restart the programme — neither needs a CGL:**
6. **OD-21** — appoint a contract psychometrician. 40–80 hours estimated. **This is now the
   highest-leverage appointment available**, and it is a far smaller ask than a CGL.
7. **OD-25** — authorize corpus analysis. **This one is yours to make** (`Product Owner` +
   `Security/Governance` + `Legal/Compliance`), under aggregate-only, PHI-free, admin-boundary
   handling. Best taken *after* T1, so the authorization is not granted over a corpus with a live
   evasion vector.

**In parallel, keep recruiting the CGL.** Track B is a hedge against recruitment lag — it is not a
substitute, and it does not make the platform clinically approved.

---

## 6. What this roadmap does not claim

- It does not make VPsych clinically validated, approved, or safe to publish new patients from.
- It does not reduce the need for a Clinical Governance Lead. **OD-13 remains the root blocker of
  the dependency graph**, unfilled and unowned.
- Completing every item in §1 and §2 still leaves the highest supportable assessment claim at
  **L0**, GA at **NO-GO**, and competency scores **not validated**.
- It buys time and evidence. It does not buy authority.
