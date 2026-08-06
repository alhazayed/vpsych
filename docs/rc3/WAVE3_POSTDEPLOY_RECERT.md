# Wave 3 Post-Deploy Independent Recertification

**Evidence ID:** `RC3-W3-POSTDEPLOY-EV-20260806T0624Z`  
**Authority:** Independent VPsych Wave 3 Certification Board (Cursor)  
**Date (UTC):** 2026-08-06  
**Scope:** Critical / High findings from RDL-022 only (W3-C1, W3-H1–H5)  
**Mode:** Production-only probes (unauth + audit-credential auth) + deployed-SHA source. **No application code changes.**  
**Governance:** RDL-023  

---

## Production under test

| Item | Observed |
|---|---|
| URL | `https://vpsych.vercel.app` |
| Current production deploy | `dpl_7b4x92WcoQd1jWmqjNWTBuBNsCYw` **READY** · SHA `d4c4fae4b8a0cae135a9ed848ea0a26eca466f45` (`d4c4fae`) · aliases include `vpsych.vercel.app` |
| Remediation deploy (prior) | `dpl_CqJsC3pftCqyWR6q1YiMTHiRgPLm` **READY** · SHA `1e44dce5664a7aa06e6680896c3ed88a15ecf045` (`1e44dce`) · Wave 3 C1/H1–H5 code from #131 |
| Git `main` tip | `d4c4fae` (docs/parity #133; ancestor chain includes `1e44dce`) |
| Supabase project | `rrzudbkxigeavfdnidnm` |
| Remote migrations | **56** versions; includes `20260805130453` and `20260805214500` |
| Git migrations | **56** files; versions **exact match** to remote (empty diff) |
| Quality Ledger schema | `quality_ledgers` (+ related `quality_*` tables) present after `20260805214500` |

Sources: Vercel MCP `list_deployments` / `get_deployment` / `get_runtime_logs`; Supabase MCP `list_migrations` / `execute_sql`; authenticated + unauthenticated `curl`/Python probes; `git` on `origin/main`.

---

## Decision

### ❌ WAVE 3 NOT READY — do **not** unlock Wave 4

| Gate | Result |
|---|---|
| All Critical closed | **PASS** (W3-C1 closed) |
| All High closed | **FAIL** — **W3-H5 remains OPEN** |
| Unlock Wave 4 | **LOCKED** |

Closed since RDL-022: **W3-C1, W3-H1, W3-H2, W3-H3, W3-H4**.  
Still open: **W3-H5**.

---

## Findings evidence table

| ID | Severity | Status | Evidence |
|---|---|---|---|
| **W3-C1** | Critical | **CLOSED** | Unauth `GET /api/admin/quality-ledger` → **401**. Admin-auth → **200** JSON dashboard (`ledger_version`, `n`, `mean_vqi`, …). Migration `20260805214500` applied; `quality_ledgers` present. Served by `dpl_7b4x92…`. |
| **W3-H1** | High | **CLOSED** | Admin-auth `POST /api/admin/presets/preview` with `presetSlug`: `foundation-interview-medstudent-en`, `mi-counselor-en`, `cbt-psychologist-en` → **200** `{"ok":true,…}` (not 404). Deployed source also resolves slug via builtin + DB. |
| **W3-H2** | High | **CLOSED** | Admin-auth GP `cbt-skills-gp-en` preview across 5 seeds → comorbidities never include `alcohol-use-disorder`. Builtin constraint `forbidden_comorbidity=alcohol-use-disorder` present at SHA `d4c4fae`. |
| **W3-H3** | High | **CLOSED** | Deployed `defaultRubric` (`assessment.ts` @ `1e44dce`/`d4c4fae`) includes `dsm_reasoning`, `icd_reasoning`, `clinical_formulation`, `differential_diagnosis`, `risk_formulation`, `educational_competency` (11 items, weights sum 100). |
| **W3-H4** | High | **CLOSED** | Unauth `GET /api/admin/research/export` → **401**. Admin-auth → **200** research package (`format`, `fields` incl. scenario/AI/template/rubric versions + quality metrics). |
| **W3-H5** | High | **OPEN** | Authenticated `POST /api/voice/tts` (therapist + admin session cookies) on `dpl_7b4x92…` / `d4c4fae` → **HTTP 503** `{"error":"Text-to-speech failed","code":"TTS_CONFIG"}`. Matches deployed `isValidElevenLabsApiKey` / `TTS_CONFIG` path (key missing or not `sk_…`). Prior prod logs on `dpl_8Q7YGEH…`: `invalid_api_key` / “must start with 'sk_'”. **No `audio/mpeg` success on post-remediation production.** |

---

## Probe log (raw)

### Unauthenticated

```text
GET  /api/admin/quality-ledger     → 401 {"error":"Unauthorized"}
GET  /api/admin/research/export    → 401 {"error":"Unauthorized"}
POST /api/voice/tts                → 401 {"error":"Unauthorized"}
POST /api/admin/presets/preview    → 401 {"error":"Unauthorized"}
GET  /api/health                   → 200 {"ok":true,"service":"vpsych",…}
```

### Authenticated (audit therapist / admin via Supabase password grant → `sb-*-auth-token` cookie)

```text
GET  /api/admin/quality-ledger                          → 200 dashboard JSON
GET  /api/admin/research/export                         → 200 research package
POST /api/admin/presets/preview {foundation-interview-medstudent-en} → 200 ok
POST /api/admin/presets/preview {mi-counselor-en}       → 200 ok
POST /api/admin/presets/preview {cbt-psychologist-en}   → 200 ok
POST /api/admin/presets/preview {cbt-skills-gp-en} ×5   → 200 ok; no AUD comorbid
POST /api/voice/tts (therapist)                         → 503 TTS_CONFIG
POST /api/voice/tts (admin)                             → 503 TTS_CONFIG
```

---

## What remains for PASS

1. **Release Manager:** set Production `ELEVENLABS_API_KEY` to a valid `sk_…` key; redeploy or confirm env pickup.  
2. Authenticated smoke: `POST /api/voice/tts` → `Content-Type: audio/mpeg` (EN and preferably AR).  
3. Fresh independent post-ops recert of **W3-H5** (or full Critical/High re-check).  
4. On H5 CLOSED → Board may record Wave 3 PASSED and unlock Wave 4.

---

## Out of scope

CQI, EOI, CVL, PME, TRE, Medium/Low findings, feature work, speculative product changes.
