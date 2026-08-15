# VPsych — Phase 4 Open Decisions Register

**Document type:** Read-only governance analysis. No application code, schema, migration,
deployment, production, or PR change.
**Date:** 2026-08-15 (UTC)
**Source protocol:** `docs/VPsych_PHASE4_VALIDATION_GOVERNANCE_AND_PROTOCOL.md`
(`VP-CLIN-PROTOCOL v1.0-draft` — **PROPOSED, NOT ADOPTED**)
**Predecessor:** `docs/VPsych_PHASE4_READINESS_ASSESSMENT.md`
**Repository state:** `claude/vpsych-cursor-handoff-h1qovr` @ `b25204d`

**Register status:** 27 open decisions · 13 P0 · 11 P1 · 2 P2 · 1 P3
**Clinical Governance Lead: NOT IDENTIFIED**

---

## 1. Purpose and method

This register extracts every open decision implied by the Phase 4 validation protocol, assigns
an owner category and priority to each, and identifies the smallest set that must be resolved
before any Phase 4 application code is written.

### 1.1 Extraction method

Three passes over the protocol:

1. **Registered decisions** — the twelve entries in protocol §20.
2. **Unratified `[GOV]` standards** — every value or rule marked `[GOV]` is by the protocol's
   own definition *"a rule the programme adopts by decision, not because law compels it."* An
   unadopted protocol has therefore adopted none of them. Each `[GOV]` cluster that carries a
   *specific numeric threshold or allocation of authority* is an open decision, whether or not
   §20 listed it.
3. **Deferred appointments** — protocol §18 records ten reviewer roles as `NOT IDENTIFIED` and
   §19 makes several of them entry criteria. §18 frames these as a *resourcing gap*; they are
   equally *decisions* — someone must decide to appoint, to what standard, and with what budget.

### 1.2 Finding: §20 under-registers the protocol's own open decisions

**Twelve decisions are registered in §20. Fifteen more are raised in the protocol body without
being registered.** The unregistered ones are not minor: they include the Clinical Governance
Lead appointment (the protocol's own stated binding constraint, §18.3), the avatar content
version identifier scope (which gates a P0 software item, §12.1.1), and the clinical safety
incident procedure (§16.2).

The pattern is consistent and explains itself: §20 registered decisions the protocol
*deliberately declined to make*, while the fifteen others are decisions the protocol *made
provisionally* — proposing a value marked `[GOV]` and noting it requires ratification. Both are
open. Only the first group was registered.

**Consequence:** anyone working from §20 alone would believe twelve decisions stand between
them and Phase 4. The real number is 27, and the missing ones include the first appointment
that has to happen.

### 1.3 Protocol defect found during extraction

| ID | Defect | Impact | Correction |
|---|---|---|---|
| **DEF-1** | Protocol §19.4 (Phase 4 Entry Criteria) requires that *"Open decisions §20 OD-1…OD-8 each [be] resolved or explicitly deferred."* §20 registers **OD-1…OD-12.** | The entry criteria under-specify by four decisions — OD-9 through OD-12, which include both `[LEGAL-UNKNOWN]` flags, the legacy grandfathering deadline, and the D13 medication-validation question. An implementer satisfying §19 literally would enter Phase 4 with four registered decisions unaddressed. | Amend §19.4 to read `OD-1…OD-27` per this register. **Not performed here** — the protocol task and this one both prohibit modifying governance files. To be carried by the RDL that adopts the protocol (OD-1). |

This is an error in a document produced earlier in this series. It is recorded rather than
silently corrected because the correction belongs to the adoption decision, and because a
governance register that quietly edits its own source is not a governance register.

### 1.4 Numbering

`OD-1`…`OD-12` retain their protocol §20 identifiers unchanged, for traceability.
`OD-13`…`OD-27` are newly registered here. Provenance is marked on every entry:
**[§20]** registered in the protocol · **[EXTRACTED]** raised in the body, newly registered.

### 1.5 Owner categories

`CGL` · `Clinical Reviewer` · `Psychometrician` · `Educational/Training Expert` ·
`Product Owner` · `Engineering` · `Security/Governance` · `Legal/Compliance` ·
`Joint Governance` (Board-level, multi-party).

**No individuals are named. The repository can establish none.**

---

## 2. Master index

Blocking columns: **IMPL** = blocks Phase 4 implementation · **CLIN** = blocks clinical
validation · **EDU** = blocks educational validation · **CERT** = blocks certification
readiness.

| ID | Decision | Owner | Pri | IMPL | CLIN | EDU | CERT |
|---|---|---|---|:--:|:--:|:--:|:--:|
| **OD-13** | Appoint Clinical Governance Lead | Joint Governance | **P0** | **Y** | **Y** | **Y** | **Y** |
| **OD-1** | Adopt / reject / amend the protocol | Joint Governance | **P0** | **Y** | **Y** | **Y** | **Y** |
| **OD-14** | Avatar content version identifier — scope | CGL + Engineering | **P0** | **Y** | **Y** | N | **Y** |
| **OD-26** | Author D1 diagnostic coherence checklist | CGL | **P0** | N | **Y** | N | **Y** |
| **OD-16** | Ratify reviewer qualification thresholds | CGL | **P0** | N | **Y** | **Y** | **Y** |
| **OD-17** | Ratify clinical review pass thresholds | CGL | **P0** | N | **Y** | N | **Y** |
| **OD-22** | Ratify adjudication model | CGL + Joint Gov | **P0** | N | **Y** | N | **Y** |
| **OD-24** | Ratify publication approval authority | Joint Governance | **P0** | Partial | **Y** | **Y** | **Y** |
| **OD-15** | Adopt clinical safety incident procedure | Joint Governance | **P0** | N | **Y** | N | **Y** |
| **OD-20** | Appoint Educational Reviewer | CGL + Product | **P0** | N | N | **Y** | **Y** |
| **OD-21** | Appoint Psychometric Reviewer | Joint Governance | **P0** | N | N | N | **Y** |
| **OD-25** | Authorize corpus analysis (Track B) | Product + Sec/Gov + Legal | **P0** | N | N | N | **Y** |
| **OD-27** | Forged `admin_test` remediation approach | Engineering + Sec/Gov | **P0** | **Y** | N | N | **Y** |
| **OD-2** | Evidence retention period | Product Owner | **P1** | Partial | N | N | **Y** |
| **OD-3** | How ER obtains a report for E9 | CGL + Product | **P1** | Partial | N | **Y** | **Y** |
| **OD-4** | Is there a conditional approval state? | Joint Governance | **P1** | Partial | N | N | **Y** |
| **OD-5** | Model/prompt change re-review policy | CGL + Joint Gov | **P1** | N | **Y** | N | **Y** |
| **OD-18** | Appoint Arabic Clinical Reviewers | CGL + Product | **P1** | N | Partial | N | **Y** |
| **OD-19** | Appoint Voice/Speech Reviewer | CGL + Engineering | **P1** | N | Partial | N | **Y** |
| **OD-23** | Ratify change-classification table | CGL | **P1** | N | N | N | **Y** |
| **OD-11** | Legacy avatar grandfathering deadline | Joint Governance | **P1** | N | N | N | **Y** |
| **OD-7** | Ratify Arabic opening prompt | Arabic Clinical Reviewer | **P1** | N | Partial | N | **Y** |
| **OD-9** | `[LEGAL-UNKNOWN]` consequential-scores position | Legal/Compliance | **P1** | N | N | N | **Y** |
| **OD-10** | `[LEGAL-UNKNOWN]` human-subjects obligations | Legal/Compliance | **P1** | N | N | N | **Y** |
| **OD-8** | Six unpackaged disorders — sequencing | Joint Governance | **P2** | N | N | N | N |
| **OD-12** | Can D13 be validated without a med model? | CGL | **P2** | N | Partial | N | **Y** |
| **OD-6** | Calibrate 24-month / 20% thresholds | CGL + Psychometrician | **P3** | N | N | N | N |

**Totals: 27 open · P0 13 · P1 11 · P2 2 · P3 1**

---

## 3. P0 decisions — full entries

### OD-13 · Appoint the Clinical Governance Lead **[EXTRACTED]**

1. **ID:** OD-13
2. **Decision:** Appoint a named Clinical Governance Lead with programme authority to own
   `VP-CLIN-PROTOCOL`, author its clinical content, approve avatars, and amend the protocol.
3. **Why it matters:** The protocol assigns the CGL sole authority over approval (§10.3,
   non-delegable), the D1 coherence checklist (§19.11), threshold ratification (§9, §12.7),
   change classification (§12.3.2), and protocol amendment (§10.3). **Every other clinical
   decision in this register is either owned by the CGL or requires CGL input.** The protocol
   states it directly: *"Without a CGL, this document is a proposal with no owner — including
   its own open decisions."* This is the decision that unlocks the register.
4. **Default/recommended:** The protocol recommends the CGL as the *first* appointment (§18.3)
   and proposes 10 years' post-qualification experience plus governance authority (§4.3). It
   proposes no appointment mechanism.
5. **Owner:** `Joint Governance` (Board-level).
6. **Expertise required:** Senior licensed mental-health clinician, 10+ years, governance or
   programme-leadership experience, no authoring conflict on existing avatars.
7. **Dependencies:** None. **This is the root of the dependency graph.**
8. **Consequence of delay:** Total stall of Track A. OD-14, OD-16, OD-17, OD-22, OD-23, OD-26
   and OD-12 cannot be resolved. Since OD-14 gates software item P0-2, **delay here delays code**,
   not merely process. Track B (OD-21, OD-25, OD-27) can proceed independently — this is the
   programme's only meaningful hedge against CGL recruitment lag.
9. **Blocks Phase 4 implementation:** **YES** — transitively via OD-14.
10. **Blocks clinical validation:** **YES** — absolutely.
11. **Blocks educational validation:** **YES** — CGL approval is required at V5.
12. **Blocks certification readiness:** **YES.**

---

### OD-1 · Adopt, reject, or amend `VP-CLIN-PROTOCOL v1.0` **[§20]**

1. **ID:** OD-1
2. **Decision:** Board decision to adopt the protocol as binding, reject it, or adopt with
   amendment — recorded as RDL-035. Must incorporate the DEF-1 correction (§1.3).
3. **Why it matters:** The protocol is explicitly `PROPOSED, NOT ADOPTED`. Until adopted, none
   of its `[GOV]` standards bind, no reviewer has authority, and any software built to enforce
   it implements an unauthorized specification. `RELEASE_GOVERNANCE.md` requires an RDL row for
   each transition; without one there is no authority to run the programme at all.
4. **Default/recommended:** The protocol recommends adoption via RDL-035, sequenced after
   RDL-034 (Phase 3 acceptance, §16.3) and before RDL-036 (Phase 4 scope).
5. **Owner:** `Joint Governance`.
6. **Expertise required:** Board; CGL input strongly preferred — adopting a clinical protocol
   with no clinical authority appointed inverts the document's own central control (§4.5.3).
7. **Dependencies:** **OD-13 should precede it.** A protocol adopted before its owner exists is
   adopted by parties who cannot operate it.
8. **Consequence of delay:** All validation work is unauthorized. Software built meanwhile
   risks encoding provisional criteria. Governance inconsistency compounds with the missing
   Phase 3 RDL row.
9. **Blocks implementation:** **YES.**
10. **Blocks clinical validation:** **YES.**
11. **Blocks educational validation:** **YES.**
12. **Blocks certification readiness:** **YES.**

---

### OD-14 · Avatar content version identifier — definition and scope **[EXTRACTED]**

1. **ID:** OD-14
2. **Decision:** Define which avatar fields are *clinically material* and therefore in scope for
   the content version hash; and specify the hash's determinism guarantees (field ordering,
   normalization, null handling).
3. **Why it matters:** Protocol Rule 12.1.1 makes the version identifier a **prerequisite** for
   the entire change-control policy, and §11 makes the version hash **required** evidence. The
   repository has no such identifier — `schema_version` is the schema version (2), `updated_at`
   records that something changed but not what. **This is the only decision that directly gates
   the design of a P0 software item** (P0-2), and it is a clinical decision wearing an
   engineering costume: "which fields are clinically material" cannot be answered by
   engineering without silently setting clinical policy.
4. **Default/recommended:** The protocol proposes *"a deterministic hash over the clinically
   material fields"* and its §12.2 classification table implicitly enumerates candidates —
   `clinical_core` (all), `human_personality`, `personalities[locale]` (`persona_prompt`,
   `speech`, `cultural_context`, `idioms_of_distress`, `identity`), voice binding. It explicitly
   excludes `slug`, `portrait_url`, and non-clinical metadata as ADMINISTRATIVE. **This is a
   starting proposal, not a resolved scope.**
5. **Owner:** `CGL` (materiality) **+** `Engineering` (determinism and implementation).
6. **Expertise required:** Clinical judgement on materiality; engineering for hash design.
7. **Dependencies:** **OD-13** (needs a CGL). Informs OD-23.
8. **Consequence of delay:** Software item P0-2 cannot be specified. Without it, approvals
   cannot be bound to what was approved, every §12 change rule is unenforceable, and evidence
   packages fail the §16.4 auditability test from the first approval onward. Retrofitting a
   version identifier after approvals exist means those approvals can never be tied to content.
9. **Blocks implementation:** **YES** — directly gates P0-2.
10. **Blocks clinical validation:** **YES** — §11 required evidence.
11. **Blocks educational validation:** No.
12. **Blocks certification readiness:** **YES** — §16.4 auditability.

---

### OD-26 · Author the D1 diagnostic coherence checklist **[EXTRACTED]**

1. **ID:** OD-26
2. **Decision:** Author and ratify the definitive diagnostic coherence checklist for protocol
   domain D1 — the clinical rules an avatar's authored record must satisfy.
3. **Why it matters:** D1 is the domain that catches the readiness assessment's worked example
   (a "recurrent MDD" avatar with three weeks of symptoms and no prior episode). The protocol
   gives only *illustrative* items and states explicitly that the definitive list **must be
   authored by the CGL, not by engineering**. This is the central purpose-statement of the whole
   protocol (§1): engineering can enforce a clinical standard but cannot author one. **Without
   this checklist, C-4 clinical coherence validation has no rules to implement**, and D1 has no
   pass criteria beyond a J-scale impression.
4. **Default/recommended:** Protocol §5 D1 offers five illustrative items (code/label match ·
   symptom count meets threshold · duration meets minimum · qualifiers supported · severity
   consistent with burden). Marked illustrative and non-definitive.
5. **Owner:** `CGL`, with `Clinical Reviewer` input.
6. **Expertise required:** DSM-5 and ICD-11 diagnostic competence; the checklist must work
   across both coding systems since the catalog carries both.
7. **Dependencies:** **OD-13.**
8. **Consequence of delay:** Clinical review cannot begin — D1 is the first domain of every
   review. Any coherence-validation code written meanwhile would encode engineering assumptions
   as clinical policy, which is the specific failure the protocol exists to prevent.
9. **Blocks implementation:** No — the transcript surface and version identifier do not depend
   on it. It blocks *coherence-validation* implementation, which is not a P0 software item.
10. **Blocks clinical validation:** **YES.**
11. **Blocks educational validation:** No.
12. **Blocks certification readiness:** **YES.**

---

### OD-16 · Ratify reviewer qualification thresholds **[EXTRACTED]**

1. **ID:** OD-16
2. **Decision:** Ratify or revise §4.3 minimum experience (CR 3 years · ADJ 7 years + supervisory
   · CGL 10 years), §4.4 disorder-specific expertise rules, and §4.2.1 prescriber requirement.
3. **Why it matters:** These determine who may review, and therefore whether any given
   appointment is valid. The protocol marks the whole of §4 as `[GOV]` — recommended standards
   with **no legal force established**. An unratified threshold means a reviewer's eligibility
   is contestable after the fact, which would invalidate their reviews retrospectively.
4. **Default/recommended:** As proposed in §4.3–4.4. The rationale given for CR = 3 years is
   that below it reviewers have typically seen too narrow a case range to judge presentation
   typicality — a reasoned but unevidenced position.
5. **Owner:** `CGL`.
6. **Expertise required:** Senior clinical + governance judgement on proportionality.
7. **Dependencies:** **OD-13.** Gates OD-18, OD-19, OD-20, OD-21 (each appointment must be
   made *against* a ratified standard).
8. **Consequence of delay:** Appointments cannot be validated. Reviews conducted by
   reviewers whose eligibility is later disputed may need to be redone.
9. **Blocks implementation:** No.
10. **Blocks clinical validation:** **YES.**
11. **Blocks educational validation:** **YES** — ER qualification is in scope.
12. **Blocks certification readiness:** **YES.**

---

### OD-17 · Ratify clinical review pass thresholds **[EXTRACTED]**

1. **ID:** OD-17
2. **Decision:** Ratify or revise §5.3 avatar-level pass criteria — specifically the J-scale
   pass point (≥3 of 4), the **cap of three minor deviations** per avatar, the zero-tolerance
   on critical failures, and Rule 5.1.1 (`NOT OBSERVED` is not a pass).
3. **Why it matters:** These are the numbers that decide whether an avatar passes. They are
   currently `[GOV]` proposals with reasoning but no empirical basis — the three-deviation cap
   in particular is an unargued round number. Setting them too tight stalls the programme;
   too loose makes the gate decorative. Rule 5.1.1 is the one most likely to be quietly relaxed
   under delivery pressure, and it is the rule that prevents a validation record from meaning
   nothing.
4. **Default/recommended:** As proposed in §5.3 — nine conjunctive conditions, non-compensatory
   on safety and critical failures.
5. **Owner:** `CGL`.
6. **Expertise required:** Clinical judgement; measurement input useful but not required at this
   stage.
7. **Dependencies:** **OD-13.** Interacts with **OD-4** (conditional approval) and **OD-6**
   (later empirical calibration).
8. **Consequence of delay:** No avatar can be passed or failed — reviews produce ratings with
   no decision rule. Ratings collected under one threshold and judged under another are not
   comparable.
9. **Blocks implementation:** No.
10. **Blocks clinical validation:** **YES.**
11. **Blocks educational validation:** No — §7.3 has separate criteria.
12. **Blocks certification readiness:** **YES.**

---

### OD-22 · Ratify the adjudication model **[EXTRACTED]**

1. **ID:** OD-22
2. **Decision:** Ratify or revise §9 — specifically Rule 9.5.1 (**no majority voting**; the ADJ
   decides on reasoning), Rule 9.3.1 (**critical failures are not votable**), adjudicator
   blinding to reviewer identity, and the requirement that the ADJ run their own session rather
   than adjudicate on paper.
3. **Why it matters:** This answers the "Reviewer A: PASS, Reviewer B: FAIL" case. The design
   choice is consequential and contestable: 2-of-3 majority voting is the intuitive default and
   the protocol explicitly **rejects** it, because majority voting would let a critical safety
   failure be outvoted — which would make the non-compensatory safety rule (R-1) meaningless.
   That rejection is the load-bearing part and it must be a ratified decision rather than an
   authorial preference, because it will be argued with the first time a split verdict costs a
   release.
4. **Default/recommended:** §9.5 as written — ADJ verdict decisive, subject to separate CGL
   approval and to Rule 9.3.1.
5. **Owner:** `CGL` **+** `Joint Governance` (the model allocates decision rights).
6. **Expertise required:** Clinical + governance.
7. **Dependencies:** **OD-13**, **OD-16** (ADJ qualification). Relates to **OD-6** (20% rate).
8. **Consequence of delay:** The first split verdict has no resolution path and stalls. Worse:
   resolving it ad hoc sets an unrecorded precedent that will be cited later.
9. **Blocks implementation:** No — adjudication is a process, executable offline.
10. **Blocks clinical validation:** **YES** — a split verdict is likely within the first few
    avatars and has no defined resolution until this is ratified.
11. **Blocks educational validation:** No.
12. **Blocks certification readiness:** **YES** — §16.4 requires that disagreement resolution be
    auditable.

---

### OD-24 · Ratify publication approval authority **[EXTRACTED]**

1. **ID:** OD-24
2. **Decision:** Ratify §10.3 — CGL approval at V5 is **non-delegable**; clinical and educational
   verdicts are non-delegable; and Rule 10.3.1, that **withdrawal is deliberately easier than
   publication** (any CR, ER, CGL, or admin may withdraw immediately and unilaterally).
3. **Why it matters:** This allocates the authority to publish and to withdraw. The asymmetry in
   Rule 10.3.1 is deliberate — the cost of a wrongly withdrawn avatar is inconvenience, the cost
   of a wrongly retained unsafe one is harm — but it grants unilateral withdrawal power broadly,
   which is an organizational decision no protocol author can make alone. It also determines
   whether the `testing → published` gate is a hard precondition or advisory.
4. **Default/recommended:** §10.3 table as written.
5. **Owner:** `Joint Governance`.
6. **Expertise required:** Governance; clinical input on the withdrawal asymmetry.
7. **Dependencies:** **OD-13**, **OD-1.** Interacts with **OD-4.**
8. **Consequence of delay:** No one has authority to publish a validated avatar — validation
   completes and stops. Conversely, no one has clear authority to withdraw an unsafe one, which
   is the more dangerous half.
9. **Blocks implementation:** **Partial** — the sign-off gate (P1-2) cannot be specified, but no
   P0 software item depends on it.
10. **Blocks clinical validation:** **YES** — review with no approval authority produces no
    approvals.
11. **Blocks educational validation:** **YES.**
12. **Blocks certification readiness:** **YES.**

---

### OD-15 · Adopt a clinical safety incident procedure **[EXTRACTED]**

1. **ID:** OD-15
2. **Decision:** Adopt a procedure defining a *clinical safety incident* — distinct from the
   operational incidents covered by `docs/INCIDENT_RESPONSE.md` — with severity classification,
   withdrawal authority, CGL notification, learner-welfare step, root-cause review, Board
   threshold, and an append-only incident log.
3. **Why it matters:** `INCIDENT_RESPONSE.md` covers outage, security, and data incidents. It
   has **no concept** of an avatar behaving unsafely in a live learner session, a §15 failure
   found post-publication, or a trainee distressed by content. These have different triage,
   different authority (CGL, not DevSecOps), and different resolution (withdrawal, not
   rollback). Protocol Rule 15.3.4 already *refers* to an incident record that does not exist.
   Per the readiness assessment, trainee distress (protocol E8) is **the most likely real-world
   harm the platform can currently cause** — and there is no procedure for it.
4. **Default/recommended:** Protocol §16.2 specifies minimum contents. No draft exists.
5. **Owner:** `Joint Governance` — `CGL` (clinical triage) + `Security/Governance` (process
   integration with the existing incident framework).
6. **Expertise required:** Clinical risk management; incident-process design.
7. **Dependencies:** **OD-13.** Relates to **OD-10** `[LEGAL-UNKNOWN]` on external reporting.
8. **Consequence of delay:** A §15 safety failure discovered on a published avatar has no
   defined response path. The protocol's own escalation rule references a procedure that does
   not exist, so the escalation cannot be executed as written.
9. **Blocks implementation:** No.
10. **Blocks clinical validation:** **YES** — the §15 safety battery should not be run against
    published content without a defined response to a failure.
11. **Blocks educational validation:** No — though E8 (learner safety) is closely related.
12. **Blocks certification readiness:** **YES.**

---

### OD-20 · Appoint the Educational Reviewer **[EXTRACTED]**

1. **ID:** OD-20
2. **Decision:** Appoint a named Educational Reviewer qualified per §4.3 (3 years psychotherapy
   supervision or clinical education).
3. **Why it matters:** The ER owns validation object D and protocol §7 (nine domains, E1–E9),
   and holds a **non-delegable** verdict at governance state V4. No avatar reaches V5 without
   it. The ER also co-rates D10 with the CR — the protocol treats CR/ER disagreement there as a
   legitimate finding, not an error, which only works if the two roles are genuinely distinct
   people.
4. **Default/recommended:** Protocol requires one ER on every panel (§4.7).
5. **Owner:** `CGL` **+** `Product Owner` (resourcing).
6. **Expertise required:** Psychotherapy supervision or clinical education, 3+ years; no
   authoring conflict.
7. **Dependencies:** **OD-13**, **OD-16.** Interacts with **OD-3** (E9 report access).
8. **Consequence of delay:** Educational validation cannot occur. Since §10.2 requires V4 before
   V5, **an unfilled ER blocks all approvals**, not merely the educational half.
9. **Blocks implementation:** No.
10. **Blocks clinical validation:** No — clinical review can complete to V3 independently.
11. **Blocks educational validation:** **YES.**
12. **Blocks certification readiness:** **YES.**

---

### OD-21 · Appoint the Psychometric Reviewer **[EXTRACTED]**

1. **ID:** OD-21
2. **Decision:** Appoint a psychometrician to own validation objects E and F and to design and
   execute the §8.4 Tier 1 analyses.
3. **Why it matters:** This is **the gating appointment for Track B**, and Track B is the
   programme's hedge: per protocol §17.6 it needs no clinical reviewer availability and runs
   against the existing corpus (583 sessions / 466 reports / 130 competency rows). The PR also
   owns the §8.5 pre-registration discipline — without which analyses on a corpus this small
   produce findings that will not replicate.
4. **Default/recommended:** Protocol §18.1 estimates 40–80 hours initial effort; §8.4 scopes
   Tier 1 to six studies (T1-a…T1-f).
5. **Owner:** `Joint Governance` (budget) with `CGL` consultation.
6. **Expertise required:** Graduate training in psychometrics/statistics plus applied
   experience; competence to report an adverse result (§8.5.2).
7. **Dependencies:** **OD-16** (qualification standard). **Independent of OD-13** — this is the
   one clinical-adjacent appointment that does not require a CGL first, which is precisely what
   makes Track B startable in parallel.
8. **Consequence of delay:** Track B does not start. The 583-session corpus continues to sit
   unanalysed, and the platform's standing "scores are not validated" position remains
   unchanged for another cycle with no path to changing it.
9. **Blocks implementation:** No.
10. **Blocks clinical validation:** No.
11. **Blocks educational validation:** No — §8 is assessment validity, distinct from §7.
12. **Blocks certification readiness:** **YES** — no reliability evidence without it.

---

### OD-25 · Authorize analysis of the production corpus (Track B) **[EXTRACTED]**

1. **ID:** OD-25
2. **Decision:** Authorize retrospective analysis of production session and report data for
   §8.4 Tier 1, and fix the handling constraints (aggregate-only, PHI-free, admin-boundary,
   no narrative export).
3. **Why it matters:** Tier 1 is described by both the readiness assessment and the protocol as
   **the cheapest available path from zero evidence to first evidence.** But it analyses real
   learner data. The patients are fictional so there is no patient PHI, but the data is about
   **identifiable trainees** — their transcripts and their scores. Protocol §11.3 and §8 impose
   aggregate-only, PHI-free handling by design; that design needs authorization, not merely
   documentation.
4. **Default/recommended:** Protocol §8.4 Tier 1 scope; §8.5 pre-registration; readiness
   assessment risk R-5 (aggregate-only, admin-only, no narrative export, mirroring the existing
   quality-ledger export discipline).
5. **Owner:** `Product Owner` **+** `Security/Governance` **+** `Legal/Compliance`.
6. **Expertise required:** Data governance; privacy; measurement input on what the analysis
   minimally requires.
7. **Dependencies:** **OD-10** `[LEGAL-UNKNOWN]` — if the analysis is ever framed as research or
   published, human-subjects obligations may attach. Tier 1 is *designed* to stay clear of that
   line, but nobody qualified has located the line.
8. **Consequence of delay:** Track B stalls even with a PR appointed. The corpus is the only
   evidence asset the programme currently owns.
9. **Blocks implementation:** No.
10. **Blocks clinical validation:** No.
11. **Blocks educational validation:** No.
12. **Blocks certification readiness:** **YES.**

---

### OD-27 · Forged `admin_test` remediation approach **[EXTRACTED]**

1. **ID:** OD-27
2. **Decision:** Choose the remediation shape for the P1 forged-`admin_test` finding (F-1), and
   resolve the F-5 contract ambiguity in writing first.
3. **Why it matters:** The readiness assessment confirmed against source that a therapist can
   direct-INSERT `clinical_snapshot.admin_test = true` (sessions INSERT RLS constrains only
   `therapist_id`), end the session, receive 403, and thereby **permanently evade assessment on
   their own session** — with the session also hidden from their own history. Three remediation
   shapes were identified and deliberately not pre-committed: validate the skip *before* closing
   status and refuse the close · fall through to the learner pipeline after auditing · constrain
   the snapshot at INSERT via trigger or RPC. **Only the third closes the vector rather than the
   symptom**, and it also covers the related surface where direct INSERT bypasses the `is_active`
   avatar check and the `start` rate limit. The choice has migration implications, so it must
   precede the code.
   F-5 must be resolved first: the Phase 3C contract says "do not skip" in §5.2 while the chosen
   rule is 403 — designing a fix against an ambiguous contract reproduces the ambiguity.
4. **Default/recommended:** None pre-committed. The protocol placed this out of scope
   (§2.2); the readiness assessment classified it **NON-BLOCKING for Phase 4 entry** but
   **blocking the moment scores carry consequence.**
5. **Owner:** `Engineering` **+** `Security/Governance`, with `CGL` consulted on whether a
   forged session should be assessed or refused.
6. **Expertise required:** RLS and Postgres trigger design; the Phase 3C architecture-test
   guardrails; security review.
7. **Dependencies:** F-5 wording resolution. Interacts with **OD-25** — analysing a corpus whose
   scores can be selectively evaded weakens every Tier 1 conclusion.
8. **Consequence of delay:** Track B's conclusions carry a caveat that cannot be removed
   retrospectively: the corpus may contain selective non-assessment. The defect is also live
   in production throughout.
9. **Blocks implementation:** **YES** — for the Track B hardening work specifically.
10. **Blocks clinical validation:** No — avatar validation does not depend on learner scoring.
11. **Blocks educational validation:** No.
12. **Blocks certification readiness:** **YES.**

---

## 4. P1 decisions

Each entry carries all twelve fields in compressed form.

### OD-2 · Evidence retention period **[§20]**

**Decision:** Set the retention period for validation evidence packages, including full
transcripts. · **Why:** §11.3 leaves it unset because it depends on PD-3, which the readiness
assessment held must not be invented. Evidence packages contain full transcripts and reviewer
identities; without a period, data accumulates with an undefined lifecycle. · **Default:** None
— deliberately. · **Owner:** `Product Owner` (with `Security/Governance`, `Legal/Compliance`). ·
**Expertise:** Data governance; product. · **Dependencies:** PD-3 (pre-existing, open). ·
**Delay:** Evidence storage (P1-1) cannot be designed; manual packages accumulate under no
policy. · **IMPL:** Partial (blocks P1-1 only) · **CLIN:** No · **EDU:** No · **CERT:** Yes.

### OD-3 · How the ER obtains a report for E9 **[§20]**

**Decision:** Decide how the Educational Reviewer obtains a generated assessment report for
domain E9, given that admin-test sessions deliberately produce none. · **Why:** §7.3 requires
all J-domains ≥3, including E9, so no avatar reaches V4 without it. Options — a non-admin-test
review session, or an admin-only report preview — have different isolation implications, and the
first would create a scored session against a `testing` avatar. · **Default:** None; §17.4 P1-6
records it as a design decision, not a defect. · **Owner:** `CGL` + `Product Owner`
(`Engineering` consulted). · **Expertise:** Educational + isolation-architecture. ·
**Dependencies:** OD-13, OD-20. · **Delay:** Educational review incomplete; V4 unreachable. ·
**IMPL:** Partial · **CLIN:** No · **EDU:** Yes · **CERT:** Yes.

### OD-4 · Conditional approval state **[§20]**

**Decision:** Whether a time-limited or restricted approval state exists between NOT APPROVED
and APPROVED. · **Why:** §5.3 currently permits no conditional publication. Operationally a
restricted approval may be necessary (e.g. approved English-only, or approved for supervised
use); it also erodes the gate, and erosion is the normal fate of gates under delivery pressure.
· **Default:** Protocol default is **no conditional state.** · **Owner:** `Joint Governance` +
`CGL`. · **Expertise:** Governance + clinical. · **Dependencies:** OD-17, OD-24. · **Delay:**
Avatars failing on one narrow domain are blocked entirely, creating pressure to relax thresholds
informally — the worst outcome. · **IMPL:** Partial · **CLIN:** No · **EDU:** No · **CERT:** Yes.

### OD-5 · Model/prompt change re-review policy **[§20]**

**Decision:** Confirm or revise Rule 12.7.2 — that a model, provider, or prompt-engine change
invalidates the behavioural half of every approval platform-wide. · **Why:** **This is the most
likely cause of mass re-review on the platform.** Behavioural domains (B, C, G, H, I) were
validated against a specific generation configuration. With `gpt-5` as the default and
provider-side changes possible without notice, every behavioural approval could silently
invalidate. A programme with 7–9 part-time reviewers cannot absorb an unplanned full re-review.
· **Default:** Rule 12.7.2 as written; the clinical-record half (A) survives. · **Owner:** `CGL`
+ `Joint Governance` (`Engineering` on change detection). · **Expertise:** Clinical + platform.
· **Dependencies:** OD-13, OD-1. · **Delay:** Approvals may be silently invalid with no one
aware; or, conversely, the rule triggers an unaffordable re-review with no phasing policy. ·
**IMPL:** No · **CLIN:** Yes · **EDU:** No · **CERT:** Yes.

### OD-18 · Appoint Arabic Clinical Reviewers **[EXTRACTED]**

**Decision:** Appoint 2 × ACR, or explicitly defer bilingual validation and record the
consequence. · **Why:** Protocol rule R-3 — English validation never transfers to Arabic; §13
is a full re-run, never a delta review, and ACR sign-off on D11 and AR1–AR12 is **non-delegable
to a non-native reviewer**. Bilingual parity is a core product claim, and per the readiness
assessment it is the highest-risk entirely unexamined surface. AR12 (clinical equivalence) is
the only domain that tests whether the claim is true. · **Default:** §19.8 permits explicit
deferral **provided no bilingual-parity claim is made in the interim.** · **Owner:** `CGL` +
`Product Owner`. · **Expertise:** CR-equivalent **and** native/near-native Levantine Arabic
**and** clinical practice conducted in Arabic. Likely the hardest role to fill. ·
**Dependencies:** OD-13, OD-16. Gates OD-7. · **Delay:** No Arabic avatar can be approved;
bilingual claims must be suspended. · **IMPL:** No · **CLIN:** Partial (Arabic only) · **EDU:**
No · **CERT:** Yes. · **Conditional:** **P0 if bilingual validation is in Phase 4 scope.**

### OD-19 · Appoint Voice/Speech Reviewer **[EXTRACTED]**

**Decision:** Appoint a VR for §14 technical voice QA (V1–V8), or defer voice validation. ·
**Why:** V1–V8 are measurement tasks (intelligibility, latency, turn-taking, interruption,
audio-transcript divergence). V7 — audio saying something the transcript does not — is a
distinct hallucination class from D15 and matters because the transcript is what the trainee is
scored against. The protocol expects V6 to surface a **platform** defect (RT-06 interruption
wiring) rather than an avatar defect. · **Default:** §19.10 permits deferral **provided no
voice-quality claim is made.** · **Owner:** `CGL` + `Engineering`. · **Expertise:** Speech
technology or phonetics; **may be non-clinical** — the CR retains clinical voice congruence
(V9–V13). · **Dependencies:** OD-16. · **Delay:** No voice-enabled avatar fully validated; since
all current avatars are voice-enabled, this constrains every approval. · **IMPL:** No ·
**CLIN:** Partial · **EDU:** No · **CERT:** Yes.

### OD-23 · Ratify the change-classification table **[EXTRACTED]**

**Decision:** Ratify or revise §12.2 — which field changes are ADMINISTRATIVE / MINOR / MAJOR /
FULL REVALIDATION — plus Rule 12.3.1 (§15 safety battery runs on **every** MAJOR) and Rule
12.3.2 (ambiguity resolves **upward**). · **Why:** Determines re-review load, and therefore
whether the programme is sustainable. Rule 12.3.1 is the one that will be argued against
("the change wasn't safety-related") and is precisely the reasoning that lets a safety
regression through — safety behaviour is emergent from the whole configuration. ·
**Default:** §12.2 table as written. · **Owner:** `CGL`. · **Expertise:** Clinical judgement on
which fields change patient behaviour. · **Dependencies:** OD-13, OD-14 (the table is
unenforceable without a version identifier). · **Delay:** Post-approval edits have no defined
review consequence; approved avatars drift silently. · **IMPL:** No · **CLIN:** No · **EDU:** No
· **CERT:** Yes.

### OD-11 · Legacy avatar grandfathering deadline **[§20]**

**Decision:** Set the deadline by which the five currently published avatars, entering as
V-LEGACY, must complete full review. · **Why:** §10.2 grandfathers them rather than retro-failing
them — retro-invalidating production content would be gratuitous and would guarantee the
protocol is resisted. But grandfathering without a deadline is permanent exemption, and these
five are the avatars actually in learner use. · **Default:** §12.6 requires a Board-set deadline;
none proposed. · **Owner:** `Joint Governance`. · **Expertise:** Governance + reviewer-capacity
planning. · **Dependencies:** OD-13, OD-1, and reviewer capacity (OD-16, OD-18, OD-20). ·
**Delay:** The only avatars in live use remain the only ones never validated. · **IMPL:** No ·
**CLIN:** No · **EDU:** No · **CERT:** Yes.

### OD-7 · Ratify the Arabic opening prompt **[§20]**

**Decision:** Ratify, revise, or replace the §6.2 Arabic standardized opening
(`أهلاً، سعيد بحضورك اليوم. شو اللي جابك اليوم؟`). · **Why:** The opening is fixed across all
protocol sessions so first-turn behaviour is comparable; it deliberately uses Levantine
colloquial rather than MSA to match the `ar-JO` authored register. **It was proposed by a
non-native author and the protocol states explicitly it must not be treated as settled.**
Register and dialect choice materially affect what the patient does on turn one — which is the
clean test of D2 salience behaviour. · **Default:** As drafted, explicitly provisional. ·
**Owner:** `Arabic Clinical Reviewer` (ratification), `CGL` (adoption). · **Expertise:** Native
Levantine Arabic + clinical register. · **Dependencies:** **OD-18** — cannot be resolved before
an ACR exists. · **Delay:** No Arabic protocol session can be run to a comparable standard. ·
**IMPL:** No · **CLIN:** Partial · **EDU:** No · **CERT:** Yes.

### OD-9 · `[LEGAL-UNKNOWN]` — consequential-scores regulatory position **[§20]**

**Decision:** Obtain a legal position on whether assessment-instrument obligations attach if
VPsych output is used for credentialing, licensure, progression, or any consequential judgement
about a trainee. · **Why:** The current admin-only report posture reduces exposure; a change to
it would be the trigger. The protocol flags this rather than guessing, and §2.3 states plainly
that no regulatory analysis exists in the repository. · **Default:** None — **must not be
guessed.** · **Owner:** `Legal/Compliance`. · **Expertise:** Regulatory counsel in the relevant
jurisdiction. · **Dependencies:** Requires a jurisdiction determination, which also does not
exist. · **Delay:** Any move to consequential use proceeds without knowing its obligations. ·
**IMPL:** No · **CLIN:** No · **EDU:** No · **CERT:** Yes.

### OD-10 · `[LEGAL-UNKNOWN]` — human-subjects obligations **[§20]**

**Decision:** Obtain a position on whether ethics approval and informed consent obligations
attach to analysis or publication of pilot data from identifiable trainees. · **Why:** §8 Tier 1
is designed aggregate-only and PHI-free specifically to stay clear of this line — but nobody
qualified has located the line. Tier 2 (expert re-rating of stored transcripts) moves closer;
publication crosses it. · **Default:** None. · **Owner:** `Legal/Compliance` + ethics authority.
· **Expertise:** Research-ethics and data-protection counsel. · **Dependencies:** Interacts with
**OD-25.** · **Delay:** Tier 2+ cannot proceed with confidence; no analysis can be published. ·
**IMPL:** No · **CLIN:** No · **EDU:** No · **CERT:** Yes.

---

## 5. P2 and P3 decisions

### OD-8 · Six unpackaged disorders — sequencing **[§20]** · P2

**Decision:** Whether `pdd`, `socialAnxiety`, `ocd`, `asd`, `schizoaffective`, `eating` are
authored before or after the protocol has been exercised. · **Why:** Authoring first risks
producing six avatars against unproven criteria; exercising first delays catalog completion.
17 disorder IDs are declared, 11 have packages. · **Default:** Readiness assessment recommends
content work follow the review and coherence gates (C-14 after C-3/C-4). · **Owner:**
`Joint Governance` + `CGL`. · **Expertise:** Clinical + product roadmap; `asd` and `eating`
need specialists (Rule 4.4.2). · **Dependencies:** OD-26, OD-17. · **Delay:** Catalog stays at
11 of 17; no validation impact. · **IMPL:** No · **CLIN:** No · **EDU:** No · **CERT:** No.

### OD-12 · Can D13 be validated without a structured medication model? **[§20]** · P2

**Decision:** Whether domain D13 (medication behavior) can be meaningfully validated while
medication content remains prose, or whether CLIN-S3-04 must be closed first. · **Why:** D13's
critical failure is invention of a medication, dose, or effect not in the authored record —
**the highest-consequence hallucination class the platform can produce.** But with prose-only
medication content, the reviewer frequently has no authored ground truth to check against, so
"not in the record" is often undecidable. · **Default:** Protocol §5 D13 flags it as a
high-risk domain with weak ground truth. · **Owner:** `CGL`, with prescriber-qualified CR. ·
**Expertise:** Prescriber. · **Dependencies:** OD-13, OD-26. · **Delay:** D13 verdicts carry
low confidence; medication-bearing avatars validated on a weaker basis than the rest. ·
**IMPL:** No · **CLIN:** Partial · **EDU:** No · **CERT:** Yes.

### OD-6 · Calibrate the 24-month and 20% thresholds **[§20]** · P3

**Decision:** Empirically revise the 24-month re-review interval (§12.7.1) and the 20%
adjudication-rate trigger (§9.5.2). · **Why:** Both are explicitly `[GOV]` values **with no
empirical basis**, stated as such in the protocol. 24 months was chosen to be long enough not
to swamp a small reviewer pool and short enough that nothing runs unreviewed indefinitely;
20% was chosen to detect under-specified criteria. Neither is evidenced. · **Default:** As
proposed, pending data. · **Owner:** `CGL` + `Psychometrician`. · **Expertise:** Clinical +
measurement. · **Dependencies:** **Requires operating data that does not yet exist** — this
decision is genuinely unresolvable until the programme has run. · **Delay:** None material;
provisional values are usable and honestly labelled. · **IMPL:** No · **CLIN:** No · **EDU:**
No · **CERT:** No.

---

## 6. Owner category summary

| Owner category | Decisions owned or co-owned | Count |
|---|---|---:|
| **CGL** | OD-3, 5, 6, 12, 14, 15, 16, 17, 18, 19, 20, 22, 23, 24*, 26 | 15 |
| **Joint Governance** | OD-1, 4, 5, 8, 11, 13, 15, 21, 22, 24 | 10 |
| **Product Owner** | OD-2, 3, 8*, 18, 20, 25 | 6 |
| **Engineering** | OD-14, 19, 27 (+OD-3, OD-5 consulted) | 3 |
| **Legal/Compliance** | OD-9, 10, 25 | 3 |
| **Security/Governance** | OD-15, 25, 27 (+OD-2) | 3 |
| **Clinical Reviewer** | OD-26 (input), OD-12 (prescriber) | 2 |
| **Psychometrician** | OD-6, OD-21 (subject) | 2 |
| **Educational/Training Expert** | OD-3, OD-20 (subject) | 2 |

\* co-owned. Counts exceed 27 because most decisions are jointly owned.

**The CGL owns or co-owns 15 of 27 decisions — 56%.** This is the register's central
structural finding: **the majority of Phase 4's open decisions are owned by a role that does
not exist.** Appointing the CGL (OD-13) does not merely unblock one decision; it converts more
than half the register from unownable to actionable.

---

## 7. Dependency graph

### 7.1 Root chain

```
OD-13  APPOINT CGL   ← root; nothing clinical precedes it
  │
  ├─→ OD-1   adopt protocol ──────────────┬─→ OD-24 approval authority
  │                                       ├─→ OD-11 grandfathering deadline
  │                                       └─→ OD-5  model-change policy
  │
  ├─→ OD-16  reviewer qualification ──────┬─→ OD-18 appoint ACR ──→ OD-7 Arabic prompt
  │                                       ├─→ OD-19 appoint VR
  │                                       ├─→ OD-20 appoint ER ───→ OD-3 E9 report access
  │                                       └─→ OD-21 appoint PR
  │
  ├─→ OD-17  pass thresholds ─────────────→ OD-4 conditional approval
  ├─→ OD-22  adjudication model
  ├─→ OD-26  D1 coherence checklist ──────→ OD-12 D13 medication · OD-8 six disorders
  ├─→ OD-15  safety incident procedure
  └─→ OD-14  version identifier ──────────→ OD-23 change-classification table

INDEPENDENT OF OD-13 (Track B):
  OD-21 appoint PR   ─┐
  OD-25 corpus authz ─┼─→ Tier 1 analyses
  OD-27 forged fix   ─┘
  OD-10 human-subjects (legal) ─→ constrains OD-25 scope
  OD-9  consequential scores (legal)
```

### 7.2 Gate matrix — what must precede each milestone

| Milestone | Required decisions | Count |
|---|---|---:|
| **A · Software implementation** (P0-1 transcript surface, P0-2 version identifier) | **OD-13, OD-1, OD-14** · **+OD-27** if Track B hardening in scope | **3–4** |
| **B · Clinical validation** (first avatar to V3) | OD-13, OD-1, OD-14, OD-16, OD-17, OD-22, OD-24, OD-26, OD-15 · +OD-18/OD-7 if bilingual · +OD-19 if voice · +OD-5 | **9–13** |
| **C · Educational validation** (first avatar to V4) | All of B **+** OD-20, OD-3 | **11–15** |
| **D · Psychometric analysis** (Tier 1 complete) | OD-21, OD-25 · +OD-27 for uncaveated conclusions · +OD-10 if framed as research | **2–4** |
| **E · Structured pilot** | All of B and C **+** OD-2, OD-4, OD-11, OD-23, OD-9, OD-10 | **17–21** |
| **F · Certification readiness** | **All 27 except OD-8 and OD-6** | **25** |

### 7.3 Observations from the graph

**The graph has two roots, not one.** OD-13 roots the clinical branch; Track B (OD-21, OD-25,
OD-27) has no dependency on it. This is the programme's only structural hedge against slow
clinical recruitment, and it should be treated as such rather than sequenced behind Track A out
of habit.

**Milestone A is remarkably shallow — three decisions.** The transcript review surface (P0-1)
is almost decision-free: it reads `session_messages` rows that already persist and displays
them to an admin. Only the version identifier (P0-2) carries a genuine clinical dependency,
through OD-14.

**Milestone D is the cheapest real evidence.** Two decisions and one appointment stand between
the programme and its first empirical findings, against a corpus that already exists.

**OD-6 is the only decision that cannot be resolved now** — it requires operating data the
programme has not yet generated. It is correctly P3 and should not be treated as an outstanding
task.

---

## 8. Human resource gap

**No individuals are named. The repository can establish none for any role.**

| Role | Why required | Decisions owned | Minimum expertise | Identified? | Status |
|---|---|---|---|---|---|
| **Clinical Governance Lead** (CGL) | Owns the protocol; sole non-delegable approval at V5; authors clinical content | **15 of 27** — OD-3, 5, 6, 12, 14, 15, 16, 17, 18, 19, 20, 22, 23, 24, 26 | Senior licensed clinician, 10+ yrs, governance authority, no authoring conflict | **NO** | **UNFILLED — root blocker** |
| **Clinical Reviewer ×2** (CR) | Validation objects A, B, C, I; independent blind review | Input to OD-26; execute OD-17, OD-22 | Licensed clinician, 3+ yrs independent practice, disorder-specific experience | **NO** | **UNFILLED** |
| **Prescriber-qualified CR** (CR-Rx) | Domain D13; organic/medical differentials (`delirium`, `bipolarMania`, `schizophrenia`, `aud`) | OD-12 | Prescriber (psychiatrist or equivalent) | **NO** | **UNFILLED** |
| **Arabic Clinical Reviewer ×2** (ACR) | Validation object H; **non-delegable**; AR1–AR12 incl. clinical equivalence | OD-7; co-owns OD-18 | CR-equivalent **+** native/near-native Levantine Arabic **+** clinical practice in Arabic | **NO** | **UNFILLED — hardest to fill** |
| **Educational Reviewer** (ER) | Validation object D; non-delegable verdict at V4 | Subject of OD-20; co-owns OD-3 | 3+ yrs psychotherapy supervision or clinical education | **NO** | **UNFILLED — blocks all V5 approvals** |
| **Psychometric Reviewer** (PR) | Validation objects E, F; §8 Tier 1 design and execution | Subject of OD-21; co-owns OD-6 | Graduate psychometrics/statistics + applied experience | **NO** | **UNFILLED — roots Track B** |
| **Expert raters ×2** | §8 Tier 2 inter-rater reliability | — | Qualified to rate therapist competence; blind to model scores | **NO** | **UNFILLED — Tier 2 only** |
| **Voice/Speech Reviewer** (VR) | §14 technical QA V1–V8 | Subject of OD-19 | Speech technology or phonetics; **may be non-clinical** | **NO** | **UNFILLED** |
| **Adjudicator** (ADJ) | Split verdicts (§9.5) | Executes OD-22 | Senior CR, 7+ yrs + supervisory, uninvolved in the review | **NO** | **UNFILLED — on-demand** |
| **Disorder specialists** | The 6 unpackaged disorders; `asd` and `eating` especially | Input to OD-8 | Specialist clinical experience in the specific disorder | **NO** | **UNFILLED — deferred** |
| **Legal/Regulatory counsel** | OD-9, OD-10 `[LEGAL-UNKNOWN]` | OD-9, OD-10, input OD-25 | Regulatory + research-ethics counsel in the relevant jurisdiction | **NO** | **UNFILLED — not previously registered as a role** |

### 8.1 Notes

**Minimum viable Track A: 4 distinct individuals** — 2 × CR + 1 × ER + 1 × CGL, where the CGL
may be a third CR but may not be one of the two rating CRs (§4.5). Add 2 × ACR for bilingual,
1 × VR for voice.

**Minimum viable Track B: 1 individual** — the PR. This is the entire reason Track B is the
recommended parallel start.

**Legal/Compliance is newly registered here as a required role.** Protocol §18 lists ten
reviewer roles and does not include counsel, yet OD-9 and OD-10 are both registered
`[LEGAL-UNKNOWN]` decisions with no other possible owner. The gap follows from §18 having been
scoped to *reviewer* roles.

---

## 9. Final recommendation — the smallest set to resolve before any Phase 4 code

The two P0 software items are **P0-1** (Admin Test transcript review surface) and **P0-2**
(avatar content version identifier). Working backwards from what each actually requires:

**P0-1 is nearly decision-free.** It reads `session_messages` rows that already persist and
renders them behind the existing `is_admin()` boundary. It does not depend on retention
(OD-2 — it changes no lifecycle, only adds a read path), on thresholds (OD-17), on approval
authority (OD-24), or on the coherence checklist (OD-26).

**P0-2 has exactly one blocking input** — OD-14, which needs a CGL (OD-13).

### The minimum set: **three decisions**

| # | Decision | Why it must precede code |
|---|---|---|
| **1** | **OD-13 — Appoint the Clinical Governance Lead** | Root of the graph. OD-14 cannot be resolved without a clinical authority to define materiality, and OD-14 gates P0-2. Also converts 15 of 27 decisions from unownable to actionable. |
| **2** | **OD-1 — Adopt the protocol (with the DEF-1 correction)** | Without it, code implements an unauthorized specification and `RELEASE_GOVERNANCE.md` has no RDL row authorizing the work. |
| **3** | **OD-14 — Define version-identifier scope** | The only decision that directly gates a P0 software item's design. Deciding it after implementation means either rework or a hash whose clinical materiality was set by engineering. |

**Add a fourth only if Track B hardening is in Phase 4 scope:**

| **4** | **OD-27 — Forged `admin_test` remediation approach** | Choice of remediation shape determines whether a migration is required; and F-5's contract ambiguity must be resolved in writing before the fix is designed. |

### Why nothing else belongs in this set

Every other P0 decision gates **validation**, not **code**. OD-16, OD-17, OD-22, OD-24 and
OD-26 determine how reviews are conducted and judged — all executable offline, and all
resolvable while P0-1 and P0-2 are being built. OD-15 gates running the safety battery. OD-20
and OD-21 are appointments that gate their respective tracks' *execution*.

This matters because of the protocol's own §17.2 finding: **the human protocol is not blocked
on engineering.** The corollary holds in reverse — the two P0 software items are not blocked on
the human protocol, except through OD-14. Sequencing all thirteen P0 decisions ahead of any
code would stall both tracks on a recruitment problem when only one decision genuinely requires
it.

### Recommended sequence

1. **OD-13** — appoint the CGL. Everything clinical follows; nothing substitutes.
2. **RDL-034** (Phase 3 acceptance, per protocol §16.3) — trivial, zero risk, removes a live
   governance inconsistency. Can run immediately and in parallel.
3. **OD-1** — adopt the protocol as RDL-035, incorporating DEF-1.
4. **OD-14** — CGL + Engineering define version-identifier scope.
5. **Code may begin** on P0-1 and P0-2.
6. **In parallel from step 1:** OD-21 and OD-25 to start Track B, which needs neither the CGL
   nor step 4.
7. **While code is written:** OD-16, OD-17, OD-22, OD-24, OD-26, OD-15, OD-20.

**The single highest-value action remains OD-13.** It is the root of the clinical branch, it
owns 56% of the register, and it is the one decision that no other party can make on the CGL's
behalf — including the decision of who the CGL should be.

---

## Final Status

```text
PROTOCOL:
v1.0-DRAFT  (PROPOSED — NOT ADOPTED)

OPEN DECISIONS:
27   (12 registered in protocol §20 · 15 extracted from the protocol body)

P0 DECISIONS:
13

P1 DECISIONS:
11

CLINICAL GOVERNANCE LEAD:
NOT IDENTIFIED

PHASE 4 IMPLEMENTATION:
NOT STARTED

APPLICATION:
UNCHANGED

DATABASE:
UNCHANGED

PRODUCTION:
UNCHANGED

PR:
NOT CREATED

STOP.
```

*(P2: 2 · P3: 1. Total 13 + 11 + 2 + 1 = 27.)*

---

### Appendix A — provenance map

| ID | Provenance | Protocol reference |
|---|---|---|
| OD-1 … OD-12 | **[§20]** registered | Protocol §20 table |
| OD-13 | **[EXTRACTED]** | §18.3 binding constraint · §19.5 entry criterion |
| OD-14 | **[EXTRACTED]** | §12.1.1 Rule · §17.3 P0-2 |
| OD-15 | **[EXTRACTED]** | §16.2 gap · Rule 15.3.4 reference |
| OD-16 | **[EXTRACTED]** | §4.3, §4.4, §4.2.1 — all `[GOV]` |
| OD-17 | **[EXTRACTED]** | §5.3 `[GOV]` · Rule 5.1.1 |
| OD-18 | **[EXTRACTED]** | §19.8 entry criterion · §18.1 |
| OD-19 | **[EXTRACTED]** | §19.10 entry criterion · §18.1 |
| OD-20 | **[EXTRACTED]** | §19.7 entry criterion · §18.1 |
| OD-21 | **[EXTRACTED]** | §19.9 entry criterion · §18.1 |
| OD-22 | **[EXTRACTED]** | §9.3, §9.5 `[GOV]` — Rules 9.3.1, 9.5.1 |
| OD-23 | **[EXTRACTED]** | §12.2 table · §12.3 `[GOV]` |
| OD-24 | **[EXTRACTED]** | §10.3 `[GOV]` · Rule 10.3.1 |
| OD-25 | **[EXTRACTED]** | §8.4 Tier 1 · §17.6 Track B · §11.3 |
| OD-26 | **[EXTRACTED]** | §5 D1 · §19.11 entry criterion |
| OD-27 | **[EXTRACTED]** | Protocol §2.2 (out of scope) · Readiness assessment §9.2, C-1 |

### Appendix B — verification

Extraction verified against the protocol source: 12 `OD-` rows in §20 · 33 `[GOV]` markers ·
5 `[LEGAL-UNKNOWN]` markers · 10 `NOT IDENTIFIED` role rows in §18.1 · DEF-1 confirmed by
reading §19.4 against the §20 table.

Repository state confirmed unchanged: `git status` shows no modification to `src/`,
`supabase/`, or any existing document. No code, schema, migration, deployment, production data,
or pull request was created by this analysis.
