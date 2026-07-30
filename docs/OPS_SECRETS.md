# Production secrets checklist

After deploying the audit hardening branch, set these **server-only** Vercel env vars (Production + Preview):

## Required for session reports

Either:

1. **`REPORT_WRITE_KEY`** — must equal the Supabase Vault secret `report_write_key`:

```sql
select decrypted_secret
from vault.decrypted_secrets
where name = 'report_write_key';
```

or

2. **`SUPABASE_SERVICE_ROLE_KEY`** — from Supabase → Project Settings → API. Prefer this long-term; the app will insert reports directly and skip HMAC.

## Recommended

- `AI_GATEWAY_API_KEY` — realistic patient replies + assessments
- Enable **Leaked password protection** in Supabase Auth settings

## Already applied on the live DB

- Demo accounts `admin@vpsych.test` / `therapist@vpsych.test` banned
- Signed insert-once `create_session_report`
- Session timer/reopen trigger
- Therapists can only INSERT `role = 'user'` messages; assistant/system go through RPCs
