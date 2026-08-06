# Clinical Quality Intelligence (CQI) Platform

**Version:** `1.0.0`  
**Branch:** `cursor/cqi-platform-0594`

## Mission

Transform every psychiatrist, psychologist, educator, and beta tester into a
structured quality assessor. Capture expert observations during live sessions,
preserve them forever in a Quality Vault, cluster them, and produce
**human-approved** engineering recommendations.

CQI does **not** auto-create pull requests or modify production.

## Architecture

| Layer | Location |
|---|---|
| Domain | `src/lib/cqi/` |
| Migration | `supabase/migrations/20260805224457_clinical_quality_intelligence.sql` |
| Session API | `POST/GET /api/sessions/[id]/cqi` |
| Attachments | `POST /api/sessions/[id]/cqi/attachments` |
| Admin dashboard API | `GET /api/admin/cqi` |
| Analyst | `POST /api/admin/cqi/analyze` |
| Research export | `GET /api/admin/cqi/export` |
| Reviewer UI | `FlagThisMoment` in `VoiceSession` |
| Admin UI | `/admin/cqi` |

### Tables

- `cqi_flags` — append-only Quality Vault  
- `cqi_clusters` — clustered findings  
- `cqi_attachments` — evidence metadata (blob in Storage `cqi-evidence`)  
- `cqi_engineering_recs` — draft GitHub issue / Cursor prompt (approval required)

### Capture

One click **Flag this moment** auto-captures session id, assessment id, patient /
avatar, disorder, difficulty, language, voice, model, prompt/PME/TRE versions
(when present), transcript window, browser/device, platform/release versions,
optional PatientMindState overlay, and annotations.

### Security

- RLS: reviewers select own flags; admins select all  
- Insert via `cqi_submit_flag` SECURITY DEFINER (supports anonymity)  
- Status/cluster updates via `cqi_update_flag_status` (admin only)  
- Optional AES-GCM envelope for free text (`CQI_ENCRYPTION_KEY` or `REPORT_WRITE_KEY`)  
- Storage paths prefixed by `auth.uid()`  
- Rate limits on all CQI routes  
- Security audit events on submit/status  

### Memory fallback

If migrations are not yet applied, flags persist in a process memory vault
(`CQI_MEMORY_FALLBACK`, default on) so feedback is not silently dropped in
local/CI. Production must apply the migration.

### Quality Ledger bridge

`recordCqiLedgerSignal` stores lightweight trend signals for future VQI / ledger
integration when those packages are merged.

## Workflow

Captured → Classified → Analyzed → Clustered → Prioritized → Reviewed →
**Human approved** → Implemented → Verified → Certified

## Ops

1. Apply migration `20260805224457_clinical_quality_intelligence.sql`  
2. Confirm Storage bucket `cqi-evidence`  
3. Optionally set `CQI_ENCRYPTION_KEY`  
4. Invite experts to use Flag this moment  
5. Admins run Quality Analyst from `/admin/cqi`  
6. Copy Cursor prompts / GitHub issue markdown only after human approval  
