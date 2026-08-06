# W3-H5 Final Closeout — Production TTS

**Date (UTC):** 2026-08-06  
**Scope:** W3-H5 only. No application code changes.  
**Production:** `https://vpsych.vercel.app`

---

## Production under test (post key replace)

| Item | Value |
|---|---|
| Deploy | `dpl_DpdpoyEksVeSZvu1wx1mYngeX2jh` **READY** (Vercel `action=redeploy`) |
| SHA | `d4c4fae` (Wave 3 remediation ancestor `1e44dce` / #131) |
| Alias | `vpsych.vercel.app` |

---

## 1. Configuration verification

| Check | Result |
|---|---|
| `ELEVENLABS_API_KEY` exists | Yes (Vercel env id `FzFPxs4DW1KTxuU3`, Production+Preview, type `sensitive`) |
| Runtime validity after RM replace | **PASS** — authenticated TTS no longer returns `TTS_CONFIG` |
| Prior failure | Auth TTS → **503 `TTS_CONFIG`** (key missing/`sk_` invalid) |

---

## 2. Authenticated TTS smoke (required)

All probes used Supabase password-grant session cookies (`sb-*-auth-token`).

| Case | Status | Content-Type | Bytes |
|---|---|---|---|
| therapist EN `en-US` | **200** | `audio/mpeg` | 33899 |
| therapist AR `ar-JO` | **200** | `audio/mpeg` | 33481 |
| admin EN `en-US` | **200** | `audio/mpeg` | 33899 |
| admin AR `ar-JO` | **200** | `audio/mpeg` | 33481 |

✓ Authenticated · ✓ HTTP 200 · ✓ `audio/mpeg` · ✓ speech generated

---

## 3. End-to-end voice validation

Therapist session lifecycle on production: create → message → TTS patient reply → end.

| Scenario | Avatar | Locale | Disorder | Session | Message | TTS | End |
|---|---|---|---|---|---|---|---|
| jordan-gad-en | jordan-hale | en-US | GAD (default) | 200 | 200 + reply | 200 / 452276 B | 200 |
| maya-mdd-en | maya-chen | en-US | MDD (default) | 200 | 200 + reply | 200 / 247894 B | 200 |
| jordan-ptsd-en | jordan-hale | en-US | ptsd override | 200 | 200 + reply | 200 / 408391 B | 200 |
| maya-ar | maya-chen | ar-JO | MDD (default) | 200 | 200 + Arabic reply | 200 / 103280 B | 200 |

✓ Avatar speech · ✓ English · ✓ Arabic · ✓ Multiple disorders · ✓ Therapist session · ✓ Session completion

---

## 4. Status

| Gate | Status |
|---|---|
| Config verified | Done |
| Secret corrected + redeploy | Done (`dpl_Dpdpoy…`) |
| TTS smoke 200 audio/mpeg | **PASS** |
| Voice E2E | **PASS** |
| W3-H5 | **CLOSED** |
| Wave 3 | See `docs/rc3/W3_H5_CERT.md` |
