# VPsych Professional Preview 1.0 — Release Candidate Manifest (RC1)

**Product name:** VPsych Professional Preview 1.0  
**Release candidate ID:** `RC1-PP-1.0`  
**Date (UTC):** 2026-08-06  
**Audience:** Invited psychiatrists and psychologists (limited expert evaluation)  
**Governance:** Wave 3 PASSED (RDL-024 / RDL-025). This package prepares evaluation — it does not change product behavior.

---

## 1. Certified production baseline (immutable for RC1)

| Field | Value |
|---|---|
| Production URL | `https://vpsych.vercel.app` |
| Git `main` SHA | `d4c4fae4b8a0cae135a9ed848ea0a26eca466f45` |
| Production deploy | `dpl_DpdpoyEksVeSZvu1wx1mYngeX2jh` (READY, production target, redeploy after ElevenLabs key fix) |
| Prior remediations on baseline | `#131` → `1e44dce` (Wave 3 C1/H1–H5 code); `#133` → `d4c4fae` (migration ledger parity) |
| Supabase project | `rrzudbkxigeavfdnidnm` |
| Migration count | **56** git files ≡ **56** remote `schema_migrations` |
| Rollback tag | `rc1-pp-1.0-baseline` → `d4c4fae` |

**Parity check (2026-08-06):** `/api/health` → 200; authenticated `POST /api/voice/tts` → 200 `audio/mpeg`. Production matches the Wave 3 certified deployment.

---

## 2. What is included in RC1 (exactly)

### Product surfaces
- Therapist signup / login (Supabase Auth)
- Avatar selection (active standardized patients)
- Text and voice psychotherapy sessions (STT → patient reply → TTS)
- Session timer / hard expiry (40 min server-enforced)
- Admin-only performance reports (not exposed to therapists)
- Bilingual UI + natively authored `en-US` / `ar-JO` personalities
- Instructor presets (medical student / psychologist / counselor / GP pathway rules)
- Case Engine + Scenario Templates + ACE/CGE (best-effort, non-blocking)
- Quality Ledger + scientific index tables (admin/research APIs)
- Admin research export

### Engines on baseline
Dynamic Clinical Case Engine · Clinical Scenario Template Engine · Instructor Preset Engine · Adaptive Curriculum Engine · Competency Graph Engine · assessment rubric with DSM-5 / ICD-11 / formulation / differential / risk / educational competency dimensions

### Explicitly **not** in RC1
CQI · EOI · CVL · PME · TRE · HCTF excellence stack · multi-tenant institutional · full SEO/AEO/GEO suites · deferred v1.1 scientific PR forks (#62–#69) as separate products (ledger already consolidated via Wave 3 migration)

---

## 3. Documentation package shipped with this PR

| Doc | Purpose |
|---|---|
| `docs/RC1_MANIFEST.md` | This file — exact RC1 contents |
| `docs/RELEASE_NOTES_RC1.md` | What changed for evaluators |
| `docs/KNOWN_LIMITATIONS.md` | Honest limitations for experts |
| `docs/REVIEWER_GUIDE.md` | How psychiatrists should use the preview |
| `docs/FEEDBACK_GUIDE.md` | How to evaluate realism / education / conversation / authenticity |
| `docs/RC1_OPEN_PR_AUDIT.md` | Full open-PR categorization |
| `docs/rc3/W3_H5_CERT.md` | Wave 3 PASS evidence (RDL-024) |
| `docs/RELEASE_DECISION_LOG.md` | Append-only decision trail through RDL-026 |

---

## 4. Merge posture for RC1 freeze

| Action | PRs |
|---|---|
| **Merge now (docs only)** | This PR · [#135](https://github.com/alhazayed/vpsych/pull/135) if still open for any residual Wave 3 evidence |
| **Do not merge before expert review** | All feature/excellence PRs (#121–#129, #124–#127, etc.) |
| **Close as obsolete** | Superseded Wave 1–3 cert/remediation drafts (see audit) |
| **Keep open as future roadmap** | `[v1.1]` backlog (#62–#69, #87–#99) |

**Hard rule:** No application behavior changes enter `main` during Professional Preview evaluation unless a Critical production defect is verified.

---

## 5. Success definition for this preview

Experts can complete realistic bilingual sessions, hear patient voice, and judge clinical/educational quality. Feedback is collected via the Feedback Guide. Platform claims remain **training simulation** — not validated clinical measurement until published reliability coefficients exist.
