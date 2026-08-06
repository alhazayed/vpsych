# Wave 3 Final Remediation Report

**Branch:** `cursor/w3-final-remediation-0594`  
**Base:** `cursor/w3-completion-0594` (#128) → `main` @ `5aae138`  
**Date (UTC):** 2026-08-06  
**Evidence of defects:** production `dpl_8Q7YGEH…` / RDL-022  

## Finding disposition

| ID | Status in this branch | Notes |
|---|---|---|
| **W3-C1** | Fixed in code (from #128) | `/api/admin/quality-ledger` + migration `20260805214500` |
| **W3-H1** | Fixed in code (from #128) | `presetSlug` loads DB rows; builtins for med student / psychologist / counselor |
| **W3-H2** | Fixed in code (from #128) + extra tests | GP forbids AUD comorbidity; generation regression |
| **W3-H3** | **Extended in this branch** | `defaultRubric` now includes DSM-5, ICD-11, clinical formulation, differential diagnosis, risk formulation, educational competency mapping (11 items, weights = 100) |
| **W3-H4** | Fixed in code (from #128) | `/api/admin/research/export` admin-auth + rate limit |
| **W3-H5** | **Root cause verified; ops fix required** | Production logs: `invalid_api_key` / `API key must start with 'sk_'`. Code now rejects malformed keys as `TTS_CONFIG` (503). **Release Manager must set a valid `ELEVENLABS_API_KEY=sk_…` in Vercel Production.** App code cannot mint a provider secret. |

## W3-H5 root cause (production evidence)

Runtime log on `dpl_8Q7YGEH…`:

```text
[tts] TTS_FAILED {"detail":{"type":"authentication_error","code":"invalid_api_key",
"message":"API key must start with 'sk_'.","status":"invalid_api_key_prefix",…}}
[voice=EXAVITQu4vr4xnSDxMaL]
```

Voice IDs and request formatting are fine; the **API key value in production is invalid**.

### Ops steps (Release Manager)

1. Obtain a current ElevenLabs API key (`sk_…`).  
2. Vercel → Project `vpsych` → Settings → Environment Variables → Production: set `ELEVENLABS_API_KEY`.  
3. Redeploy production (or wait for next promote) so serverless picks up the value.  
4. Smoke: authenticated `POST /api/voice/tts` with `{ "text": "Hello", "locale": "en-US" }` → `audio/mpeg`.

## Migrations

Apply after merge, before re-cert:

- `20260805214500_quality_ledger_and_scientific_indices.sql`

## Local verification (this branch)

| Gate | Result |
|---|---|
| lint | 0 errors (warnings only) |
| typecheck | pass |
| test | **275** passed / 49 files |
| test:migrations | local structure OK (incl. `20260805214500`) |
| build | pass (quality-ledger + research/export routes present) |

## Deploy sequence

1. Merge this PR to `main` (includes #128 + H3/H5 hardening).  
2. Apply migration.  
3. Fix `ELEVENLABS_API_KEY` (W3-H5).  
4. Promote production; record new SHA + deploy id.  
5. Launch **independent** Wave 3 certification (read-only).  

## Out of scope

CQI, EOI, CVL, PME, TRE, dashboards, roadmap features.
