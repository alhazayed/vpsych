# VPsych Data Integrity Certification — Mission 13

**Date:** 2026-08-03  
**Branch:** `cursor/data-integrity-certification-8acf`  
**Roles:** Chief Data Architect / PostgreSQL Engineer / Healthcare Data Integrity Auditor / Clinical Data Specialist / DBRE  
**Supabase:** `rrzudbkxigeavfdnidnm`

---

## Overall Integrity Score

| Domain | Score (0–100) | Notes |
|---|---|---|
| Entity completeness | **90** | All core entities present; learning_paths empty (unused yet) |
| Relationship / FK integrity | **94** | 0 orphans on messages/reports/sessions/avatars/cases |
| Clinical coding integrity | **88** | ICD-11-only CPTSD allowed; CHECK requires ≥1 code |
| Locale / localization consistency | **86** | Null languages repaired; EN/AR CHECK; voice registry AR-primary by design |
| Concurrency / race safety | **88** | Report unique + ACE session uniqueness + finish-on-report trigger |
| Recovery / partial failure | **84** | Report/status repair; expired-without-report remains historical |
| Historical integrity | **82** | Scores/coach history append; 40 completed/expired without reports (mostly abandoned / newly expired stale) |
| Educational integrity | **80** | ACE/CGE FKs sound; template competency_id is text (no FK) |
| Analytics integrity | **84** | Dashboards read FK-backed tables; no duplicate score/coach rows |
| **Overall** | **86** | |

### Verdict

**⚠ DATA INTEGRITY CERTIFIED WITH RECOMMENDATIONS**

---

## Phase 1 — Entity inventory (live)

| Entity | Count |
|---|---|
| profiles | 10 |
| avatars | 2 |
| sessions | 366 |
| session_messages | 3024 |
| session_reports | 325 |
| voice_profiles | 4 |
| personas | 2 |
| disorders | 17 |
| clinical_templates | 3 |
| instructor_presets | 3 |
| case_instances | 221 |
| learner_profiles | 2 |
| learner_competencies | 52 |
| competency_scores | 793 |
| learning_paths | 0 |
| cge_nodes / cge_edges | 34 / 42 |

---

## Phase 2 — Relationship report

| Check | Before | After |
|---|---|---|
| Messages without session | 0 | 0 |
| Reports without session | 0 | 0 |
| Sessions without therapist/avatar | 0 | 0 |
| Sessions with missing case_instance | 0 | 0 |
| Avatars with missing voice_profile | 0 | 0 |
| Duplicate reports per session | 0 | 0 |
| Case comorbidity UUID orphans | 0 | 0 |
| Active session **with** report | **1** | **0** (repaired) |
| Stale active past `max_duration` | **5+** | **0** (expired) |

FK patterns: CASCADE for messages/reports; RESTRICT for avatar/disorder bindings; SET NULL for voice_profile / case_instance unbind.

---

## Phase 3 — Clinical integrity report

| Finding | Status |
|---|---|
| All 17 disorders have ICD-11 **or** DSM-5 | Pass (CHECK `disorders_require_clinical_code`) |
| Complex PTSD (`6B41`) ICD-11-only | Valid — app `validateDsmIcd` updated |
| Templates missing primary diagnosis | 0 |
| Case primary disorder orphans | 0 |
| Builtin catalog subset vs DB 17 | Recommendation — keep DB as source of truth |

---

## Phase 4 — Locale / data consistency

| Surface | Values | Notes |
|---|---|---|
| `sessions.language` | en-US / ar-JO (nulls backfilled) | CHECK en\|ar\|en-US\|ar-JO |
| `session_reports.language` | en-US / ar-JO | Same CHECK |
| `profiles.preferred_language` | en \| ar | Existing CHECK |
| `voice_profiles.language` | ar (registry) | EN TTS uses legacy `avatars.voice_id` by design |
| Voice locale resolution | Profile language must match session | `resolveAvatarSpeechVoice` |

---

## Phase 5 — Concurrency report

| Mechanism | Behavior |
|---|---|
| `session_reports.session_id` UNIQUE | Duplicate end → 23505 / alreadyExists |
| `create_session_report` ON CONFLICT DO NOTHING | Signed RPC path |
| **NEW** `competency_scores (session_id, competency_id)` UNIQUE | Prevents ACE double-write |
| **NEW** `coach_feedback (session_id)` UNIQUE | One coach packet / session |
| `learner_profiles.user_id` UNIQUE + **23505 retry** | Concurrent first assessment |
| `adaptive_case_history (learner_id, fingerprint)` UNIQUE | No repeat adaptive fingerprint |
| user→user consecutive turns | 5 historical (Medium; no DB turn uniqueness) |

---

## Phase 6 — Recovery report

| Scenario | Control |
|---|---|
| Report inserted while session still active | Trigger `finish_session_on_report` + `/end` repair |
| Interrupted session past timer | Migration expired stale actives; `expireStaleSession` on list |
| Duplicate `/end` | Report unique + ACE upserts ignoreDuplicates |
| ACE soft-fail | Never blocks report persistence |
| Completed/expired without report | 40 remain after stale-active expiry (abandoned / failed end). Recommendation: batch backfill heuristic reports for ≥4-message expired sessions |

---

## Phase 7 — Historical integrity

| Store | Integrity |
|---|---|
| `competency_scores` | Append-only; now unique per session×competency |
| `coach_feedback` | One per session |
| `cge_attempts` / `cge_mastery_history` | Graph history retained |
| `template_versions` / `preset_versions` | Version UNIQUE pairs |
| Personas | No content version column (recommendation) |
| Assessment identity | `case_instances.assessment_id` UNIQUE |

---

## Phase 8 — Analytics integrity

Dashboards (admin reports, ACE analytics, CGE graph) read FK-backed tables. After remediations: no duplicate competency/coach rows; no active+report inconsistency; language fields populated for grouping.

---

## Phase 9 — Educational integrity

| Engine | Status |
|---|---|
| Competency Graph | Nodes/edges consistent; self-loop CHECK |
| Adaptive Curriculum | Learner↔competency UNIQUE; fingerprint dedupe |
| Instructor Presets | Versioned; linked templates |
| Clinical Templates | Primary diagnosis FK RESTRICT |
| Learning paths | Table empty — schema ready |
| Gap | `template_competencies.competency_id` / `preset_competencies.competency_id` are text (no FK to domains) |

---

## Applied fixes

1. Migration `20260803050533_data_integrity_certification.sql` (applied to Supabase)
   - Backfill null session/report languages
   - Finish sessions that had reports while still `active`
   - Expire stale active sessions past `max_duration_sec`
   - Unique indexes for ACE competency scores + coach feedback
   - `disorders_require_clinical_code` CHECK
   - `finish_session_on_report` trigger
   - Language CHECKs on sessions/reports
2. `validateDsmIcd` — ICD-11-only disorders valid
3. `ensureLearnerProfile` — retry on `23505`
4. `persistLearnerUpdate` — upsert ACE rows with ignoreDuplicates
5. `/api/sessions/[id]/end` — repair active+report on alreadyExists
6. Regression tests: `validation.test.ts`, `data-integrity.test.ts`

---

## Recommendations (not blocking)

1. Backfill reports for expired sessions with ≥4 messages (heuristic assessment job).
2. Optional FK or CHECK that `template_competencies.competency_id` ∈ `competency_domains`.
3. Seed explicit English `voice_profiles` (requires relaxing `UNIQUE(provider, voice_id)` to include language).
4. Align builtin case-engine catalog with all 17 DB disorders.
5. Consider forbidding consecutive `user→user` turns in `insert` policy / RPC.
6. Persona content versioning column for historical audits.

---

## Regression

| Check | Result |
|---|---|
| Lint | 0 errors |
| Typecheck | pass |
| Tests | **175** passed |
| Build | pass |
| Live SQL post-fix | null languages 0; active+report 0; stale active 0; ACE dups 0 |

---

## Conclusion

Core relational integrity is sound. Verified High defects (active+report, stale actives, null languages, ACE race uniqueness, ICD-11-only coding) are repaired in database and application code.

**⚠ DATA INTEGRITY CERTIFIED WITH RECOMMENDATIONS**
