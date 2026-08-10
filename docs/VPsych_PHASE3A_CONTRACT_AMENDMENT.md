# VPsych — Phase 3A Contract Amendment

**Date:** 2026-08-10  
**Branch:** `cursor/phase3a-contract-amendment-5e36`  
**Amended document:** `docs/VPsych_VIRTUAL_PATIENT_CREATION_CONTRACT.md`  
**Trigger:** Phase 3B pre-flight **CONTRACT MATCH: FAIL** (human-personality runtime discrepancy)  
**Scope:** Documentation correction only.

---

## 1. Finding

Phase 3B pre-flight correctly stopped. The Phase 3A contract incorrectly assumed that unknown/new avatar slugs without persisted `human_personality` produce soft-absent / weak Module 2b traits (“empty soul” patients).

Actual runtime in `src/lib/personality-engine/resolve.ts`:

1. Frozen session snapshot  
2. DB `avatars.human_personality` map  
3. Builtin catalog by slug (`maya-chen`, `jordan-hale` only)  
4. **`synthesizeHumanPersonalityFromAvatar()`** — always returns a valid `HumanPersonalityProfile`

`resolveAvatar()` therefore always attaches Module 2b. Missing authored HP is an **authored-quality** gap, not Module 2b runtime absence.

Secondary pre-flight gaps (documentation inventory only):

- `voice_profiles` clinical delivery columns (`20260807120000_clinical_voice_profiles.sql`) omitted from §7  
- `disorders_require_clinical_code` (DSM-5 **or** ICD-11) omitted from clinical/validation contract  
- `avatars.updated_at` overstated as always sync-trigger maintained  
- Wizard described in ways that implied a `VirtualPatientWizard` component; Phase 2 uses an inline `/admin/avatars/new` shell

---

## 2. Original contract assumption

Representative incorrect statements (pre-amendment):

- §6.3: “else soft absence / formatting fallbacks. **New avatars without `human_personality` … get no structured Module 2b traits.**”
- §11.2: “Empty `human_personality` + unknown slug → **Weak/absent Module 2b traits**”
- Risk #3: “easy to ship **empty soul** patients”
- §2.1: `updated_at` “Set by sync trigger” (unqualified)
- §7: voice_profiles inventory limited to provider / voice_name / voice_id / language / is_active
- §5 / §8.2: ICD-11 package wording without the existing Postgres clinical-code CHECK
- Wizard naming: implied / informal `VirtualPatientWizard` vs actual inline page shell

---

## 3. Actual runtime behavior

| Concern | Actual behavior | Evidence |
|---|---|---|
| Human personality resolve | Snapshot → DB → builtin → **synthesize** (always valid profile) | `src/lib/personality-engine/resolve.ts` |
| Synthesis | Deterministic; never GPT; valid `HumanPersonalityProfile` | `src/lib/personality-engine/defaults.ts` |
| Module 2b on resolve path | Always attached via `resolveHumanPersonality` | `src/lib/avatars/resolve.ts` |
| Voice profiles | Registry identity **plus** clinical columns (`speech_rate`, `pitch`, `energy`, `prosody`, `breathing`, `hesitation_frequency`, `speaker_boost`, `emotion_modulation`, pronunciation hints, `updated_at`) | `20260807120000_clinical_voice_profiles.sql` |
| Disorder clinical codes | CHECK requires DSM-5 **or** ICD-11; case-engine also flags `icd11_missing` / both-missing | `20260803050605…`, `src/lib/case-engine/validation.ts` |
| `avatars.updated_at` | Bumped only after **successful** v2 flat projection inside `sync_avatar_flat_from_v2`; early returns leave it unchanged; no avatar-wide updated_at trigger | `20260731191943_avatar_voice_casting_and_available_locales.sql` |
| Phase 2 create UI | Inline shell at `src/app/(app)/admin/avatars/new/page.tsx`; Save disabled; no `VirtualPatientWizard` export | Phase 2 admin UX |

**Unchanged engines:** personality engine, `resolveAvatar`, synthesizer, voice_profiles schema, disorder catalog, patient agent, sessions, ACE, CGE, RLS, auth, Admin UX implementation — **not modified by this amendment**.

---

## 4. Corrected contract

Updated sections in `docs/VPsych_VIRTUAL_PATIENT_CREATION_CONTRACT.md`:

| Section | Correction |
|---|---|
| Header | Amendment pointer + date |
| §2.1 | Accurate conditional `updated_at` behavior |
| §4 / §19 | Inline `/admin/avatars/new` wizard shell; no required `VirtualPatientWizard` component |
| §5 | Disorder clinical-code CHECK + case-engine issues |
| §6.3 | Full HP resolve order including synthesis; runtime safety vs authored quality |
| §7.1 | Clinical voice_profiles column inventory; Phase 3B reuses existing architecture |
| §8.2 / new §8.4 | Catalog clinical-code requirement for linked disorders |
| §9.2 | Authored-quality input + synthesis fallback + publish message wording |
| §11.2 / §11.3 | Soft degradation = quality gap, not Module 2b absence |
| §14.5 | Explicit DRAFT vs PUBLISH rules |
| §19 / §20 | Publish HP as quality gate; disorder clinical-code compliance |
| §22 Risk #3 | Rewritten without “empty soul” / Module 2b absence framing |
| Amendment record | Docs-only attestation |

---

## 5. Impact on Phase 3B

Phase 3B may proceed only after pre-flight **CONTRACT MATCH: PASS** against this amended contract, and only when explicitly authorized.

Implementation implications (design constraints — **not implemented here**):

1. Draft create may omit authored HP and remain `is_active = false` (runtime synthesizes safely).  
2. Publish gates that require authored HP must treat that as **authored training quality**, not runtime Module 2b prevention.  
3. Validation copy must match §9.2 / §14.5 (deliberate characterization).  
4. Voice assign must reuse existing `voice_profiles` (including clinical columns already present) — no new voice schema.  
5. Default-disorder linkage must select catalog rows satisfying existing clinical-code rules — no new disorder schema.  
6. Do not assume `updated_at` always changes on every avatar UPDATE.

---

## 6. Quality-gate interpretation

| Layer | Meaning |
|---|---|
| **RUNTIME SAFETY** | Missing authored `human_personality` does **not** break Module 2b. Synthesis keeps a valid profile available. |
| **AUTHORED TRAINING QUALITY** | ACTIVE / PUBLISHED Virtual Patients should have deliberately authored, clinically coherent human personality when the publish contract requires it. Prefer authored over synthesis. |

Required publish messaging (equivalent):

> Authored human personality is required for publication to ensure deliberate and consistent patient characterization.

Forbidden messaging:

> Human personality is required because otherwise Module 2b is absent.

---

## 7. Secondary schema / documentation corrections

1. **Voice profiles:** Documented existing clinical delivery fields; no columns created.  
2. **Disorder clinical code:** Documented `disorders_require_clinical_code` + case-engine validators; no catalog changes.  
3. **`updated_at`:** Documented actual sync-trigger path.  
4. **Wizard:** Documented inline shell path; no new component created.

---

## 8. Explicit non-change attestation

| Artifact | Changed? |
|---|---|
| Application `.ts` / `.tsx` | **No** |
| Database schema | **No** |
| Migrations (`.sql`) | **No** |
| APIs | **No** |
| Admin UX implementation | **No** |
| `package.json` / lockfile | **No** |
| JSON schemas / personas / engines | **No** |
| Documentation (`docs/VPsych_VIRTUAL_PATIENT_CREATION_CONTRACT.md`, this file) | **Yes** |

**Follow-up cosmetic fix (same docs-only amendment):** Exec summary §1 human_personality cell updated to name synthesis + authored-quality framing so it matches §§6.3 / 9.2.

**Migrations:** NONE  

**Application code changed:** NO  

**Database changed:** NO  

---

## Sequence (authoritative)

```text
CONTRACT AMENDMENT  (this task)
  → PREFLIGHT RERUN
  → CONTRACT MATCH: PASS
  → wait for Phase 3B authorization
  → PHASE 3B IMPLEMENTATION (separate task)
```

This task **stops** after amendment + pre-flight. It does **not** implement Phase 3B.

---

*End of Phase 3A contract amendment.*
