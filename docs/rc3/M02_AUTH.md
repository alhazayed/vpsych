# RC3 Mission 02 — Authentication & Authorization

**Verdict: PASS (public + anonymous API/RLS)** · Authenticated role matrix **BLOCKED** (no audit credentials)

## Production evidence

| Check | Result |
|---|---|
| `/avatars`, `/admin`, `/sessions`, `/learning` unauthenticated | **307** → `/login?next=…` |
| `/api/sessions` GET/POST anon | **401** `application/json` `{"error":"Unauthorized"}` |
| `/api/admin/*`, `/api/voice/*`, `/api/health/openai` anon | **401** JSON |
| Anon PostgREST SELECT on profiles/sessions/reports/avatars/… | **401** permission denied (no table GRANT to `anon`) |
| Locale cookie | `Secure; SameSite=lax` |
| Demo accounts | Banned (migration `reban_demo_accounts`) — not usable |

## Blocked follow-ups (RC3-C2)

- Therapist login → session ownership
- Admin gate on `/admin` + `/api/admin/*` (403 vs 401 distinction)
- Report read denied to therapist (admin-only RLS)
