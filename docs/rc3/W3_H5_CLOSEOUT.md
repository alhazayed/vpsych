# W3-H5 Final Closeout — Production TTS

**Date (UTC):** 2026-08-06  
**Evidence ID:** `RC3-W3-H5-CERT-EV-20260806T0642Z`  
**Scope:** W3-H5 only. No application code changes.  
**Production:** `https://vpsych.vercel.app`  
**Independent agent:** Wave 3 H5-only certification (post RM key replace)

---

## Production under test (post key replace)

| Item | Value |
|---|---|
| Deploy | `dpl_DpdpoyEksVeSZvu1wx1mYngeX2jh` **READY** |
| Source | Vercel `action=redeploy` of `dpl_7b4x92WcoQd1jWmqjNWTBuBNsCYw` |
| SHA | `d4c4fae4b8a0cae135a9ed848ea0a26eca466f45` (`d4c4fae`) |
| Remediation ancestor | `1e44dce` (#131) |
| Alias | `vpsych.vercel.app` (confirmed on deployment) |
| Target | `production` |

Confirmed via Vercel MCP `list_deployments` + `get_deployment`.

---

## 1. Configuration verification

| Check | Result |
|---|---|
| `ELEVENLABS_API_KEY` exists | Yes (Vercel env id `FzFPxs4DW1KTxuU3`, Production+Preview, type `sensitive`) |
| Runtime validity after RM replace | **PASS** — authenticated TTS returns **200** `audio/mpeg` (no `TTS_CONFIG`) |
| Prior failure (RDL-023) | Auth TTS → **503 `TTS_CONFIG`** on `dpl_7b4x92…` |

---

## 2. Authenticated TTS smoke (required) — independent probes

All probes used Supabase password-grant session cookies (`sb-rrzudbkxigeavfdnidnm-auth-token`, base64 session JSON).

| Case | Status | Content-Type | Bytes | Container |
|---|---|---|---|---|
| admin EN `en-US` | **200** | `audio/mpeg` | 33899 | ID3 |
| admin AR `ar-JO` | **200** | `audio/mpeg` | 45184 | ID3 |
| therapist EN `en-US` | **200** | `audio/mpeg` | 33899 | ID3 |
| therapist AR `ar-JO` | **200** | `audio/mpeg` | 45184 | ID3 |

✓ Authenticated · ✓ HTTP 200 · ✓ `audio/mpeg` · ✓ MPEG/ID3 speech payload

---

## 3. Session spot-check (optional, completed)

Therapist lifecycle on production: create → message → TTS patient reply → end.

| Step | Result |
|---|---|
| Avatar | `jordan-hale` (`46eefc09-…`) |
| Session | `8bc79f66-2214-480f-8ef2-da2684786c63` — **200** |
| Message | **200** — patient reply 154 chars (`aiSource=gpt`) |
| TTS (avatar-bound) | **200** `audio/mpeg` · 176841 B · ID3 |
| End | **200** — `reportId` + `ledgerId` present |

Machine evidence: `docs/rc3/evidence/w3_h5_closeout_2026-08-06T0642Z.json`.

---

## 4. Status

| Gate | Status |
|---|---|
| Config verified | Done |
| Secret corrected + redeploy | Done (`dpl_Dpdpoy…`) |
| TTS smoke 200 audio/mpeg (EN+AR, therapist+admin) | **PASS** |
| Session message + TTS spot-check | **PASS** |
| W3-H5 | **CLOSED** |
| Wave 3 | **PASSED** — see `docs/rc3/W3_H5_CERT.md` / RDL-024 |

**Recommend Executive Board unlock Wave 4.**
