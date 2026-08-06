# Wave 3 Post-Deploy Independent Recertification

**Evidence ID:** `RC3-W3-POSTDEPLOY-EV-20260806T0621Z`  
**Authority:** Independent VPsych Wave 3 Certification Board (Cursor)  
**Date (UTC):** 2026-08-06  
**Scope:** Critical / High findings from RDL-022 only (W3-C1, W3-H1–H5)  
**Mode:** Production-only probes + deployed-SHA source / architecture tests. **No application code changes.**  
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

Sources: Vercel MCP `list_deployments` / `get_deployment`; Supabase MCP `list_migrations` / `execute_sql`; `curl` probes; `git` on `origin/main`.

---

## Decision

### ❌ WAVE 3 NOT READY — do **not** unlock Wave 4

| Gate | Result |
|---|---|
| All Critical closed | **PASS** (W3-C1 closed) |
| All High closed | **FAIL** — **W3-H5 remains OPEN** |
| Unlock Wave 4 | **LOCKED** |

Closed since RDL-022: **W3-C1, W3-H1, W3-H2, W3-H3, W3-H4**.  
Still open: **W3-H5** (no authenticated TTS success on post-remediation production; prior `invalid_api_key` / `sk_` failure still unrefuted by success evidence).

---

## Findings evidence table

| ID | Severity | Status | Evidence |
|---|---|---|---|
| **W3-C1** | Critical | **CLOSED** | Unauth `GET https://vpsych.vercel.app/api/admin/quality-ledger` → **HTTP 401** `{"error":"Unauthorized"}` (not 404). Route present at SHA `d4c4fae` (`src/app/api/admin/quality-ledger/route.ts`, `requireApiAdmin`). Migration `20260805214500_quality_ledger_and_scientific_indices` applied; `quality_ledgers` table exists. Runtime log on `dpl_7b4x92…`: `GET /api/admin/quality-ledger` **401**. |
| **W3-H1** | High | **CLOSED** | Unauth `POST /api/admin/presets/preview` with slugs → **401** (route exists; auth before resolution). Deployed source (`d4c4fae` / `1e44dce`): preview resolves `presetSlug` via builtin + DB (`.eq("slug", body.presetSlug)`). Builtin slugs present: `foundation-interview-medstudent-en`, `mi-counselor-en`, `cbt-psychologist-en`. Tests: `src/lib/instructor-presets/w3-presets.test.ts`, `architecture.test.ts` (“preset preview resolves DB rows by presetSlug (W3-H1)”). |
| **W3-H2** | High | **CLOSED** | Deployed source: `cbt-skills-gp-en` has `forbidden_comorbidity` = `alcohol-use-disorder` (`catalog.ts`). Generation regression in `w3-presets.test.ts` asserts AUD never selected across seeds. No production contradiction observed. |
| **W3-H3** | High | **CLOSED** | Deployed `defaultRubric` (`assessment.ts` @ `1e44dce`/`d4c4fae`) includes: `dsm_reasoning`, `icd_reasoning`, `clinical_formulation`, `differential_diagnosis`, `risk_formulation`, `educational_competency` (11 items, weights sum 100). Labels in `report-locale.ts`. |
| **W3-H4** | High | **CLOSED** | Unauth `GET /api/admin/research/export` → **HTTP 401** (not 404). Route at SHA with `requireApiAdmin` + `admin.research.export`. Runtime log: `GET /api/admin/research/export` **401** on `dpl_7b4x92…`. |
| **W3-H5** | High | **OPEN** | **Cannot close.** Unauth `POST /api/voice/tts` → **401** only (auth gate; no provider call). Vercel runtime logs: last `invalid_api_key` / “API key must start with 'sk_'” TTS **502**s were on **pre-remediation** `dpl_8Q7YGEH…` (~05:44–05:46Z). **No** authenticated TTS success (`audio/mpeg`) and **no** post-`1e44dce`/`d4c4fae` TTS provider outcome in logs. Code guard (`isValidElevenLabsApiKey` / `TTS_CONFIG`) is present but does **not** prove a valid Production `ELEVENLABS_API_KEY`. Prior remediation report stated ops still blocked. **Do not speculate.** |

---

## Probe log (raw)

```text
GET  /api/admin/quality-ledger     → 401 {"error":"Unauthorized"}
GET  /api/admin/research/export    → 401 {"error":"Unauthorized"}
POST /api/voice/tts                → 401 {"error":"Unauthorized"}
POST /api/admin/presets/preview    → 401 {"error":"Unauthorized"}  (×3 slugs)
GET  /api/health                   → 200 {"ok":true,"service":"vpsych",…}
```

Probes hit aliases served by `dpl_7b4x92WcoQd1jWmqjNWTBuBNsCYw` (confirmed via Vercel runtime logs).

---

## What remains for PASS

1. **Release Manager:** set Production `ELEVENLABS_API_KEY` to a valid `sk_…` key; redeploy or confirm env pickup.  
2. Authenticated smoke: `POST /api/voice/tts` → `Content-Type: audio/mpeg` (EN and preferably AR).  
3. Fresh independent post-ops recert of **W3-H5 only** (or full Critical/High re-check).  
4. On H5 CLOSED → Board may record Wave 3 PASSED and unlock Wave 4.

---

## Out of scope

CQI, EOI, CVL, PME, TRE, Medium/Low findings, feature work, speculative product changes.
