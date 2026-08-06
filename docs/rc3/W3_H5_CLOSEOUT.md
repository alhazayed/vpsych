# W3-H5 Final Closeout — Production TTS

**Date (UTC):** 2026-08-06  
**Scope:** W3-H5 only. No application code changes.  
**Production:** `https://vpsych.vercel.app`

---

## 1. Configuration verification (no assumptions)

| Check | Result | Evidence |
|---|---|---|
| `ELEVENLABS_API_KEY` exists on Vercel | **YES** | Composio `VERCEL_FILTER_PROJECT_ENVS` — env id `FzFPxs4DW1KTxuU3`, targets `production` + `preview`, type **`sensitive`** |
| Value begins with `sk_` | **NO (inferred)** | Cannot decrypt `sensitive` values via API (`decrypted: false`, empty value). Runtime: authenticated `POST /api/voice/tts` → **503 `TTS_CONFIG`**, which is thrown only when `isValidElevenLabsApiKey` fails (`/^sk_[A-Za-z0-9]+/`). |
| Value not quoted | **Unknown (sensitive)** | App strips wrapping quotes before validation; still fails → raw value is not a valid `sk_…` key even after strip. |
| Value not truncated | **Unknown (sensitive)** | Same — fails prefix check regardless of length. |
| Belongs to intended ElevenLabs account | **Cannot verify** | Sensitive; no decrypted value. Prior prod logs on `dpl_8Q7YGEH…`: ElevenLabs `invalid_api_key` / `API key must start with 'sk_'`. |

### Authenticated production probe (this closeout)

```text
POST https://vpsych.vercel.app/api/voice/tts
  Cookie: sb-*-auth-token (audit admin + audit therapist)
  Body: {"text":"Hello Wave3 H5.","locale":"en-US"}
→ HTTP 503 {"error":"Text-to-speech failed","code":"TTS_CONFIG"}
```

Conclusion: Production secret is **present but invalid** for current ElevenLabs API key format.

---

## 2. Release Manager instructions (required)

Do **not** change application code. Do **not** merge unrelated PRs.

1. Open [Vercel → vpsych → Environment Variables](https://vercel.com/alhazayed-1540s-projects/vpsych/settings/environment-variables).
2. Locate **`ELEVENLABS_API_KEY`** (Production + Preview), env id `FzFPxs4DW1KTxuU3`.
3. Replace the value with a **current** ElevenLabs API key from the intended workspace:
   - Must start with **`sk_`**
   - No surrounding `'` or `"`
   - Full key, not truncated
4. Save for **Production** (and Preview if desired).
5. **Redeploy Production** from `main` (Deployments → Redeploy, or Promote) so serverless picks up the new secret. Env edits alone do not update the live deployment.
6. Reply in the agent thread when done.

After that, the closeout agent will:

- Re-probe authenticated `POST /api/voice/tts` → expect **200** + `audio/mpeg`
- Run EN/AR voice smoke + session E2E
- Run independent H5-only certification
- Recommend **✅ WAVE 3 PASSED** / unlock Wave 4 if evidence is clean

---

## 3. Status

| Gate | Status |
|---|---|
| Config verified | Done |
| Secret corrected | **BLOCKED — waiting on Release Manager** |
| Redeploy | Pending |
| TTS smoke 200 audio/mpeg | Pending |
| Voice E2E | Pending |
| H5-only cert | Pending |
| Wave 3 PASS | **Not yet** |

**Wave 4 remains locked until W3-H5 closes with production evidence.**
