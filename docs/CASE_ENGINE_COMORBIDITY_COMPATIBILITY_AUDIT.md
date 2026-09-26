# Case Engine Comorbidity Compatibility Audit

**Status:** CONDITIONAL (UX + API guards shipped; clinical matrix sync deferred)  
**Branch:** `cursor/case-engine-comorbidity-compat-fc9c`  
**Observed failure:** Preview Generator `comorbidity_unlisted` for `bipolar-mania` + `complex-ptsd`

---

## 1. Root cause

The Preview Generator UI historically offered **every active disorder** from the DB (or builtin fallback) as a comorbidity option, while Case Engine generation validates against an **explicit authored matrix** (`BUILTIN_COMORBIDITY_RULES` / `public.comorbidity_rules`).

`bipolar-mania` + `complex-ptsd` was selectable in the UI but has **no authored rule** in either the builtin catalog or migration seeds → validation correctly returns `comorbidity_unlisted`.

This is a **UI ↔ matrix desync**, not a broken validator.

---

## 2. Authoritative source of compatibility rules

| Concern | Authoritative source for Preview Generator |
|---|---|
| Primary diagnoses (generation) | `BUILTIN_DISORDERS` in `src/lib/case-engine/catalog.ts` via `getBuiltinCatalog()` |
| Comorbidity compatibility | `BUILTIN_COMORBIDITY_RULES` in the same file |
| Validation | `validateComorbidities()` in `src/lib/case-engine/validation.ts` |
| Therapy modalities | `BUILTIN_THERAPY_PROFILES` |
| Difficulty | `BUILTIN_DIFFICULTY_PROFILES` |
| Language / locale | request `locale` (`en-US` \| `ar-JO`); culture/speech only |

**DB note:** `public.comorbidity_rules` (seeded by migrations) is the persistence mirror for runtime DB reads, but **`POST /api/admin/cases/preview` uses `getBuiltinCatalog()` only** — it does not load DB rules.

Helpers that read the matrix (no second catalogue):

- `src/lib/case-engine/comorbidity-compat.ts` → `getComorbidityCompatibility`, `listCompatibleComorbiditySlugs`, `auditComorbidityCompatibilityMatrix`

---

## 3. Classification: `bipolar-mania` + `complex-ptsd`

### **NEEDS AUTHORING**

Evidence:

1. No rule in `BUILTIN_COMORBIDITY_RULES` for this ordered pair.
2. No rule in migration `20260802181535_clinical_scenario_templates.sql` for this pair.
3. Both disorders have authored **primary packages** (symptom profiles, therapy cues) and can generate **solo** cases.
4. Clinical plausibility alone is insufficient per platform policy.

**Outcome applied:** UI prevents selection / blocks Preview with “Requires case authoring”; API continues to reject with `comorbidity_unlisted`.

**Not applied:** inventing a compatibility rule or simulation package.

---

## 4. Trace path

```
/admin/cases (CaseEnginePanel)
  → POST /api/admin/cases/preview
    → getBuiltinCatalog()  (disorders + comorbidityRules)
    → generateCaseInstance()
      → validateCaseGeneration()
        → validateComorbidities()
          → findComorbidityRule(primary, comorbid)
          → comorbidity_unlisted | comorbidity_incompatible | ok
    → CaseInstance snapshot JSON (on success)
```

---

## 5. Builtin matrix summary (preview truth)

| Metric | Count |
|---|---|
| Active builtin disorders | 11 (`BUILTIN_DISORDERS`) |
| Authored comorbidity rules | `BUILTIN_COMORBIDITY_RULES.length` (see catalog) |
| Explicit impossible | `mdd×bipolar-mania`, `adhd×ptsd`, `schizophrenia×delirium` |
| Orphan rule IDs | 0 |
| Duplicate rule keys | 0 |

**Primaries with zero authored comorbidities in builtin:**  
`bipolar-mania`, `complex-ptsd`, `panic-disorder`, `delirium` (and any active disorder not appearing as `primary_disorder_id` in a compatible rule).

---

## 6. Audit findings (do not auto-fix)

### 6.1 UI-selectable (legacy) but unsupported by Case Engine

Under the old “all active × all active” pairing, most combinations are unlisted. Notable examples:

| Primary | Comorbid | Builtin code | Notes |
|---|---|---|---|
| `bipolar-mania` | `complex-ptsd` | `comorbidity_unlisted` | **Reported bug — NEEDS AUTHORING** |
| `bipolar-mania` | *(any)* | `comorbidity_unlisted` | No compatible primary rules |
| `complex-ptsd` | *(as comorbid)* | `comorbidity_unlisted` | Never appears as comorbid in builtin |
| `mdd-recurrent-moderate` | `complex-ptsd` | `comorbidity_unlisted` | Not in builtin (see drift) |

### 6.2 Supported by Case Engine (builtin) — UI must expose these only

Compatible/possible pairs from `BUILTIN_COMORBIDITY_RULES` (non-exhaustive; see catalog):

- MDD ↔ GAD, MDD ↔ PTSD, MDD ↔ AUD (possible), MDD ↔ Panic, MDD ↔ BPD (possible)
- GAD ↔ ADHD, GAD ↔ AUD (possible), AUD ↔ GAD
- PTSD ↔ MDD, PTSD ↔ AUD
- Schizophrenia ↔ GAD
- BPD ↔ MDD
- ADHD ↔ GAD

### 6.3 Migration authored but missing from builtin (drift)

Present in `20260802181535_clinical_scenario_templates.sql`, disorders exist in `BUILTIN_DISORDERS`, but **missing from `BUILTIN_COMORBIDITY_RULES`**:

| Primary | Comorbid | Migration | Builtin today |
|---|---|---|---|
| `complex-ptsd` | `mdd-recurrent-moderate` | compatible | unlisted |
| `complex-ptsd` | `alcohol-use-disorder` | possible | unlisted |
| `bipolar-mania` | `mdd-recurrent-moderate` | impossible | unlisted |
| `ptsd` | `bpd` | possible | unlisted |
| `bpd` | `ptsd` | possible | unlisted |
| `bpd` | `alcohol-use-disorder` | possible | unlisted |
| `schizophrenia` | `mdd-recurrent-moderate` | possible | unlisted |
| `adult-adhd` | `mdd-recurrent-moderate` | compatible | unlisted |

**Decision this PR:** report only — do **not** auto-sync (avoids inventing/expanding clinical surface without an intentional authoring pass).

### 6.4 Orphaned / reserved identifiers

`DISORDER_IDS` keys without a matching `BUILTIN_DISORDERS` row (DB-seeded, not in preview catalog):

`pdd`, `socialAnxiety`, `ocd`, `asd`, `schizoaffective`, `eating`

Migration rules that reference these (e.g. MDD+social-anxiety, eating+MDD) cannot be exercised by Preview until packages are added to builtin.

### 6.5 Duplicate identifiers / mismatched labels

- No duplicate `(primary, comorbid)` keys in builtin rules.
- Slugs are consistent between UI labels and catalog (`bipolar-mania`, `complex-ptsd`).
- ICD/DSM for Complex PTSD is ICD-11-only (`6B41`) — intentional.

### 6.6 Combinations requiring future authoring

At minimum (requested + related):

1. **`bipolar-mania` + `complex-ptsd`** — NEEDS AUTHORING (ordered pair + joint simulation cues)
2. Any other clinically desired pair not listed in §6.2 / migration sync candidates in §6.3

---

## 7. Code / UX changes (this PR)

1. `comorbidity-compat.ts` — read helpers over existing matrix; matrix audit function.
2. `CaseEnginePanel.tsx` — comorbidity dropdown limited to authored-compatible slugs; unsupported preserved without silent clear; inline NEEDS AUTHORING copy; Preview disabled; ContextualHelp; primary list filtered to builtin-known disorders.
3. `POST /api/admin/cases/preview` — human-readable `error` + `issues`; reject unknown comorbidity slugs (no silent drop).
4. EN/AR help: comorbidities require authored/validated configuration.
5. Tests: `comorbidity-compat.test.ts`.

**Unchanged:** HMAC, MFA, RLS, authorization, rate limiting, audit logging, disorder packages, validation strength.

---

## 8. Final status

**CONDITIONAL**

- CLEAR for: reported UX failure path, API rejection, help copy, regression tests, no invented clinical rules.
- CONDITIONAL for: migration↔builtin matrix drift (§6.3) left for a dedicated authoring/sync PR; DB-only disorders still appear in the disorders catalog list (not in Preview primary select after filter).

Do not merge clinical matrix expansions without explicit authoring review.
