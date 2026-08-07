# VPsych Feature Inventory — Mission Omega

**Baseline:** production `7dc9a35` / `dpl_2fxxbz…` · DB migrations **61**  
**Status vocabulary:** Implemented · Partial · Experimental · Disabled · Production · Draft · Deprecated · Blocked

| Subsystem | Status | Production? | Notes |
|-----------|--------|-------------|-------|
| Authentication (signup/login/callback) | Implemented · Production | Yes | Supabase Auth; password policy enforced |
| Password recovery / reset UI | Implemented · Production | Yes | #140 app-hosted confirm + reset |
| Email verification | Partial | Yes | Provider/hook dependent; not re-proven this run |
| Authorization (profiles.role, admin gate) | Implemented · Production | Yes | Middleware + `requireApiAdmin` |
| Patient generation (Case Engine) | Implemented · Production | Yes | Immutable `CaseInstance` per session |
| Therapy Response / conversation (patient agent) | Implemented · Production | Yes | `generatePatientReplyDetailed`; `aiSource` surfaced |
| Assessment Engine | Implemented · Production | Yes | Scores **not validated** |
| Admin reports | Implemented · Production | Yes | Therapist cannot read reports (RLS) |
| ACE | Implemented · Production | Yes | Best-effort, non-blocking |
| CGE | Implemented · Production | Yes | Best-effort; no ace-bridge re-export |
| Quality Ledger | Implemented · Production | Yes | Sealed on session end; 6 ledger rows live |
| Scientific indices (CFI/ERI/AVI/ALE/RRS/VQI) | Implemented · Partial | Yes | Admin APIs live; score tables mostly empty |
| Research export | Implemented · Production | Yes | Admin; package format anonymized |
| Instructor presets | Implemented · Production | Yes | Incl. consultant/GP pathways (Wave 2 remediations) |
| Scenario templates | Implemented · Production | Yes | Admin UI + APIs |
| Voice STT (OpenAI) | Implemented · Production | Yes | |
| Voice TTS (ElevenLabs) | Implemented · Production | Yes | Wave 3 H5 closed (RDL-024) |
| Hands-Free Therapy (HFTE) | Experimental · Draft | No | Open PR #144 |
| Therapy Room Mode | Implemented · Disabled | Code yes; flag off | `NEXT_PUBLIC_THERAPY_ROOM_MODE` default false |
| PME / TRE / HCTF | Experimental · Draft | No | Open PRs #121–#124 |
| CQI / EOI / CVL | Experimental · Draft | No | Open PRs #126–#129 |
| Clinical Validation Program | Draft | No | Open PRs #137–#138 |
| Virtual Mental Health Center | Draft | No | Open PR #145 |
| Supervisor (admin report review) | Partial · Production | Yes | Admin reports surface; no separate supervisor role |
| Institutions / enterprise tenancy | Partial | Schema yes | Memberships empty; product incomplete |
| Enterprise DSAR / compliance automation | Draft · Blocked | Schema partial | v1.1 #87 |
| Avatar catalog | Implemented · Production | Yes | 2 active avatars |
| Avatar generation (procedural) | Implemented · Production | Yes | Case engine + templates |
| Analytics (ACE learner analytics) | Implemented · Partial | Yes | Curriculum progress tables sparse |
| Notifications / email product | Partial | Ops | Auth emails via provider; no in-app notifications |
| Cron / jobs | Partial | No dedicated product cron | Retention RPC exists; not schedule-certified |
| Realtime | Deprecated / unused | No | Not a product path |
| Feature flags | Implemented | Yes | TRM public flag; provider capability gates |
| Rate limiting | Implemented · Production | Yes | Upstash optional; in-memory fallback |
| Security audit logging | Implemented · Production | Yes | `security_audit_events` |
| Security middleware / headers | Implemented · Production | Yes | CSP/HSTS/COOP etc. |
| i18n EN/AR + RTL | Implemented · Production | Yes | Cookie locale; native personalities |
| `/validation` portal | Implemented · Production | Yes | #142 invited expert entry |
| Documentation package (RC1 + Omega) | Implemented | Docs | See FINAL_EXECUTIVE_SUMMARY |
| Migration history | Implemented · Production | Yes | 61 ≡ 61 after Omega remediations |

## Feature flags (Phase 3)

| Flag / gate | Default | Can activate in prod accidentally? | Control |
|-------------|---------|--------------------------------------|---------|
| `NEXT_PUBLIC_THERAPY_ROOM_MODE` | unset → **off** | Only if env set to true/1/yes/on | Vercel env |
| `ENABLE_HANDS_FREE_THERAPY` | N/A on main | No — not in main tree | PR #144 only |
| `OPENAI_API_KEY` / `AI_GATEWAY_API_KEY` | ops | Missing → persona_fallback (safe) | Secrets |
| `ELEVENLABS_API_KEY` | ops | Missing → TTS fail (surfaced) | Secrets |
| `REPORT_WRITE_KEY` / service role | ops | Missing → session end 500 | Secrets |
| `adaptive_mode` (learner profile) | per-user DB | No global accidental on | ACE |

**Finding:** No experimental excellence engines ship behind a silent default-on flag on production main.
