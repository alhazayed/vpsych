# VPsych — Phase 4 Board Decision Paper

**Document type:** Decision paper for human governance. Documentation only.
**Date:** 2026-08-15 (UTC)
**Repository state:** `main` @ `1a83424`
**Purpose:** to allow the applicable governance authority to make four unresolved decisions
explicitly.

**Sources (all present on `main`):**
`docs/VPsych_PHASE4_READINESS_ASSESSMENT.md` ·
`docs/VPsych_PHASE4_VALIDATION_GOVERNANCE_AND_PROTOCOL.md` ·
`docs/VPsych_PHASE4_OPEN_DECISIONS_REGISTER.md` ·
`docs/RELEASE_GOVERNANCE.md` · `docs/RELEASE_DECISION_LOG.md`

---

> ## Governance boundary
>
> **No engineering implementation begins from this paper until the applicable governance
> decisions have been formally recorded.**
>
> This paper is **not** a Release Decision Log entry.
> This paper is **not** protocol adoption.
> This paper is **not** authorization for P0-2 or P1-2 implementation.
>
> It resolves nothing. It presents four decisions for an authority to make.

---

## 0. Standing facts (verified on `main` @ `1a83424`)

| Item | State |
|---|---|
| `VP-CLIN-PROTOCOL v1.0-draft` | **PROPOSED — NOT ADOPTED** |
| Clinical Governance Lead | **NOT IDENTIFIED** |
| Open decisions register | 27 open · 13 P0 · 11 P1 · 2 P2 · 1 P3 |
| `RELEASE_DECISION_LOG.md` | 33 rows, last entry **RDL-033** |
| P0-1 — Admin Test transcript review surface | **DELIVERED** (merged, in production) |
| P0-2 — Avatar content version identifier | **NOT STARTED** |
| P1-2 — Clinical sign-off gate | **NOT STARTED** |

### 0.1 Terminology — read before the decisions

A terminology collision was identified and traced. It is recorded here so it does not recur.

| ID | Meaning | Source |
|---|---|---|
| **P0-1** | Admin Test transcript review surface | Protocol §17.3 |
| **P0-2** | **Avatar content version identifier** | Protocol §17.3 |
| **P1-2** | **Clinical sign-off gate** (`testing → published` precondition) | Protocol §17.4 |
| **C-3** | Avatar clinical review + sign-off gate — **the same underlying object as P1-2** | Readiness assessment |

> ### ⚠ **P0-2 is NOT the clinical sign-off gate.**
> **P0-2 = avatar content version identifier.**
> **P1-2 = clinical sign-off / `testing → published` gate.**

Note also that `P0`/`P1` serve separately as **priority classes** on the 27 `OD-` decisions.
`P0-2` (an implementation item ID) and `P0` (a priority class) are different namespaces.

---

# DECISION 1 — OD-13 · Appointment of a Clinical Governance Lead

### Current state

**The Clinical Governance Lead is NOT IDENTIFIED.**

### Decision statement (verbatim from the register)

> *"Appoint a named Clinical Governance Lead with programme authority to own
> `VP-CLIN-PROTOCOL`, author its clinical content, approve avatars, and amend the protocol."*

### Source

Register OD-13 · Protocol §4.3, §4.5, §10.3, §12.3.2, §18.1, §18.3, §19.11

### Qualification requirements (Protocol §4.3, verbatim)

| Role | Minimum |
|---|---|
| CGL | **10 years** + governance/programme authority |

The register adds: senior licensed mental-health clinician; no authoring conflict on existing
avatars.

### Authority and responsibilities (source-stated)

- **Approval at V5 — sole authority, non-delegable** (§10.3)
- Authoring the D1 diagnostic coherence checklist (§19.11)
- Threshold ratification (§9, §12.7)
- Change classification — §12.3.2: *"Where class is ambiguous, the CGL decides and records
  reasoning. Ambiguity resolves **upward**, never downward."*
- Protocol amendment, jointly with a Board RDL row (§10.3)
- Emergency withdrawal authority (§10.3)

### Conflict-of-interest requirements (Protocol §4.5)

- **Rule 4.5.1 — Author exclusion.** A reviewer may not review an avatar they authored or
  materially contributed to. *"This is absolute and admits no waiver."*
- **Rule 4.5.3 — Engineering exclusion.** Engineering may not hold CR, ER, PR, ADJ, or CGL.
- **Rule 4.5.4 — Commercial independence.** Declared financial interest must be recorded.
- **Rule 4.5.5 — Declaration is mandatory and recorded**, per avatar.

### Why it matters (source-stated)

The register: *"Every other clinical decision in this register is either owned by the CGL or
requires CGL input."*
The protocol: *"Without a CGL, this document is a proposal with no owner — including its own
open decisions."*

### Options

| | Option | Consequence (source-stated) |
|---|---|---|
| **A** | **APPOINT** a CGL meeting §4.3 | Unlocks OD-14, OD-16, OD-17, OD-22, OD-23, OD-26, OD-12. Track A can proceed |
| **B** | **DO NOT APPOINT** | *"Total stall of Track A… delay here delays code, not merely process."* Track B (OD-21, OD-25, OD-27) is unaffected |

No third option is supported by the source.

### Dependencies

*"None. This is the root of the dependency graph."*

### What remains unresolved after this decision

- The **appointment mechanism** — Protocol §18.1 states the protocol *"proposes no appointment
  mechanism."* **NOT ESTABLISHED IN REPOSITORY.**
- Every substantive clinical decision the CGL then owns.
- Whether the CGL may hold any concurrent role, subject to §4.5.

### Required evidence

Evidence of qualification against §4.3 · signed conflict-of-interest declaration (Rule 4.5.5) ·
a record of the authority under which the appointment was made.

### Decision record fields

```
OD-13 · Clinical Governance Lead
Decision:          [ ] APPOINT      [ ] DO NOT APPOINT
Appointee:         ______________________________
Qualification:     ______________________________   (evidence vs §4.3)
Conflicts:         ______________________________   (declared / none)
Appointing body:   ______________________________
Effective date:    ______________________________
```

**No person is proposed in this paper. No appointing body is named — the repository
establishes none.**

---

# DECISION 2 — C-3 vs P1-2 priority conflict

### The conflict

Two documents, both now on `main`, classify the **same underlying object** differently.

| Document | ID | Object | Priority |
|---|---|---|---|
| `VPsych_PHASE4_READINESS_ASSESSMENT.md` | **C-3** | Avatar clinical review + sign-off gate | **P0** |
| `VPsych_PHASE4_VALIDATION_GOVERNANCE_AND_PROTOCOL.md` §17.4 | **P1-2** | Clinical sign-off gate | **P1** |

**Readiness assessment**, verbatim: *"C-3 · Avatar clinical review + sign-off gate"*, listed
among *"the five P0 items"*.

**Protocol §17.4**, verbatim: *"P1-2 · Clinical sign-off gate (the `testing → published`
precondition, §10.2). … Note this is P1, not P0 — a documented process gate is sufficient for a
small programme, and encoding it before the protocol has been exercised risks encoding the
wrong thing."*

The protocol acknowledges divergence from the assessment in §17.6 (*"The derived ordering
differs from the assumed one — twice"*) but does not address this item.

### Terminology restated

**P0-2 is NOT the clinical sign-off gate.**
**P0-2 = avatar content version identifier. P1-2 = clinical sign-off gate.**

### Options

| | Option | Implementation consequence |
|---|---|---|
| **A** | **C-3 governs → P0** | The sign-off gate is built early, alongside P0-2. **OD-24 becomes near-term**, since OD-24 gates P1-2 |
| **B** | **P1-2 governs → P1** | The gate follows protocol exercise; enforced meanwhile by process discipline. **OD-24 is deferred** |
| **C** | **Amend / reconcile the source documents** | One classification stands; the other document is amended so a single priority is authoritative. Requires deciding which document is amended |

### Dependencies

None. Resolvable without an appointed CGL — though the register marks clinical input as
preferable.

### What remains unresolved after this decision

- OD-24's urgency (near-term under A; deferred under B).
- Whether OD-4 (conditional approval state, currently P1, unresolved) must precede P1-2.
- Under option C, which document is amended and by whom.

### Required evidence

The two source passages above. No further evidence is required to make this decision.

### Decision record fields

```
C-3 / P1-2 priority conflict
Governing classification:  [ ] C-3 (P0)   [ ] P1-2 (P1)   [ ] AMEND
Document to amend:         ______________________________
Effect on OD-24:           [ ] near-term  [ ] deferred
```

**This paper does not select between C-3 and P1-2.**

---

# DECISION 3 — OD-1 · Adoption of `VP-CLIN-PROTOCOL v1.0`

> ### The protocol is currently **PROPOSED — NOT ADOPTED**
> Protocol line 5, verbatim: *"**Status:** **PROPOSED — not adopted.** Requires a Release
> Decision Log row to become binding."*
>
> **Nothing in this paper changes that status.**

### Decision statement (verbatim from the register)

> *"Board decision to adopt the protocol as binding, reject it, or adopt with amendment —
> recorded as RDL-035. Must incorporate the DEF-1 correction (§1.3)."*

*(The RDL number referenced in that quotation is the register's own proposal. See §"Governance
Record Issue" below — it is unresolved and is not allocated by this paper.)*

### Source

Register OD-1 · Protocol §1.3, §2.3, §16.3, §19

### Why it matters (source-stated)

> *"Until adopted, none of its `[GOV]` standards bind, no reviewer has authority, and any
> software built to enforce it implements an unauthorized specification."*

`RELEASE_GOVERNANCE.md`: *"Each transition requires an RDL row with evidence paths."*

### Options

| | Option | Consequence |
|---|---|---|
| **A** | **ADOPT** as binding | All `[GOV]` standards bind — see "What becomes binding" below |
| **B** | **REJECT** | Track A has no governing protocol; P0-2 has no specification |
| **C** | **ADOPT WITH AMENDMENT** | As A, less the amended clauses |

### What becomes binding if adopted (source-stated)

§4 reviewer qualifications, panel composition and conflict rules · §5 sixteen clinical domains
and three rating instruments · §6 admin-test session matrix, fixed opening prompt and
prohibited leading behaviours · §7 educational domains · §8 four-tier psychometric plan
**including Rule 8.1.1's standing prohibition on validity claims** · §9 adjudication (no
majority voting; critical failures not votable) · §10.2 V0–V6 governance overlay and §10.3
approval authority · §11 evidence package · §12 change control **including Rule 12.7.2** (a
model or prompt change invalidates every behavioural approval platform-wide) · §13 Arabic
validation · §14 voice validation · §15 safety battery.

### DEF-1 — must be addressed under any adopting option

**Do not silently correct this.** The protocol contains an internal inconsistency:

> **§19.4** requires that *"Open decisions §20 OD-1…OD-8"* each be resolved or explicitly
> deferred.
> **§20** registers **OD-1…OD-27**.

The entry criteria therefore under-specify by nineteen decisions, including both
`[LEGAL-UNKNOWN]` flags. Under Option A or C the Board must record whether DEF-1 is
incorporated.

### Dependencies

Register OD-1, verbatim: *"**OD-13 should precede it.** A protocol adopted before its owner
exists is adopted by parties who cannot operate it."*
Register OD-1 item 6: *"adopting a clinical protocol with no clinical authority appointed
inverts the document's own central control (§4.5.3)."*

### What remains unresolved after this decision

**All 26 other open decisions.** Adoption resolves none of them.

### Required evidence

The protocol document (on `main` since `1a83424`) · the DEF-1 determination · **an RDL entry**.

### Adoption requires an RDL entry

Protocol line 5 and `RELEASE_GOVERNANCE.md` both make an RDL row the condition of bindingness.
**This paper does not create that entry and does not assign a number.** See below.

### Decision record fields

```
OD-1 · VP-CLIN-PROTOCOL v1.0
Decision:       [ ] ADOPT   [ ] REJECT   [ ] ADOPT WITH AMENDMENT
Amendments:     ______________________________
DEF-1:          [ ] incorporated   [ ] not incorporated
Binding from:   ______________________________
RDL row:        ______________________________   (number unresolved — see below)
```

---

# DECISION 4 — OD-14 · Avatar content-version identifier

### Why this decision gates P0-2

**P0-2 cannot begin until the clinical materiality scope is determined.**

Register OD-14, verbatim: *"This is the only decision that directly gates the design of a P0
software item… and it is a clinical decision wearing an engineering costume: 'which fields are
clinically material' cannot be answered by engineering without silently setting clinical
policy."*

### Decision statement (verbatim from the register)

> *"Define which avatar fields are clinically material and therefore in scope for the content
> version hash; and specify the hash's determinism guarantees (field ordering, normalization,
> null handling)."*

### Source

Register OD-14 · Protocol Rule 12.1.1, §11.2, §12.2, §16.4

### Why it matters (source-stated)

- **Rule 12.1.1:** the identifier is *"a prerequisite for the change-control policy… Without
  it, 'has this changed since review?' is unanswerable and every rule in §12 is unenforceable."*
- **§11.2:** *"**Avatar version hash** (content hash of the reviewed record) — **Required** —
  Without it, no one can tell what was reviewed (§12.1)."*
- **§16.4:** *"what was reviewed (version hash)"* is the first auditability question.
- **§9.2:** both reviewers must review *"the same authored record (same avatar version hash)."*

### ⚠ Unresolved question: avatar-level vs component-level hashing

The two source passages point in different directions. **Neither resolves it.**

| Reading | Source basis | Implication |
|---|---|---|
| **Avatar-level** — one hash per avatar | §11.2 *"Avatar version hash"*, singular; §9.2 *"the same avatar version hash"* | Simple. Any material edit invalidates the whole approval |
| **Component-level** — hash per field group | §12.2 classifies changes **per component** into FULL REVALIDATION / MAJOR / MINOR / ADMINISTRATIVE | Enables partial re-review. A MINOR edit need not invalidate everything |

The register describes the §12.2 enumeration as *"a starting proposal, not a resolved scope."*

### Options

| | Option |
|---|---|
| **A** | **Avatar-level single hash** |
| **B** | **Component-level hashes** |
| **C** | **Adopt the material field set first and defer granularity** |

### Candidate material fields (Protocol §12.2, as identified in the source — proposal only)

**In scope, by change class:**

| Field | Class in §12.2 |
|---|---|
| `clinical_core.disorder` | FULL REVALIDATION |
| `dsm5_code` / `icd11_code` | FULL REVALIDATION |
| `risk_profile` — any field | FULL REVALIDATION |
| `human_personality` — replaced wholesale | FULL REVALIDATION |
| Adding a new locale | FULL REVALIDATION for that locale |
| `symptom_profile` — add/remove item; change `salience` | MAJOR |
| `severity` · `onset_duration` · `age` / `gender` | MAJOR |
| `disclosure_rules` — add/remove/condition | MAJOR |
| `session_goals` / `ideal_approach` | MAJOR |
| `protective_factors` / `mse` / `formulation` | MAJOR |
| `human_personality` — trait scales | MAJOR |
| `personalities[locale].persona_prompt` · `.speech` · `.cultural_context` / `.idioms_of_distress` · `.identity` | MAJOR |
| `voice_profile_id` / `voice_id` | MAJOR |
| `pronunciation_ar` / `pronunciation_en` | MAJOR |
| `symptom_profile` — reword `description` only | MINOR |
| `human_personality` — notes/free text only | MINOR |
| Voice params (`speech_rate`, `pitch`, `prosody`, `breathing`, `energy`) | MINOR unless clinically congruence-relevant, then MAJOR — *"CR decides class"* |

**Explicitly excluded as ADMINISTRATIVE:** `slug`, `portrait_url`, non-clinical metadata.

### Out of scope for this decision

The following are **engineering tasks that follow governance resolution of materiality**, and
are deliberately absent from this paper:

- hash algorithm
- database schema
- normalization rules
- canonical serialization
- field ordering and null handling

### Dependencies

**OD-13** (requires a CGL to rule on materiality). Informs OD-23.

### What remains unresolved after this decision

- The determinism specification (engineering, after materiality is set).
- Storage. No version or review table exists in the current schema; a migration would be
  required. **Not designed in this paper.**
- OD-23 — ratification of the §12.2 change-classification table.

### Consequence of delay (source-stated)

> *"Retrofitting a version identifier after approvals exist means those approvals can never be
> tied to content."*

### Required evidence

Protocol §12.2 field list · CGL ruling on materiality · a subsequent engineering determinism
specification.

### Decision record fields

```
OD-14 · Content version identifier
Granularity:       [ ] AVATAR-LEVEL   [ ] COMPONENT-LEVEL   [ ] DEFER GRANULARITY
Material fields:   ______________________________   (ratified set)
Excluded fields:   ______________________________
Determinism spec:  ______________________________   (owner + due date; engineering, after this)
```

---

## Governance Record Issue — RDL numbering

**This is unresolved and is not resolved by this paper.**

| Fact | State |
|---|---|
| Last existing RDL entry | **RDL-033** |
| RDL-034 | **Does not exist** |
| Protocol §16.3 proposes RDL-034 | Phase 3A/3B/3C acceptance |
| Protocol §16.3 proposes RDL-035 | Adopt or reject `VP-CLIN-PROTOCOL v1.0` |
| Protocol §16.3 proposes RDL-036 | Authorize Phase 4 scope |

**The collision:** `RELEASE_DECISION_LOG.md`'s own rule is *"Allocate the next `RDL-00N` ID
(monotonic)."* Since RDL-034 has never been written, if protocol adoption is recorded next it
would take **RDL-034**, contradicting §16.3's assignment of RDL-035. Governance must decide
whether Phase 3 acceptance is recorded first.

**Also unrecorded:** the RDL contains no row for Phase 3A/3B/3C, for Phase 4, or for the
merged P0-1 work — despite P0-1 being deployed to production.

**Whether each decision requires an RDL row:**

| Decision | RDL row required? |
|---|---|
| OD-13 | **NOT ESTABLISHED IN REPOSITORY** — §16.3 proposes none; the CGL role does not appear in `RELEASE_GOVERNANCE.md` or the RDL roles table |
| C-3 / P1-2 | **NOT ESTABLISHED IN REPOSITORY** |
| **OD-1** | **YES — source-stated.** Protocol line 5 and `RELEASE_GOVERNANCE.md` |
| OD-14 | **NOT ESTABLISHED IN REPOSITORY** |

**`RELEASE_DECISION_LOG.md` is not modified by this paper. No RDL number is allocated.**

---

## Dependency map

```
OD-13  Appoint Clinical Governance Lead        (root — no dependencies)
 │
 ├──→ OD-1   Adopt / reject / amend protocol
 │
 └──→ OD-14  Content version identifier scope
          │
          └──→ P0-2  Avatar content version identifier   (may then be specified)

C-3 / P1-2 priority conflict
 └── independent governance decision — no prerequisite

OD-24  Publication approval authority
 └── relevant to P1-2 (clinical sign-off gate), NOT to P0-2

Track B  (OD-21 psychometrician · OD-25 corpus authorization · OD-27 forged admin_test)
 └── independent of all of the above
```

> ### **OD-24 is NOT a blocker for P0-2.**
> Register OD-24, verbatim: *"Blocks implementation: **Partial** — the sign-off gate (P1-2)
> cannot be specified, but no P0 software item depends on it."*

---

## Board decision page

| Decision | Board Decision | Conditions / Amendments | Effective Date |
|----------|----------------|-------------------------|----------------|
| **OD-13** — Appoint Clinical Governance Lead | | | |
| **C-3 / P1-2** — Priority conflict | | | |
| **OD-1** — Adopt `VP-CLIN-PROTOCOL v1.0` | | | |
| **OD-14** — Content version identifier scope | | | |

**BOARD OUTCOME:**

- [ ] Decisions approved
- [ ] Decisions approved with amendments
- [ ] Decisions deferred
- [ ] Decisions rejected

**Signature / recording authority:** ______________________________

**Date:** ______________________________

---

## Closing boundary

**No engineering implementation begins from this paper until the applicable governance
decisions have been formally recorded.**

This paper is not an RDL entry, is not protocol adoption, and is not authorization for P0-2 or
P1-2 implementation. At the time of writing:

```
OD-13:      UNRESOLVED
C-3/P1-2:   UNRESOLVED
OD-1:       UNRESOLVED
OD-14:      UNRESOLVED
PROTOCOL:   PROPOSED — NOT ADOPTED
CGL:        NOT IDENTIFIED
P0-2:       NOT STARTED
P1-2:       NOT STARTED
```
