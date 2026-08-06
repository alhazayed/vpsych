# Wave 3 Final — Prioritized Remediation Plan

**Trigger:** RDL-022 — Wave 3 Final **NOT READY**  
**Authority:** Independent certification board  

## P0 — unblock Wave 3 re-cert

| Step | Action | Owner | Done when |
|---|---|---|---|
| 1 | Merge **PR #128** (`cursor/w3-completion-0594`) to `main` | Release engineering | `main` contains `56adaff` ancestry + Quality Ledger + HCF |
| 2 | Apply migration `20260805214500_quality_ledger_and_scientific_indices.sql` to prod Supabase | Release Manager | `schema_migrations` includes version; ledger RPC callable |
| 3 | Deploy `main` to Vercel **production** target | Release Manager | `vpsych.vercel.app` SHA ≠ `5aae138`; deploy id recorded |
| 4 | Fix **TTS 502** (`TTS_FAILED`) on production | Eng + RM | Authenticated `/api/voice/tts` returns `audio/mpeg` EN+AR |
| 5 | Launch **fresh** independent Wave 3 final re-cert agent | Board | New evidence pack on new SHA |

## P0 acceptance probes (re-cert checklist)

- [ ] `GET /api/admin/quality-ledger` ≠ 404 (admin auth)
- [ ] `GET /api/admin/research/export` ≠ 404
- [ ] `GET /api/admin/vqi` (or equivalent index APIs) live
- [ ] `POST /api/admin/presets/preview` `{presetSlug: foundation-interview-medstudent-en}` → 200
- [ ] Same for `cbt-psychologist-en`, `mi-counselor-en`
- [ ] `cbt-skills-gp-en` generates without comorbidity validation crash
- [ ] Assessment items include measurable DSM/ICD reasoning dimensions
- [ ] TTS EN/AR PASS
- [ ] Session create/message/end regression PASS
- [ ] Therapist still 403 on admin APIs

## Explicitly excluded from Wave 3 remediation

Do **not** merge as Wave 3 scope:

- PR #129 CVL  
- PR #126 CQI / #127 EOI  
- PR #121–124 HCTF/PME/TRE/Mission22 (except HCF cues already in #128)

These are Wave 4+ / excellence tracks.

## Stop rules

- If Critical/High remain after deploy → another **NOT READY** decision; no Wave 4.
- If only Medium/Low remain → Board may issue **CERTIFIED WITH RECOMMENDATIONS** per governance.
